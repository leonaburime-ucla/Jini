import { describe, expect, it } from 'vitest';
import {
  getRouteRegistrationInventory,
  guardedRouteKey,
  installRouteRegistrationGuard,
} from '../route-registration-guard.js';

/** Mirrors the one piece of the real Fastify surface `installRouteRegistrationGuard` touches:
 * `addHook('onRoute', handler)`. The captured handler is invoked directly with an
 * `onRoute`-shaped payload (`{ method, url }`) to simulate route registrations, exactly as
 * Fastify's own `fastify.route(...)`/shorthand methods would trigger it internally. */
function makeApp() {
  const onRouteHandlers: Array<(opts: { method: string | string[]; url: string }) => void> = [];
  const app = {
    addHook: (name: string, handler: (opts: { method: string | string[]; url: string }) => void) => {
      if (name === 'onRoute') onRouteHandlers.push(handler);
    },
  };
  return { app, onRouteHandlers };
}

describe('guardedRouteKey', () => {
  it('returns the METHOD PATH key when the path is a guarded string', () => {
    const guarded = new Set(['POST /api/runs']);
    expect(guardedRouteKey('post', '/api/runs', guarded)).toBe('POST /api/runs');
  });

  it('is case-insensitive on the method', () => {
    const guarded = new Set(['GET /api/x']);
    expect(guardedRouteKey('GeT', '/api/x', guarded)).toBe('GET /api/x');
  });

  it('returns null when the path is not in the guarded set', () => {
    const guarded = new Set(['POST /api/runs']);
    expect(guardedRouteKey('post', '/api/other', guarded)).toBeNull();
  });

  it('returns null against an empty guarded set', () => {
    expect(guardedRouteKey('get', '/anything', new Set())).toBeNull();
  });
});

describe('installRouteRegistrationGuard', () => {
  it('registers exactly one onRoute hook', () => {
    const { app, onRouteHandlers } = makeApp();
    installRouteRegistrationGuard(app as any);
    expect(onRouteHandlers).toHaveLength(1);
  });

  it('records every route registration, in call order', () => {
    const { app, onRouteHandlers } = makeApp();
    installRouteRegistrationGuard(app as any);
    const onRoute = onRouteHandlers[0]!;

    onRoute({ method: 'GET', url: '/a' });
    onRoute({ method: 'POST', url: '/b' });
    onRoute({ method: 'DELETE', url: '/c' });

    expect(getRouteRegistrationInventory(app as any)).toEqual([
      { method: 'GET', path: '/a' },
      { method: 'POST', path: '/b' },
      { method: 'DELETE', path: '/c' },
    ]);
  });

  it('records one inventory entry per method when a route is registered for multiple methods at once', () => {
    const { app, onRouteHandlers } = makeApp();
    installRouteRegistrationGuard(app as any);
    onRouteHandlers[0]!({ method: ['GET', 'HEAD'], url: '/a' });

    expect(getRouteRegistrationInventory(app as any)).toEqual([
      { method: 'GET', path: '/a' },
      { method: 'HEAD', path: '/a' },
    ]);
  });

  it('defaults to an empty guarded set: the same route can be registered any number of times without throwing', () => {
    const { app, onRouteHandlers } = makeApp();
    installRouteRegistrationGuard(app as any);
    const onRoute = onRouteHandlers[0]!;

    expect(() => {
      onRoute({ method: 'POST', url: '/api/runs' });
      onRoute({ method: 'POST', url: '/api/runs' });
    }).not.toThrow();
  });

  it('throws on a second registration of a guarded route key', () => {
    const { app, onRouteHandlers } = makeApp();
    installRouteRegistrationGuard(app as any, { guardedRouteKeys: new Set(['POST /api/runs']) });
    const onRoute = onRouteHandlers[0]!;

    onRoute({ method: 'POST', url: '/api/runs' });
    expect(() => onRoute({ method: 'POST', url: '/api/runs' })).toThrowError(
      'duplicate guarded route registration: POST /api/runs',
    );
  });

  it('does not guard a route with the same path but a different method', () => {
    const { app, onRouteHandlers } = makeApp();
    installRouteRegistrationGuard(app as any, { guardedRouteKeys: new Set(['POST /api/runs']) });
    const onRoute = onRouteHandlers[0]!;

    expect(() => {
      onRoute({ method: 'POST', url: '/api/runs' });
      onRoute({ method: 'GET', url: '/api/runs' });
    }).not.toThrow();
  });

  it('allows an unguarded route to be registered repeatedly alongside a guarded one', () => {
    const { app, onRouteHandlers } = makeApp();
    installRouteRegistrationGuard(app as any, { guardedRouteKeys: new Set(['POST /api/runs']) });
    const onRoute = onRouteHandlers[0]!;

    expect(() => {
      onRoute({ method: 'GET', url: '/api/status' });
      onRoute({ method: 'GET', url: '/api/status' });
      onRoute({ method: 'POST', url: '/api/runs' });
    }).not.toThrow();
  });

  it('throws on the second guarded method in a single multi-method registration', () => {
    const { app, onRouteHandlers } = makeApp();
    installRouteRegistrationGuard(app as any, { guardedRouteKeys: new Set(['POST /api/runs']) });
    const onRoute = onRouteHandlers[0]!;

    expect(() => onRoute({ method: ['GET', 'POST'], url: '/api/runs' })).not.toThrow();
    expect(() => onRoute({ method: ['POST'], url: '/api/runs' })).toThrowError(
      'duplicate guarded route registration: POST /api/runs',
    );
  });
});

describe('getRouteRegistrationInventory', () => {
  it('returns an empty array for an app the guard was never installed on', () => {
    const { app } = makeApp();
    expect(getRouteRegistrationInventory(app as any)).toEqual([]);
  });

  it('returns a fresh copy each call — mutating the returned array never leaks into the guard state', () => {
    const { app, onRouteHandlers } = makeApp();
    installRouteRegistrationGuard(app as any);
    onRouteHandlers[0]!({ method: 'GET', url: '/a' });

    const first = getRouteRegistrationInventory(app as any);
    first.push({ method: 'GET', path: '/injected' });

    const second = getRouteRegistrationInventory(app as any);
    expect(second).toEqual([{ method: 'GET', path: '/a' }]);
  });
});
