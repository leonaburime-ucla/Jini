// @vitest-environment node
//
// `createBrowserConnectorAuthPendingStorage`'s `load`/`save` and
// `createBrowserConnectorAuthBridge`'s `subscribeAuthCallback`/
// `subscribeWindowRefocus` all guard on `typeof window === 'undefined'`.
// That guard's true branch only exercises for real when `window` is
// genuinely absent from the global scope, which holds only under Node's
// default (non-jsdom) environment — this package's package-wide default is
// jsdom, which always defines `window`. Splitting these assertions into
// their own `node`-environment file (matching `sketch-editor/dom.ssr.test.ts`'s
// precedent) exercises the real SSR guard instead of a source change or a
// suppression comment. See `packages/ui/source-map.md`.
import { describe, expect, it } from 'vitest';
import { createBrowserConnectorAuthBridge, createBrowserConnectorAuthPendingStorage } from './dependencies.js';

describe('createBrowserConnectorAuthPendingStorage (SSR)', () => {
  it('load() returns {} when window is undefined', () => {
    expect(typeof window).toBe('undefined');
    const storage = createBrowserConnectorAuthPendingStorage();
    expect(storage.load()).toEqual({});
  });

  it('save() is a no-op when window is undefined', () => {
    expect(typeof window).toBe('undefined');
    const storage = createBrowserConnectorAuthPendingStorage();
    expect(() => storage.save({ slack: { expiresAt: '2099-01-01T00:00:00Z' } })).not.toThrow();
  });
});

describe('createBrowserConnectorAuthBridge (SSR)', () => {
  it('subscribeAuthCallback returns a no-op unsubscribe when window is undefined', () => {
    expect(typeof window).toBe('undefined');
    const bridge = createBrowserConnectorAuthBridge();
    const unsubscribe = bridge.subscribeAuthCallback(() => {});
    expect(() => unsubscribe()).not.toThrow();
  });

  it('subscribeWindowRefocus returns a no-op unsubscribe when window is undefined', () => {
    expect(typeof window).toBe('undefined');
    const bridge = createBrowserConnectorAuthBridge();
    const unsubscribe = bridge.subscribeWindowRefocus(() => {});
    expect(() => unsubscribe()).not.toThrow();
  });
});
