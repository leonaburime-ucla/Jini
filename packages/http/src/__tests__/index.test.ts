import { describe, expect, it } from 'vitest';
import * as HttpBarrel from '../index.js';

/**
 * A barrel-only smoke test: every other test in this package imports its target
 * module directly, so the root barrel itself was never actually exercised.
 * Proves the public surface a host actually imports (`from '@jini/http'`) really
 * re-exports what `source-map.md` documents.
 */
describe('@jini/http barrel', () => {
  it('re-exports the Result helpers', () => {
    expect(typeof HttpBarrel.ok).toBe('function');
    expect(typeof HttpBarrel.err).toBe('function');
  });

  it('re-exports request/response helpers', () => {
    expect(typeof HttpBarrel.rawInput).toBe('function');
    expect(typeof HttpBarrel.validationError).toBe('function');
    expect(typeof HttpBarrel.sendApiError).toBe('function');
    expect(typeof HttpBarrel.sendJson).toBe('function');
    expect(typeof HttpBarrel.statusForError).toBe('function');
  });

  it('re-exports the origin guard', () => {
    expect(typeof HttpBarrel.guardSameOrigin).toBe('function');
    expect(typeof HttpBarrel.isLocalSameOrigin).toBe('function');
  });

  it('re-exports the Adapter', () => {
    expect(typeof HttpBarrel.defineJsonRoute).toBe('function');
    expect(typeof HttpBarrel.mountJsonRoute).toBe('function');
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

  it('re-exports the daemon-status routes and registrar', () => {
    expect(typeof HttpBarrel.registerDaemonStatusRoutes).toBe('function');
    expect(HttpBarrel.daemonStatusRoute.path).toBe('/api/daemon/status');
    expect(HttpBarrel.daemonShutdownRoute.path).toBe('/api/daemon/shutdown');
  });

  it('re-exports the local-daemon-request helpers', () => {
    expect(typeof HttpBarrel.requireLocalDaemonRequest).toBe('function');
    expect(typeof HttpBarrel.validateLocalDaemonRequest).toBe('function');
    expect(typeof HttpBarrel.normalizeLocalAuthority).toBe('function');
    expect(typeof HttpBarrel.isLoopbackHostname).toBe('function');
    expect(typeof HttpBarrel.isLoopbackPeerAddress).toBe('function');
    expect(typeof HttpBarrel.localOriginFromHeader).toBe('function');
  });

  it('re-exports the api security middlewares', () => {
    expect(typeof HttpBarrel.registerApiBearerAuthMiddleware).toBe('function');
    expect(typeof HttpBarrel.registerApiOriginGuardMiddleware).toBe('function');
  });

  it('re-exports the route-registration guard', () => {
    expect(typeof HttpBarrel.installRouteRegistrationGuard).toBe('function');
    expect(typeof HttpBarrel.getRouteRegistrationInventory).toBe('function');
    expect(typeof HttpBarrel.guardedRouteKey).toBe('function');
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
    expect(HttpBarrel.DEFAULT_MAX_QUEUED_SSE_EVENTS).toBe(1000);
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
