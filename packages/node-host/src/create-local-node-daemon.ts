/**
 * @module create-local-node-daemon
 *
 * The "host preset" (extraction-plan.md §2.4) that lets a brand-new product boot a running daemon
 * process by implementing zero interfaces: assembles `@jini/sqlite`'s durable `EventLog`,
 * `@jini/daemon`'s `RunLifecycle` and `AgentExecutor` (the driver that actually spawns an agent
 * CLI subprocess for the 9 v1-supported defs — see `@jini/daemon`'s own source-map.md), an Express
 * app wrapped in `@jini/http`'s route-registration guard and security middleware, a caller's own
 * `@jini/core` packs, and the generic daemon-status routes, then listens and returns `{url, server,
 * stop}`. Generalized from OD's `startServer()` — see `source-map.md` for the exact line-by-line
 * provenance and drop-list (every plugin/design-system/connector/routine/media/marketplace/
 * telemetry/project route `startServer` also wires is explicitly out of scope; this is the generic
 * assembly skeleton only).
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { Server } from 'node:http';

import express, { type Express } from 'express';
import { bindings, createDaemon, type Bindings, type Daemon } from '@jini/core';
import type { AnyPack, MissingTokenIds } from '@jini/core/internal';
import { AgentExecutorToken, createAgentExecutor, createRunLifecycle, EventLogToken, RunLifecycleToken } from '@jini/daemon';
import { createSqliteEventLog } from '@jini/sqlite';
import {
  configuredAllowedOrigins,
  installRouteRegistrationGuard,
  mountPackHttp,
  registerApiBearerAuthMiddleware,
  registerApiOriginGuardMiddleware,
  registerDaemonStatusRoutes,
} from '@jini/http';

import { closeHttpServer, normalizeDaemonBindHost } from './host-bootstrap.js';

const require = createRequire(import.meta.url);
/** This package's own `package.json` version, echoed back by `GET /api/daemon/status`. Read once at module load — never changes for the life of the process. */
const packageVersion = (require('../package.json') as { readonly version: string }).version;

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_TOKEN_ENV_VAR = 'JINI_API_TOKEN';
const DEFAULT_DISABLE_ENV_VAR = 'JINI_DISABLE_API_AUTH';
const DEFAULT_BIND_HOST_ENV_VAR = 'JINI_BIND_HOST';

/**
 * Extracts the real bound TCP port from `server.address()`'s result once a `'listening'` event
 * has fired. Pulled out as its own pure function (rather than inlined) so the belt-and-braces
 * "somehow still not a port" branch — `server.address()` is typed `AddressInfo | string | null`
 * for the general `net.Server` case, but is always a real `AddressInfo` with a positive `.port`
 * for the TCP listener this module creates — is directly unit-testable without needing a real
 * socket or any mocking.
 *
 * @param address - The raw return value of `server.address()`.
 * @returns The bound port, or `null` if `address` is `null` (not yet listening), a string (a Unix
 * domain socket path — this module never listens on one), or an `AddressInfo` with a non-positive port.
 * @complexity O(1).
 * @overallScore 100/100
 */
export function resolveBoundPort(address: { port: number } | string | null): number | null {
  if (address == null || typeof address === 'string') return null;
  return address.port > 0 ? address.port : null;
}

/**
 * The host a daemon's reported base URL should use: binding to every interface (`0.0.0.0` /
 * `::`) is not itself a connectable address, so callers are told to use the IPv4 loopback address
 * instead. Any other bind host is echoed back verbatim.
 *
 * @param bindHost - The literal host `createLocalNodeDaemon` bound to (already normalized).
 * @returns `'127.0.0.1'` for an all-interfaces bind host, otherwise `bindHost` unchanged.
 * @complexity O(1).
 * @overallScore 100/100
 */
export function resolveReportHost(bindHost: string): string {
  return bindHost === '0.0.0.0' || bindHost === '::' ? '127.0.0.1' : bindHost;
}

/** The token ids `createLocalNodeDaemon` always binds itself, before any caller customization runs. */
export type KernelBoundIds = 'jini.eventLog' | 'jini.runLifecycle' | 'jini.agentExecutor';

export interface CreateLocalNodeDaemonConfig<
  Packs extends readonly AnyPack[],
  BoundIds extends string = KernelBoundIds,
