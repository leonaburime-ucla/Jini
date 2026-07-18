import { describe, expect, it, vi } from 'vitest';
import {
  createBrowserSseLiveUpdatesPort,
  createFakeAssetGridDataPort,
  createFakeAssetGridDependencies,
} from '../dependencies.js';

interface TestAsset {
  id: string;
  kind: string;
}

describe('createFakeAssetGridDataPort', () => {
  it('fetchAssets returns a copy of the seeded assets when no matcher narrows them', async () => {
    const port = createFakeAssetGridDataPort<TestAsset>({ assets: [{ id: 'a', kind: 'image' }] });
    const result = await port.fetchAssets({});
    expect(result).toEqual([{ id: 'a', kind: 'image' }]);
  });

  it('applies a supplied matchesQuery filter', async () => {
    const port = createFakeAssetGridDataPort<TestAsset>({
      assets: [
        { id: 'a', kind: 'image' },
        { id: 'b', kind: 'video' },
      ],
      matchesQuery: (asset, query) => !query.kind || asset.kind === query.kind,
    });
    const result = await port.fetchAssets({ kind: 'video' });
    expect(result.map((a) => a.id)).toEqual(['b']);
  });

  it('fetchAssetById resolves a known id or null', async () => {
    const port = createFakeAssetGridDataPort<TestAsset>({ assets: [{ id: 'a', kind: 'image' }] });
    await expect(port.fetchAssetById?.('a')).resolves.toEqual({ id: 'a', kind: 'image' });
    await expect(port.fetchAssetById?.('missing')).resolves.toBeNull();
  });

  it('simulates latency when configured', async () => {
    vi.useFakeTimers();
    const port = createFakeAssetGridDataPort<TestAsset>({ assets: [], latencyMs: 50 });
    const promise = port.fetchAssets({});
    let resolved = false;
    void promise.then(() => {
      resolved = true;
    });
    await vi.advanceTimersByTimeAsync(49);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(resolved).toBe(true);
    vi.useRealTimers();
  });
});

describe('createFakeAssetGridDependencies', () => {
  it('binds a fake data port with no liveUpdates by default', () => {
    const deps = createFakeAssetGridDependencies<TestAsset>({ assets: [] });
    expect(deps.data).toBeDefined();
    expect(deps.liveUpdates).toBeUndefined();
  });
});

describe('createBrowserSseLiveUpdatesPort', () => {
  it('subscribe is a no-op returning a callable unsubscribe when EventSource is unavailable', () => {
    const original = (globalThis as { EventSource?: unknown }).EventSource;
    // @ts-expect-error -- simulate a non-browser environment
    delete globalThis.EventSource;
    const port = createBrowserSseLiveUpdatesPort({ url: '/events' });
    const unsubscribe = port.subscribe({ onIngest: vi.fn(), onDelete: vi.fn(), onFullReload: vi.fn() });
    expect(() => unsubscribe()).not.toThrow();
    (globalThis as { EventSource?: unknown }).EventSource = original;
  });

  it('routes ingest/delete events with a resolvable id to their handlers', () => {
    const listeners = new Map<string, (ev: MessageEvent) => void>();
    class FakeEventSource {
      addEventListener(name: string, cb: (ev: MessageEvent) => void) {
        listeners.set(name, cb);
      }
      close() {}
    }
    const original = (globalThis as { EventSource?: unknown }).EventSource;
    // @ts-expect-error -- test stub
    globalThis.EventSource = FakeEventSource;

    const port = createBrowserSseLiveUpdatesPort({ url: '/events' });
    const onIngest = vi.fn();
    const onDelete = vi.fn();
    const onFullReload = vi.fn();
    port.subscribe({ onIngest, onDelete, onFullReload });

    listeners.get('ingest')?.({ data: '{"id":"a1"}' } as MessageEvent);
    listeners.get('delete')?.({ data: '{"id":"a2"}' } as MessageEvent);
    expect(onIngest).toHaveBeenCalledWith('a1');
    expect(onDelete).toHaveBeenCalledWith('a2');
    expect(onFullReload).not.toHaveBeenCalled();

    (globalThis as { EventSource?: unknown }).EventSource = original;
  });

  it('subscribe is a no-op returning a callable unsubscribe when the EventSource constructor throws', () => {
    class ThrowingEventSource {
      constructor() {
        throw new Error('blocked (e.g. CSP / invalid URL)');
      }
    }
    const original = (globalThis as { EventSource?: unknown }).EventSource;
    // @ts-expect-error -- test stub
    globalThis.EventSource = ThrowingEventSource;

    const port = createBrowserSseLiveUpdatesPort({ url: '/events' });
    const unsubscribe = port.subscribe({ onIngest: vi.fn(), onDelete: vi.fn(), onFullReload: vi.fn() });
    expect(() => unsubscribe()).not.toThrow();

    (globalThis as { EventSource?: unknown }).EventSource = original;
  });

  it('falls back to onFullReload when a delete event carries no resolvable id', () => {
    const listeners = new Map<string, (ev: MessageEvent) => void>();
    class FakeEventSource {
      addEventListener(name: string, cb: (ev: MessageEvent) => void) {
        listeners.set(name, cb);
      }
      close() {}
    }
    const original = (globalThis as { EventSource?: unknown }).EventSource;
    // @ts-expect-error -- test stub
    globalThis.EventSource = FakeEventSource;

    const port = createBrowserSseLiveUpdatesPort({ url: '/events' });
    const onFullReload = vi.fn();
    port.subscribe({ onIngest: vi.fn(), onDelete: vi.fn(), onFullReload });
    listeners.get('delete')?.({ data: 'not json' } as MessageEvent);
    expect(onFullReload).toHaveBeenCalledTimes(1);

    (globalThis as { EventSource?: unknown }).EventSource = original;
  });

  it('falls back to onFullReload when an event carries no resolvable id', () => {
    const listeners = new Map<string, (ev: MessageEvent) => void>();
    class FakeEventSource {
      addEventListener(name: string, cb: (ev: MessageEvent) => void) {
        listeners.set(name, cb);
      }
      close() {}
    }
    const original = (globalThis as { EventSource?: unknown }).EventSource;
    // @ts-expect-error -- test stub
    globalThis.EventSource = FakeEventSource;

    const port = createBrowserSseLiveUpdatesPort({ url: '/events', idField: 'assetId' });
    const onFullReload = vi.fn();
    port.subscribe({ onIngest: vi.fn(), onDelete: vi.fn(), onFullReload });
    listeners.get('ingest')?.({ data: 'not json' } as MessageEvent);
    expect(onFullReload).toHaveBeenCalledTimes(1);

    (globalThis as { EventSource?: unknown }).EventSource = original;
  });

  it('unsubscribe closes the underlying EventSource', () => {
    const close = vi.fn();
    class FakeEventSource {
      addEventListener() {}
      close = close;
    }
    const original = (globalThis as { EventSource?: unknown }).EventSource;
    // @ts-expect-error -- test stub
    globalThis.EventSource = FakeEventSource;

    const port = createBrowserSseLiveUpdatesPort({ url: '/events' });
    const unsubscribe = port.subscribe({ onIngest: vi.fn(), onDelete: vi.fn(), onFullReload: vi.fn() });
    unsubscribe();
    expect(close).toHaveBeenCalledTimes(1);

    (globalThis as { EventSource?: unknown }).EventSource = original;
  });
});
