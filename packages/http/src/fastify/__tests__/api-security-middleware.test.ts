import { describe, expect, it, vi } from 'vitest';
import {
  registerApiBearerAuthMiddleware,
  registerApiOriginGuardMiddleware,
} from '../api-security-middleware.js';

type OnRequestHook = (req: any, reply: any, done: (err?: Error) => void) => void;

/** A minimal Fastify-instance fake: `addHook('onRequest', handler)` is the only method either
 * hook-registrar calls. */
function makeApp() {
  const hooks: OnRequestHook[] = [];
  const app = {
    addHook: (name: string, handler: OnRequestHook) => {
      if (name === 'onRequest') hooks.push(handler);
    },
  };
  return { app, hooks };
}

function makeReq(overrides: {
  method?: string;
  path?: string;
  remoteAddress?: string | undefined;
  authorization?: string;
  origin?: string;
  host?: string;
} = {}) {
  const path = overrides.path ?? '/api/whatever';
  const headers: Record<string, string> = {};
  if (overrides.authorization !== undefined) headers.authorization = overrides.authorization;
  if (overrides.origin !== undefined) headers.origin = overrides.origin;
  if (overrides.host !== undefined) headers.host = overrides.host;
  return {
    method: overrides.method ?? 'GET',
    url: path,
    headers,
    socket: { remoteAddress: overrides.remoteAddress },
  };
}