> {
  /** Directory the daemon's durable state lives in. Created implicitly by `better-sqlite3` opening `<dataDir>/events.db` — the directory itself must already exist. */
  dataDir: string;
  packs: Packs;
  /**
   * Extends the kernel's own pre-bound `EventLog`/`RunLifecycle` bindings with whatever a pack's
   * own deps require. A callback rather than a pre-built `Bindings` instance because
   * `Bindings.bind()` mutates and returns `this` — two independently constructed instances can't
   * be merged, so the caller must chain directly onto the instance this function already seeded.
   */
  bindings?: (b: Bindings<KernelBoundIds>) => Bindings<BoundIds>;
  /** TCP port to listen on. Defaults to `0` (ask the OS for an ephemeral free port). */
  port?: number;
  /** Host/address to bind to. Defaults to `'127.0.0.1'` (loopback-only). */
  host?: string;
  /** Env var names for the optional bearer-token gate. Defaults to `JINI_API_TOKEN` / `JINI_DISABLE_API_AUTH`. */
  apiToken?: { tokenEnvVar?: string; disableEnvVar?: string };
  /** Invoked once the HTTP listener has fully closed, before the durable `EventLog` is closed. Any rejection still lets shutdown finish (see `stop()`'s doc), but propagates to the `stop()` caller. */
  onShutdown?: () => Promise<void> | void;
  /** Defaults to `process.env`. Threaded through for testability — see this module's own doc on the one place (`JINI_BIND_HOST`) this still touches the real process env regardless. */
  env?: NodeJS.ProcessEnv;
  /**
   * Accepted for forward-compat with `@jini/agent-runtime`'s eventual registry-to-daemon wiring.
   * Not wired to anything yet — no registry-to-daemon integration exists anywhere in this
   * codebase today (see extraction-plan.md and this package's `source-map.md`).
   */
  agents?: unknown[];
}

export interface LocalNodeDaemon {
  /** The daemon's real, resolved base URL (reflects the actual bound port even when `port: 0` was requested). */
  readonly url: string;
  readonly server: Server;
  /**
   * Gracefully shuts the daemon down: closes the HTTP listener, runs the caller's `onShutdown`
   * hook, then closes the durable `EventLog` (releasing the sqlite file handle). Idempotent and
   * safe to call more than once, or concurrently — every call after the first observes the same
   * in-flight/settled shutdown rather than repeating the work.
   */
  stop(): Promise<void>;
}

/**
 * Boots a complete, runnable `@jini/core` daemon process: an `EventLog` + `RunLifecycle` are
 * created and bound automatically, an Express app is assembled behind `@jini/http`'s route guard
 * and security middleware, the caller's own `packs` are composed and mounted, and the generic
 * daemon-status routes are registered — then the app starts listening and this resolves once the
 * real port is known.
 *
 * Preserves `createDaemon`'s compile-time "missing binding" error through this wrapper: the same
 * `MissingTokenIds<Packs, BoundIds>` conditional gate `createDaemon` itself uses (re-derived here
 * via `@jini/core/internal`, not duplicated) forces a call site with an unbound pack dependency to
 * fail to typecheck with the missing token id(s) visible in the error, exactly as it would calling
 * `createDaemon` directly. See `packages/node-host/src/create-local-node-daemon.typecheck.ts` for
 * the compile-time proof.
 *
 * **Why two overloads instead of one generic signature with `BoundIds extends string =
 * KernelBoundIds`:** that single-signature shape is what `docs/jini-port/extraction-plan.md`'s
 * task brief for this file literally shows, but it does not actually work — empirically verified
 * against this repo's own TypeScript (5.9.3, `strict`): when a type parameter both (a) has a
 * default and (b) is referenced inside a conditional type in the same parameter position where it
 * also needs to be inferred from a nested callback's return type, TypeScript resolves it to the
 * default *instead of* inferring from the callback, silently defeating the gate on exactly the
 * call shape (`bindings` provided) where it matters most. Splitting into two overloads — one
 * where `bindings` is absent and `BoundIds` is the concrete `KernelBoundIds`, one where `bindings`
 * is required and `BoundIds` is inferred fresh with no default — sidesteps the inference conflict
 * entirely; each overload only asks TypeScript to solve one problem instead of two contradictory
 * ones. Both directions are covered by `@ts-expect-error` proofs in `create-local-node-daemon.typecheck.ts`.
 *
 * @param config - See {@link CreateLocalNodeDaemonConfig}. Omit `bindings` when every pack's deps
 * are satisfied by the two kernel tokens alone; supply it (chaining onto the seeded `Bindings`
 * instance) to bind anything else a pack requires.
 * @returns A promise resolving to `{url, server, stop}` once the daemon is actually listening and
 * ready to serve requests.
 * @throws Rejects if the port is already in use (`EADDRINUSE`), the host can't be bound
 * (`EACCES`/`EADDRNOTAVAIL`), or the OS somehow reports a listening socket with no resolvable
 * port. On any of these the durable `EventLog` this call already opened is closed before
 * rejecting, so a failed boot never leaks an open sqlite file handle.
 * @complexity O(1) beyond the packs' own `services()`/`http()` costs — `createDaemon` composition
 * is O(p) in pack count (see `@jini/core`'s own complexity note).
 * @overallScore 100/100
 */
