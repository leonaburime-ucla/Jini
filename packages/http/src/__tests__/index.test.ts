import { describe, expect, it } from 'vitest';
import * as HttpBarrel from '../index.js';

/**
 * A barrel-only smoke test: every other test in this package imports its target
 * module directly, so the root barrel itself was never actually exercised.
 * Proves the public surface a host actually imports (`from '@jini/http'`) really
 * re-exports what `source-map.md` documents — the shared, framework-agnostic root
 * exports directly, and both transport-specific namespaces (`express`/`fastify`)
 * as sub-barrels a consumer must pick explicitly.
 */
describe('@jini/http barrel', () => {
  it('re-exports the Result helpers', () => {
    expect(typeof HttpBarrel.ok).toBe('function');
    expect(typeof HttpBarrel.err).toBe('function');
  });

  it('re-exports the origin-validation predicates, including the same-origin guard', () => {
    expect(typeof HttpBarrel.isLocalSameOrigin).toBe('function');
    expect(typeof HttpBarrel.isAllowedBrowserOrigin).toBe('function');
    expect(typeof HttpBarrel.allowedBrowserPorts).toBe('function');
    expect(typeof HttpBarrel.configuredAllowedOrigins).toBe('function');
  });

  it('re-exports the pack-http registrar', () => {
    expect(typeof HttpBarrel.mountPackHttp).toBe('function');
  });

  it('re-exports run lifecycle HTTP routes and registrars', () => {
    expect(HttpBarrel.runStartRoute.path).toBe('/api/runs');
    expect(HttpBarrel.runStatusRoute.path).toBe('/api/runs/:runId');
    expect(HttpBarrel.runCancelRoute.path).toBe('/api/runs/:runId/cancel');
    expect(typeof HttpBarrel.registerRunEventStream).toBe('function');
    expect(typeof HttpBarrel.registerRunRoutes).toBe('function');
  });

  it('re-exports the compat error helpers', () => {
    expect(typeof HttpBarrel.createCompatApiError).toBe('function');
    expect(typeof HttpBarrel.createCompatApiErrorResponse).toBe('function');
    expect(typeof HttpBarrel.sendCompatApiError).toBe('function');
  });

  it('also re-exports the Express-mounting Adapter and security middleware flat at the root, unlike the fastify namespace which is opt-in only (every existing consumer imports these directly, not via a namespace)', () => {
    expect(typeof HttpBarrel.mountJsonRoute).toBe('function');
    expect(typeof HttpBarrel.registerApiBearerAuthMiddleware).toBe('function');
    expect(typeof HttpBarrel.express.sendJson).toBe('function');
  });

  describe('express namespace', () => {
    it('re-exports request/response helpers', () => {
      expect(typeof HttpBarrel.express.rawInput).toBe('function');
      expect(typeof HttpBarrel.express.validationError).toBe('function');
      expect(typeof HttpBarrel.express.sendApiError).toBe('function');
      expect(typeof HttpBarrel.express.sendJson).toBe('function');
      expect(typeof HttpBarrel.express.statusForError).toBe('function');
    });

    it('re-exports the origin guard', () => {
      expect(typeof HttpBarrel.express.guardSameOrigin).toBe('function');
    });

    it('re-exports the Adapter', () => {
      expect(typeof HttpBarrel.express.defineJsonRoute).toBe('function');
      expect(typeof HttpBarrel.express.mountJsonRoute).toBe('function');
    });

    it('re-exports the compat error helpers', () => {
      expect(typeof HttpBarrel.express.createCompatApiError).toBe('function');
      expect(typeof HttpBarrel.express.createCompatApiErrorResponse).toBe('function');
      expect(typeof HttpBarrel.express.sendCompatApiError).toBe('function');
    });

    it('re-exports the daemon-status routes and registrar', () => {
      expect(typeof HttpBarrel.express.registerDaemonStatusRoutes).toBe('function');
      expect(HttpBarrel.express.daemonStatusRoute.path).toBe('/api/daemon/status');
      expect(HttpBarrel.express.daemonShutdownRoute.path).toBe('/api/daemon/shutdown');
    });

    it('re-exports the local-daemon-request helpers', () => {
      expect(typeof HttpBarrel.express.requireLocalDaemonRequest).toBe('function');
      expect(typeof HttpBarrel.express.validateLocalDaemonRequest).toBe('function');
      expect(typeof HttpBarrel.express.normalizeLocalAuthority).toBe('function');
      expect(typeof HttpBarrel.express.isLoopbackHostname).toBe('function');
      expect(typeof HttpBarrel.express.isLoopbackPeerAddress).toBe('function');
      expect(typeof HttpBarrel.express.localOriginFromHeader).toBe('function');
    });

    it('re-exports the api security middlewares', () => {
      expect(typeof HttpBarrel.express.registerApiBearerAuthMiddleware).toBe('function');
      expect(typeof HttpBarrel.express.registerApiOriginGuardMiddleware).toBe('function');
    });

    it('re-exports the route-registration guard', () => {
      expect(typeof HttpBarrel.express.installRouteRegistrationGuard).toBe('function');
      expect(typeof HttpBarrel.express.getRouteRegistrationInventory).toBe('function');
      expect(typeof HttpBarrel.express.guardedRouteKey).toBe('function');
    });

    it('re-exports runs/agents/host-tools registrars, the same functions the root barrel exports', () => {
      expect(HttpBarrel.express.registerRunRoutes).toBe(HttpBarrel.registerRunRoutes);
      expect(HttpBarrel.express.registerAgentRoutes).toBe(HttpBarrel.registerAgentRoutes);
      expect(HttpBarrel.express.registerHostToolsRoutes).toBe(HttpBarrel.registerHostToolsRoutes);
    });
  });

  describe('fastify namespace', () => {
    it('re-exports request/response helpers', () => {
      expect(typeof HttpBarrel.fastify.rawInput).toBe('function');
      expect(typeof HttpBarrel.fastify.validationError).toBe('function');
      expect(typeof HttpBarrel.fastify.sendApiError).toBe('function');
      expect(typeof HttpBarrel.fastify.sendJson).toBe('function');
      expect(typeof HttpBarrel.fastify.statusForError).toBe('function');
    });

    it('re-exports the origin guard', () => {
      expect(typeof HttpBarrel.fastify.guardSameOrigin).toBe('function');
    });

    it('re-exports the Adapter', () => {
      expect(typeof HttpBarrel.fastify.defineJsonRoute).toBe('function');
      expect(typeof HttpBarrel.fastify.mountJsonRoute).toBe('function');
    });

    it('re-exports the compat error helpers', () => {
      expect(typeof HttpBarrel.fastify.createCompatApiError).toBe('function');
      expect(typeof HttpBarrel.fastify.createCompatApiErrorResponse).toBe('function');
      expect(typeof HttpBarrel.fastify.sendCompatApiError).toBe('function');
    });

    it('re-exports the daemon-status routes and registrar, sharing the same route specs as the express namespace', () => {
      expect(typeof HttpBarrel.fastify.registerDaemonStatusRoutes).toBe('function');
      expect(HttpBarrel.fastify.daemonStatusRoute.path).toBe('/api/daemon/status');
      expect(HttpBarrel.fastify.daemonShutdownRoute.path).toBe('/api/daemon/shutdown');
      expect(HttpBarrel.fastify.daemonStatusRoute).toBe(HttpBarrel.express.daemonStatusRoute);
      expect(HttpBarrel.fastify.daemonShutdownRoute).toBe(HttpBarrel.express.daemonShutdownRoute);
    });

    it('re-exports the local-daemon-request helpers', () => {
      expect(typeof HttpBarrel.fastify.requireLocalDaemonRequest).toBe('function');
      expect(typeof HttpBarrel.fastify.validateLocalDaemonRequest).toBe('function');
      expect(typeof HttpBarrel.fastify.normalizeLocalAuthority).toBe('function');
      expect(typeof HttpBarrel.fastify.isLoopbackHostname).toBe('function');
      expect(typeof HttpBarrel.fastify.isLoopbackPeerAddress).toBe('function');
      expect(typeof HttpBarrel.fastify.localOriginFromHeader).toBe('function');
    });

    it('re-exports the api security middlewares', () => {
      expect(typeof HttpBarrel.fastify.registerApiBearerAuthMiddleware).toBe('function');
      expect(typeof HttpBarrel.fastify.registerApiOriginGuardMiddleware).toBe('function');
    });

    it('re-exports the route-registration guard', () => {
      expect(typeof HttpBarrel.fastify.installRouteRegistrationGuard).toBe('function');
      expect(typeof HttpBarrel.fastify.getRouteRegistrationInventory).toBe('function');
      expect(typeof HttpBarrel.fastify.guardedRouteKey).toBe('function');
    });

    it('mounts real Fastify-native registrars for runs/agents/host-tools, distinct functions from the express namespace but real (not stubs)', () => {
      expect(typeof HttpBarrel.fastify.registerRunRoutes).toBe('function');
      expect(typeof HttpBarrel.fastify.registerRunEventStream).toBe('function');
      expect(typeof HttpBarrel.fastify.registerAgentRoutes).toBe('function');
      expect(typeof HttpBarrel.fastify.registerHostToolsRoutes).toBe('function');
      expect(HttpBarrel.fastify.registerRunRoutes).not.toBe(HttpBarrel.express.registerRunRoutes);
      expect(HttpBarrel.fastify.registerAgentRoutes).not.toBe(HttpBarrel.express.registerAgentRoutes);
      expect(HttpBarrel.fastify.registerHostToolsRoutes).not.toBe(HttpBarrel.express.registerHostToolsRoutes);
    });
  });

  it('re-exports cancelRunsOwnedBy', () => {
    expect(typeof HttpBarrel.cancelRunsOwnedBy).toBe('function');
  });

  it('re-exports the host-tools editors route and registrar', () => {
    expect(typeof HttpBarrel.registerHostToolsRoutes).toBe('function');
    expect(HttpBarrel.hostEditorsRoute.path).toBe('/api/editors');
  });

  it('re-exports the active-context routes and registrar', () => {
    expect(typeof HttpBarrel.registerActiveContextRoutes).toBe('function');
    expect(HttpBarrel.setActiveRoute.path).toBe('/api/active');
    expect(HttpBarrel.getActiveRoute.path).toBe('/api/active');
    expect(HttpBarrel.ACTIVE_CONTEXT_TTL_MS).toBe(5 * 60 * 1000);
  });

  it('re-exports the generic SSE primitive', () => {
    expect(typeof HttpBarrel.createSseChannel).toBe('function');
    expect(typeof HttpBarrel.requestedAfterCursor).toBe('function');
    expect(typeof HttpBarrel.sendRawApiError).toBe('function');
    expect(HttpBarrel.DEFAULT_MAX_QUEUED_SSE_EVENTS).toBe(1000);
  });

  it('re-exports the framework-agnostic raw SSE primitive (a distinct mechanism from createSseChannel, shared by both transports own run-stream mounting)', () => {
    expect(typeof HttpBarrel.createSseResponse).toBe('function');
  });

  it('re-exports the AG-UI run-stream route core', () => {
    expect(typeof HttpBarrel.handleRunStreamRequest).toBe('function');
    expect(HttpBarrel.RUN_STREAM_ROUTE_PATH).toBe('/api/runs/:runId/agui-stream');
  });

  it('re-exports the workspace-root port', () => {
    expect(typeof HttpBarrel.resolveWorkspaceRoot).toBe('function');
    expect(typeof HttpBarrel.denyAllWorkspaceRoots).toBe('function');
    expect(HttpBarrel.WorkspaceRootDeniedError).toBeDefined();
  });

  it('re-exports the daemon DB-ops routes and tool registrar', () => {
    expect(typeof HttpBarrel.createDaemonDbToolRegistrations).toBe('function');
    expect(typeof HttpBarrel.registerDaemonDbRoutes).toBe('function');
    expect(HttpBarrel.daemonDbInspectRoute.path).toBe('/api/daemon/db');
    expect(HttpBarrel.daemonDbVerifyRoute.path).toBe('/api/daemon/db/verify');
    expect(HttpBarrel.daemonDbVacuumRoute.path).toBe('/api/daemon/db/vacuum');
    expect(HttpBarrel.DB_INSPECT_TOOL_ID).toBe('daemon.db.inspect');
  });
});
