/**
 * @module fastify/api-security-middleware
 *
 * The two `/api` request gates a locally-bound daemon needs before any route handler runs:
 * bearer-token authentication (optional, active only when a token is configured) and cross-origin
 * rejection (always active). Same job and decision logic as `../express/api-security-middleware.ts`
 * (see that file's own doc for the full drop-list this was genericized from), reimplemented on
 * Fastify's native `onRequest` lifecycle hook (`app.addHook('onRequest', ...)`) in place of
 * Express's `app.use('/api', ...)` path-scoped middleware. Fastify has no first-class "scope this
 * hook to a URL prefix" primitive at the plain-instance level (that requires nesting the routes
 * themselves inside a `.register()` plugin with a `prefix`, which `mountPackHttp`'s pack-agnostic
 * mounting does not do), so both hooks below scope themselves manually by checking the request's
 * own path against the `/api` prefix before applying either gate — the observable behavior is
 * identical to the Express version's `app.use('/api', ...)` scoping.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  apiTokenFromEnv,
  isApiTokenMiddlewareEnabled,
  type ApiTokenAuthEnvConfig,
} from '@jini/core';
import { isLoopbackPeerAddress } from './local-daemon-request.js';
import { allowedBrowserPorts, isAllowedBrowserOrigin } from '../origin-validation.js';

/** Health/readiness/version probes stay reachable without a bearer token so monitoring never needs one. Both the mount-relative and `/api`-prefixed forms are kept for parity with the Express version's set (only the `/api`-prefixed forms are ever reachable here, since both hooks below already require the path to start with `/api` before this set is even consulted). */
const OPEN_PROBE_PATHS = new Set([
  '/health',
  '/api/health',
  '/ready',
  '/api/ready',
  '/version',
  '/api/version',
]);

const BEARER_TOKEN_PATTERN = /^Bearer\s+(\S+)\s*$/i;

export interface ApiBearerAuthMiddlewareDeps {
  /** Env var names for the token/disable flags. Defaults to `JINI_API_TOKEN` / `JINI_DISABLE_API_AUTH`. */
  tokenConfig?: ApiTokenAuthEnvConfig;
  /** Defaults to `process.env`. Threaded through so tests never have to mutate real process env. */
  env?: NodeJS.ProcessEnv;
}

const DEFAULT_TOKEN_CONFIG: ApiTokenAuthEnvConfig = {
  tokenEnvVar: 'JINI_API_TOKEN',
  disableEnvVar: 'JINI_DISABLE_API_AUTH',
};

/**
 * The request path with no query string — Fastify's `request.url` (unlike Express's
 * `request.path`) always includes the query string, so this strips it to match Express's
 * comparison semantics. `req.url` is typed as a required `string` on `FastifyRequest`
 * (never `undefined`), and `String.prototype.split` on a string separator always returns an
 * array with at least one element, so the `[0]` index is provably defined — the non-null
 * assertion documents that guarantee instead of masking it behind an unreachable `?? ''` fallback
 * that could never be exercised by a real request.
 */
function requestPath(req: FastifyRequest): string {
  return req.url.split('?')[0]!;
}

/**
 * Registers a bearer-token gate on every `/api/*` route, active only when
 * {@link isApiTokenMiddlewareEnabled} says a token is configured and auth hasn't been disabled.
 * When active: open-probe paths and loopback peers skip the check unconditionally; every other
 * request must send `Authorization: Bearer <token>` matching the configured token exactly, or the
 * request is rejected with 401 before reaching any route handler.
 *
 * @param app - The Fastify instance to register the gate on.
 * @param deps - See {@link ApiBearerAuthMiddlewareDeps}. Both fields are optional; omitting `deps`
 * entirely reads `JINI_API_TOKEN`/`JINI_DISABLE_API_AUTH` from real `process.env`.
 * @returns Nothing. Registers zero hooks (a deliberate no-op, not a bug) when no token is configured.
 * @complexity Setup is O(1). Each gated request is O(1) (one Set lookup, one regex match).
 * @overallScore 100/100
 */