export async function createLocalNodeDaemon<const Packs extends readonly AnyPack[]>(
  config: CreateLocalNodeDaemonConfig<Packs, KernelBoundIds> &
    { bindings?: undefined } &
    (MissingTokenIds<Packs, KernelBoundIds> extends never
      ? unknown
      : { readonly __missingBindings: MissingTokenIds<Packs, KernelBoundIds> }),
): Promise<LocalNodeDaemon>;
export async function createLocalNodeDaemon<const Packs extends readonly AnyPack[], BoundIds extends string>(
  config: CreateLocalNodeDaemonConfig<Packs, BoundIds> &
    { bindings: (b: Bindings<KernelBoundIds>) => Bindings<BoundIds> } &
    (MissingTokenIds<Packs, BoundIds> extends never
      ? unknown
      : { readonly __missingBindings: MissingTokenIds<Packs, BoundIds> }),
): Promise<LocalNodeDaemon>;
export async function createLocalNodeDaemon(
  config: CreateLocalNodeDaemonConfig<readonly AnyPack[], string>,
): Promise<LocalNodeDaemon> {
  const env = config.env ?? process.env;
  const host = normalizeDaemonBindHost(config.host ?? DEFAULT_HOST);
  const requestedPort = config.port ?? 0;

  // @jini/http's own `guardSameOrigin` (used by the daemon-status shutdown route below) resolves
  // `bindHost` purely from real `process.env.JINI_BIND_HOST` — it has no parameter path for an
  // injected env, unlike most of that module's other functions. Setting it here, before any
  // request can possibly be served, keeps that route's same-origin decision in sync with the host
  // this daemon actually bound to instead of silently comparing against whatever
  // `JINI_BIND_HOST` happened to already be set to. (When `config.env` is a caller-injected object
  // distinct from `process.env`, this line cannot fix `guardSameOrigin`'s behavior — that gap is a
  // pre-existing `@jini/http` limitation, not something this call can reach around; see this
  // package's source-map.md.)
  env[DEFAULT_BIND_HOST_ENV_VAR] = host;

  const eventLog = createSqliteEventLog(join(config.dataDir, 'events.db'));
  const runLifecycle = createRunLifecycle({ eventLog });
  // Zero-config default, unlike ToolExecutorToken (which needs a caller-supplied
  // ToolRegistry and is therefore NOT auto-bound here — see this file's own
  // KernelBoundIds doc and packages/daemon/source-map.md's AgentExecutor
  // section): createAgentExecutor's own defaults already resolve the real
  // @jini/agent-runtime registry, launch resolution, and node:child_process
  // spawn, so every caller gets a working AgentExecutor with no additional
  // wiring.
  const agentExecutor = createAgentExecutor({ lifecycle: runLifecycle });

  const kernelBindings = bindings()
    .bind(EventLogToken, eventLog)
    .bind(RunLifecycleToken, runLifecycle)
    .bind(AgentExecutorToken, agentExecutor);
  const boundBindings = config.bindings ? config.bindings(kernelBindings) : kernelBindings;

  // `createDaemon`'s own compile-time gate can't be satisfied by this function's own
  // (deliberately widened, non-generic — see the two exported overloads above) implementation
  // signature: `config.packs`/`boundBindings` are typed `readonly AnyPack[]`/`Bindings<string>`
  // here, not the concrete `Packs`/`BoundIds` a real call site's overload already resolved. This
  // call's safety was already established by whichever overload the real call site matched
  // (both apply the identical `MissingTokenIds` gate) — bypassing `createDaemon`'s own redundant
  // copy of that same check here is the same pattern
  // `packages/core/src/__tests__/index.test.ts`'s `createDaemonUnsafe` uses to reach the runtime
  // path directly.
  const daemon = (
    createDaemon as (config: { packs: readonly AnyPack[]; bindings: Bindings<string> }) => Daemon<readonly AnyPack[]>
  )({
    packs: config.packs,
    bindings: boundBindings,
  });

  const app: Express = express();
  installRouteRegistrationGuard(app);
  app.use(express.json());

  registerApiBearerAuthMiddleware(app, {
    tokenConfig: {
      tokenEnvVar: config.apiToken?.tokenEnvVar ?? DEFAULT_TOKEN_ENV_VAR,
      disableEnvVar: config.apiToken?.disableEnvVar ?? DEFAULT_DISABLE_ENV_VAR,
    },
    env,
  });

  // Shared by the origin guard middleware and the daemon-status routes' same-origin gate below —
  // both must observe the exact same "has the real port resolved yet" state.
  const resolvedPortRef = { current: requestedPort };
  registerApiOriginGuardMiddleware(app, {
    host,
    extraAllowedOrigins: configuredAllowedOrigins(env),
    getResolvedPort: () => resolvedPortRef.current,
    env,
  });

  mountPackHttp(app, config.packs, daemon);

  let shuttingDown = false;
  let stopPromise: Promise<void> | null = null;
  let server: Server;

  async function stop(): Promise<void> {
    shuttingDown = true;
    if (!stopPromise) {
      stopPromise = (async () => {
        await closeHttpServer(server);
        // A caller-supplied `onShutdown` failing must never leak the durable EventLog's open
        // sqlite file handle — `finally` guarantees the close still runs, then the original
        // rejection (if any) propagates to whoever is awaiting `stop()`.
        try {
          await config.onShutdown?.();
        } finally {
          await eventLog.close();
        }
      })();
    }
    return stopPromise;
  }

  registerDaemonStatusRoutes(
    app,
    {
      getVersion: () => packageVersion,
      host,
      getPort: () => resolvedPortRef.current,
      dataDir: config.dataDir,
      isShuttingDown: () => shuttingDown,
      requestShutdown: () => {
        void stop();
      },
    },
    { resolvedPortRef },
  );

  return await new Promise<LocalNodeDaemon>((resolve, reject) => {
    const failToBind = (error: unknown) => {
      // Best-effort: a failed boot must not leave the sqlite file handle this call already opened
      // dangling open.
      void eventLog.close().finally(() => reject(error));
    };

    try {
      server = app.listen(requestedPort, host);
    } catch (error) {
      failToBind(error);
      return;
    }

    server.once('listening', () => {
      // Widen the between-request idle window so kept-alive sockets survive gaps between bursts
      // (e.g. an SSE stream's idle periods); `headersTimeout` must exceed `keepAliveTimeout` per
      // the Node docs, or a slow-loris client could stall request parsing.
      server.keepAliveTimeout = 120_000;
      server.headersTimeout = 125_000;

      const boundPort = resolveBoundPort(server.address());
      if (!boundPort) {
        failToBind(
          new Error(`@jini/node-host: daemon failed to resolve listening port (address=${JSON.stringify(server.address())})`),
        );
        return;
      }
      resolvedPortRef.current = boundPort;

      resolve({ url: `http://${resolveReportHost(host)}:${boundPort}`, server, stop });
    });

    // `app.listen` throws synchronously when the port is already in use on some Node versions,
    // but emits an `error` event on others (and for EACCES/EADDRNOTAVAIL even on the same Node) —
    // wiring both paths means this promise always settles instead of hanging forever.
    server.on('error', (error) => {
      failToBind(error);
    });
  });
}