function makeReply() {
  return {
    code: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
}

describe('registerApiBearerAuthMiddleware', () => {
  it('registers no hook at all when no token is configured', () => {
    const { app, hooks } = makeApp();
    registerApiBearerAuthMiddleware(app as any, { env: {} });
    expect(hooks).toHaveLength(0);
  });

  it('registers no hook when a token is configured but auth is disabled', () => {
    const { app, hooks } = makeApp();
    registerApiBearerAuthMiddleware(app as any, {
      env: { JINI_API_TOKEN: 'secret', JINI_DISABLE_API_AUTH: '1' },
    });
    expect(hooks).toHaveLength(0);
  });

  it('registers a hook once a token is configured and auth is not disabled', () => {
    const { app, hooks } = makeApp();
    registerApiBearerAuthMiddleware(app as any, { env: { JINI_API_TOKEN: 'secret' } });
    expect(hooks).toHaveLength(1);
  });

  it('lets a matching bearer token through', () => {
    const { app, hooks } = makeApp();
    registerApiBearerAuthMiddleware(app as any, { env: { JINI_API_TOKEN: 'secret' } });
    const done = vi.fn();
    const reply = makeReply();
    hooks[0]!(makeReq({ authorization: 'Bearer secret', remoteAddress: '203.0.113.9' }), reply, done);
    expect(done).toHaveBeenCalledOnce();
    expect(reply.code).not.toHaveBeenCalled();
  });

  it('does not gate a request whose path is not under /api at all (manual scoping)', () => {
    const { app, hooks } = makeApp();
    registerApiBearerAuthMiddleware(app as any, { env: { JINI_API_TOKEN: 'secret' } });
    const done = vi.fn();
    hooks[0]!(makeReq({ path: '/not-api', remoteAddress: '203.0.113.9' }), makeReply(), done);
    expect(done).toHaveBeenCalledOnce();
  });

  it('rejects a missing Authorization header with 401 API_TOKEN_REQUIRED', () => {
    const { app, hooks } = makeApp();
    registerApiBearerAuthMiddleware(app as any, { env: { JINI_API_TOKEN: 'secret' } });
    const done = vi.fn();
    const reply = makeReply();
    hooks[0]!(makeReq({ remoteAddress: '203.0.113.9' }), reply, done);
    expect(done).not.toHaveBeenCalled();
    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({
      error: { code: 'API_TOKEN_REQUIRED', message: 'Authorization: Bearer <JINI_API_TOKEN> required' },
    });
  });

  it('rejects a mismatched bearer token with 401', () => {
    const { app, hooks } = makeApp();
    registerApiBearerAuthMiddleware(app as any, { env: { JINI_API_TOKEN: 'secret' } });
    const done = vi.fn();
    const reply = makeReply();
    hooks[0]!(makeReq({ authorization: 'Bearer wrong-token', remoteAddress: '203.0.113.9' }), reply, done);
    expect(reply.code).toHaveBeenCalledWith(401);
    expect(done).not.toHaveBeenCalled();
  });

  it('rejects a malformed Authorization header (no Bearer prefix) with 401', () => {
    const { app, hooks } = makeApp();
    registerApiBearerAuthMiddleware(app as any, { env: { JINI_API_TOKEN: 'secret' } });
    const done = vi.fn();
    const reply = makeReply();
    hooks[0]!(makeReq({ authorization: 'Basic secret', remoteAddress: '203.0.113.9' }), reply, done);
    expect(reply.code).toHaveBeenCalledWith(401);
    expect(done).not.toHaveBeenCalled();
  });

  it('exempts a loopback peer even with no Authorization header', () => {
    const { app, hooks } = makeApp();
    registerApiBearerAuthMiddleware(app as any, { env: { JINI_API_TOKEN: 'secret' } });
    const done = vi.fn();
    hooks[0]!(makeReq({ remoteAddress: '127.0.0.1' }), makeReply(), done);
    expect(done).toHaveBeenCalledOnce();
  });

  it.each(['/health', '/api/health', '/ready', '/api/ready', '/version', '/api/version'])(
    'exempts the open probe path %s with no Authorization header',
    (path) => {
      const { app, hooks } = makeApp();
      registerApiBearerAuthMiddleware(app as any, { env: { JINI_API_TOKEN: 'secret' } });
      const done = vi.fn();
      // Only the /api-prefixed forms are actually reachable (both hooks require the path to start
      // with /api before this set is even consulted — see the module's own doc) — force the path
      // under /api so every table entry still exercises the OPEN_PROBE_PATHS membership check.
      const scopedPath = path.startsWith('/api') ? path : `/api${path}`;
      hooks[0]!(makeReq({ path: scopedPath, remoteAddress: '203.0.113.9' }), makeReply(), done);
      expect(done).toHaveBeenCalledOnce();
    },
  );

  it('does not exempt a non-probe path for a non-loopback peer', () => {
    const { app, hooks } = makeApp();
    registerApiBearerAuthMiddleware(app as any, { env: { JINI_API_TOKEN: 'secret' } });
    const done = vi.fn();
    const reply = makeReply();
    hooks[0]!(makeReq({ path: '/api/runs', remoteAddress: '203.0.113.9' }), reply, done);
    expect(reply.code).toHaveBeenCalledWith(401);
  });

  it('strips the query string before comparing against OPEN_PROBE_PATHS', () => {
    const { app, hooks } = makeApp();
    registerApiBearerAuthMiddleware(app as any, { env: { JINI_API_TOKEN: 'secret' } });
    const done = vi.fn();
    hooks[0]!(makeReq({ path: '/api/health?verbose=1', remoteAddress: '203.0.113.9' }), makeReply(), done);
    expect(done).toHaveBeenCalledOnce();
  });

  it('honors a custom tokenConfig env var pair', () => {
    const { app, hooks } = makeApp();
    registerApiBearerAuthMiddleware(app as any, {
      tokenConfig: { tokenEnvVar: 'CUSTOM_TOKEN', disableEnvVar: 'CUSTOM_DISABLE' },
      env: { CUSTOM_TOKEN: 'xyz' },
    });
    const done = vi.fn();
    hooks[0]!(makeReq({ authorization: 'Bearer xyz', remoteAddress: '203.0.113.9' }), makeReply(), done);
    expect(done).toHaveBeenCalledOnce();
  });

  it('defaults env to real process.env when omitted entirely', () => {
    const original = process.env.JINI_API_TOKEN;
    try {
      delete process.env.JINI_API_TOKEN;
      const { app, hooks } = makeApp();
      registerApiBearerAuthMiddleware(app as any);
      expect(hooks).toHaveLength(0);
    } finally {
      if (original === undefined) delete process.env.JINI_API_TOKEN;
      else process.env.JINI_API_TOKEN = original;
    }
  });
});

describe('registerApiOriginGuardMiddleware', () => {
  const baseDeps = { host: '127.0.0.1', getResolvedPort: () => 7456, env: {} };

  it('always registers exactly one hook (no disabled state)', () => {
    const { app, hooks } = makeApp();
    registerApiOriginGuardMiddleware(app as any, baseDeps);
    expect(hooks).toHaveLength(1);
  });

  it('does not gate a request whose path is not under /api at all (manual scoping)', () => {
    const { app, hooks } = makeApp();
    registerApiOriginGuardMiddleware(app as any, baseDeps);
    const done = vi.fn();
    hooks[0]!(makeReq({ path: '/not-api', method: 'POST', origin: 'https://evil.example.com' }), makeReply(), done);
    expect(done).toHaveBeenCalledOnce();
  });

  it('allows a non-browser client (no Origin header) through, any method', () => {
    const { app, hooks } = makeApp();
    registerApiOriginGuardMiddleware(app as any, baseDeps);
    const done = vi.fn();
    hooks[0]!(makeReq({ method: 'POST' }), makeReply(), done);
    expect(done).toHaveBeenCalledOnce();
  });

  it('rejects Origin: null with 403, regardless of method or path', () => {
    const { app, hooks } = makeApp();
    registerApiOriginGuardMiddleware(app as any, baseDeps);
    const done = vi.fn();
    const reply = makeReply();
    hooks[0]!(makeReq({ origin: 'null', method: 'GET' }), reply, done);
    expect(reply.code).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Origin: null not allowed for this route' });
    expect(done).not.toHaveBeenCalled();
  });

  it('fails closed with 403 "Server initializing" while the port has not resolved yet', () => {
    const { app, hooks } = makeApp();
    registerApiOriginGuardMiddleware(app as any, { ...baseDeps, getResolvedPort: () => 0 });
    const done = vi.fn();
    const reply = makeReply();
    hooks[0]!(makeReq({ origin: 'http://127.0.0.1:7456', host: '127.0.0.1:7456' }), reply, done);
    expect(reply.code).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Server initializing' });
    expect(done).not.toHaveBeenCalled();
  });

  it('allows a loopback origin matching the resolved port and Host header', () => {
    const { app, hooks } = makeApp();
    registerApiOriginGuardMiddleware(app as any, baseDeps);
    const done = vi.fn();
    hooks[0]!(makeReq({ origin: 'http://127.0.0.1:7456', host: '127.0.0.1:7456' }), makeReply(), done);
    expect(done).toHaveBeenCalledOnce();
  });

  it('allows an origin present in extraAllowedOrigins even if it would not otherwise match', () => {
    const { app, hooks } = makeApp();
    registerApiOriginGuardMiddleware(app as any, {
      ...baseDeps,
      extraAllowedOrigins: ['https://proxy.example.com'],
    });
    const done = vi.fn();
    hooks[0]!(makeReq({ origin: 'https://proxy.example.com', host: 'proxy.example.com' }), makeReply(), done);
    expect(done).toHaveBeenCalledOnce();
  });

  it('rejects a disallowed non-GET cross-origin request with 403', () => {
    const { app, hooks } = makeApp();
    registerApiOriginGuardMiddleware(app as any, baseDeps);
    const done = vi.fn();
    const reply = makeReply();
    hooks[0]!(makeReq({ method: 'POST', origin: 'https://evil.example.com', host: '127.0.0.1:7456' }), reply, done);
    expect(reply.code).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Cross-origin requests are not allowed' });
    expect(done).not.toHaveBeenCalled();
  });

  it('rejects a disallowed GET cross-origin request that is not a portless-loopback origin', () => {
    const { app, hooks } = makeApp();
    registerApiOriginGuardMiddleware(app as any, baseDeps);
    const done = vi.fn();
    const reply = makeReply();
    hooks[0]!(makeReq({ method: 'GET', origin: 'https://evil.example.com', host: '127.0.0.1:7456' }), reply, done);
    expect(reply.code).toHaveBeenCalledWith(403);
    expect(done).not.toHaveBeenCalled();
  });

  it('falls back to allowing a disallowed-but-portless-loopback origin on GET only', () => {
    const { app, hooks } = makeApp();
    registerApiOriginGuardMiddleware(app as any, baseDeps);
    const done = vi.fn();
    hooks[0]!(makeReq({ method: 'GET', origin: 'http://127.0.0.1', host: '127.0.0.1:7456' }), makeReply(), done);
    expect(done).toHaveBeenCalledOnce();
  });

  it('does not extend the portless-loopback fallback to non-GET methods', () => {
    const { app, hooks } = makeApp();
    registerApiOriginGuardMiddleware(app as any, baseDeps);
    const done = vi.fn();
    const reply = makeReply();
    hooks[0]!(makeReq({ method: 'DELETE', origin: 'http://127.0.0.1', host: '127.0.0.1:7456' }), reply, done);
    expect(reply.code).toHaveBeenCalledWith(403);
    expect(done).not.toHaveBeenCalled();
  });

  it('reads JINI_WEB_PORT from the injected env, not real process.env', () => {
    const { app, hooks } = makeApp();
    registerApiOriginGuardMiddleware(app as any, {
      host: '127.0.0.1',
      getResolvedPort: () => 7456,
      env: { JINI_WEB_PORT: '4321' },
    });
    const done = vi.fn();
    hooks[0]!(makeReq({ origin: 'http://127.0.0.1:4321', host: '127.0.0.1:4321' }), makeReply(), done);
    expect(done).toHaveBeenCalledOnce();
  });

  it('defaults env to real process.env when omitted entirely', () => {
    const original = process.env.JINI_WEB_PORT;
    try {
      delete process.env.JINI_WEB_PORT;
      const { app, hooks } = makeApp();
      registerApiOriginGuardMiddleware(app as any, { host: '127.0.0.1', getResolvedPort: () => 7456 });
      const done = vi.fn();
      hooks[0]!(makeReq({ origin: 'http://127.0.0.1:7456', host: '127.0.0.1:7456' }), makeReply(), done);
      expect(done).toHaveBeenCalledOnce();
    } finally {
      if (original === undefined) delete process.env.JINI_WEB_PORT;
      else process.env.JINI_WEB_PORT = original;
    }
  });
});
