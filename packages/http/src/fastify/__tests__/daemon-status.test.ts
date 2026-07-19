import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isLocalSameOrigin } from '../../origin-validation.js';
import * as ExpressDaemonStatus from '../../express/daemon-status.js';
import {
  daemonShutdownRoute,
  daemonStatusRoute,
  registerDaemonStatusRoutes,
  type DaemonStatusDeps,
} from '../daemon-status.js';

vi.mock('../../origin-validation.js', () => ({
  isLocalSameOrigin: vi.fn(() => true),
}));

interface RouteCall {
  method: string;
  url: string;
  handler: (req: any, reply: any) => Promise<void> | void;
}

function makeApp() {
  const handlers: Record<string, RouteCall['handler']> = {};
  const app = {
    route: (opts: RouteCall) => {
      handlers[`${opts.method} ${opts.url}`] = opts.handler;
    },
  };
  return { app, handlers };
}

function makeReply() {
  return {
    code: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
}

const adapter = { resolvedPortRef: { current: 7456 } };

function makeDeps(overrides: Partial<DaemonStatusDeps> = {}): DaemonStatusDeps {
  return {
    getVersion: () => '1.2.3',
    host: '127.0.0.1',
    getPort: () => 7456,
    dataDir: '/tmp/data',
    isShuttingDown: () => false,
    requestShutdown: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(isLocalSameOrigin).mockReturnValue(true);
});

describe('fastify daemon-status re-exports', () => {
  it('reuses the exact same route-spec objects as the express module (no duplication)', () => {
    expect(daemonStatusRoute).toBe(ExpressDaemonStatus.daemonStatusRoute);
    expect(daemonShutdownRoute).toBe(ExpressDaemonStatus.daemonShutdownRoute);
  });
});

describe('registerDaemonStatusRoutes (fastify)', () => {
  it('mounts exactly the status and shutdown routes, nothing else', () => {
    const { app, handlers } = makeApp();
    registerDaemonStatusRoutes(app as any, makeDeps(), adapter);
    expect(Object.keys(handlers).sort()).toEqual(
      ['GET /api/daemon/status', 'POST /api/daemon/shutdown'].sort(),
    );
  });

  it('serves the mounted status route through the Fastify adapter pipeline', async () => {
    const { app, handlers } = makeApp();
    registerDaemonStatusRoutes(app as any, makeDeps(), adapter);
    const reply = makeReply();
    await handlers['GET /api/daemon/status']!({ body: {}, query: {}, params: {} }, reply);
    expect(reply.code).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, version: '1.2.3', host: '127.0.0.1', port: 7456 }),
    );
  });

  it('requires same-origin on the mounted shutdown route: blocks a cross-origin request with 403', async () => {
    vi.mocked(isLocalSameOrigin).mockReturnValue(false);
    const { app, handlers } = makeApp();
    const requestShutdown = vi.fn();
    registerDaemonStatusRoutes(app as any, makeDeps({ requestShutdown }), adapter);
    const reply = makeReply();
    await handlers['POST /api/daemon/shutdown']!({ body: {}, query: {}, params: {} }, reply);
    expect(reply.code).toHaveBeenCalledWith(403);
    await new Promise((resolve) => setImmediate(resolve));
    expect(requestShutdown).not.toHaveBeenCalled();
  });

  it('allows a same-origin shutdown request through and schedules requestShutdown', async () => {
    vi.mocked(isLocalSameOrigin).mockReturnValue(true);
    const { app, handlers } = makeApp();
    const requestShutdown = vi.fn();
    registerDaemonStatusRoutes(app as any, makeDeps({ requestShutdown }), adapter);
    const reply = makeReply();
    await handlers['POST /api/daemon/shutdown']!({ body: {}, query: {}, params: {} }, reply);
    expect(reply.code).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({ ok: true, scheduled: true });
  });
});