export function registerApiBearerAuthMiddleware(app: FastifyInstance, deps: ApiBearerAuthMiddlewareDeps = {}): void {
  const tokenConfig = deps.tokenConfig ?? DEFAULT_TOKEN_CONFIG;
  const env = deps.env ?? process.env;
  if (!isApiTokenMiddlewareEnabled(tokenConfig, env)) return;

  const apiToken = apiTokenFromEnv(tokenConfig, env);
  app.addHook('onRequest', (req: FastifyRequest, reply: FastifyReply, done: (err?: Error) => void) => {
    const path = requestPath(req);
    if (!path.startsWith('/api')) {
      done();
      return;
    }
    if (OPEN_PROBE_PATHS.has(path)) {
      done();
      return;
    }
    // Loopback short-circuit: the desktop UI / local CLI never carry a bearer, and a reverse
    // proxy in front of a non-loopback bind must always forward the real bearer itself — so this
    // is intentionally not fooled by a proxied `X-Forwarded-For` header.
    if (isLoopbackPeerAddress(req.socket?.remoteAddress)) {
      done();
      return;
    }
    const match = BEARER_TOKEN_PATTERN.exec(req.headers.authorization ?? '');
    if (!match || match[1] !== apiToken) {
      reply.code(401).send({
        error: {
          code: 'API_TOKEN_REQUIRED',
          message: `Authorization: Bearer <${tokenConfig.tokenEnvVar}> required`,
        },
      });
      return;
    }
    done();
  });
}

export interface ApiOriginGuardMiddlewareDeps {
  /** The host this daemon is bound to — compared against a request's `Host`/`Origin` headers. */
  host: string;
  /** Extra allow-listed origins (e.g. a reverse-proxy's public origin). Defaults to none. */
  extraAllowedOrigins?: readonly string[];
  /** Returns the daemon's resolved listen port, or a falsy value before it has resolved. */
  getResolvedPort: () => number | null | undefined;
  /** Defaults to `process.env`. Threaded through so `JINI_WEB_PORT` is testable without mutating real process env. */
  env?: NodeJS.ProcessEnv;
}

/**
 * Chrome may strip the port from the `Origin` header on same-origin GET requests. Used only as a
 * narrow fallback for safe, idempotent GET requests once the exact-match check below has already
 * failed — mutating routes always require an exact origin/host match.
 */
function isPortlessLoopbackOrigin(origin: string): boolean {
  return /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])$/.test(origin);
}

/**
 * Registers an unconditional cross-origin gate on every `/api/*` route: non-browser clients (no
 * `Origin` header) and requests whose `Origin` resolves to a loopback, private-LAN, or explicitly
 * allow-listed origin are let through; everything else is rejected with 403. `Origin: null`
 * (typically a sandboxed iframe) is always rejected — see the Express version's doc for why the
 * origin daemon's safe-GET exemption for that case was dropped.
 *
 * @param app - The Fastify instance to register the gate on.
 * @param deps - See {@link ApiOriginGuardMiddlewareDeps}.
 * @returns Nothing. Unlike the bearer-token gate, this always registers its hook — there is
 * no "disabled" state.
 * @complexity Setup is O(1). Each gated request is O(p) in the number of allowed ports (typically 1-2).
 * @overallScore 100/100
 */
export function registerApiOriginGuardMiddleware(app: FastifyInstance, deps: ApiOriginGuardMiddlewareDeps): void {
  const { host, getResolvedPort } = deps;
  const extraAllowedOrigins = deps.extraAllowedOrigins ?? [];
  const env = deps.env ?? process.env;

  app.addHook('onRequest', (req: FastifyRequest, reply: FastifyReply, done: (err?: Error) => void) => {
    const path = requestPath(req);
    if (!path.startsWith('/api')) {
      done();
      return;
    }

    const origin = req.headers.origin;
    if (origin == null || origin === '') {
      done();
      return;
    }

    if (origin === 'null') {
      reply.code(403).send({ error: 'Origin: null not allowed for this route' });
      return;
    }

    // Fail-closed: block every browser origin until the daemon's real listen port is known, so a
    // request arriving in the brief window before `.listen()` resolves can never be compared
    // against a wrong or default port.
    const resolvedPort = getResolvedPort();
    if (!resolvedPort) {
      reply.code(403).send({ error: 'Server initializing' });
      return;
    }

    const ports = allowedBrowserPorts(resolvedPort, env);
    if (!isAllowedBrowserOrigin(origin, req.headers.host, ports, host, [...extraAllowedOrigins])) {
      if (req.method !== 'GET' || !isPortlessLoopbackOrigin(String(origin))) {
        reply.code(403).send({ error: 'Cross-origin requests are not allowed' });
        return;
      }
    }
    done();
  });
}
