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

  it('does NOT re-export transport-specific pieces at the root (they live under express/fastify namespaces)', () => {
    expect((HttpBarrel as Record<string, unknown>).mountJsonRoute).toBeUndefined();
    expect((HttpBarrel as Record<string, unknown>).registerApiBearerAuthMiddleware).toBeUndefined();
    expect((HttpBarrel as Record<string, unknown>).sendJson).toBeUndefined();
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
  });
});
