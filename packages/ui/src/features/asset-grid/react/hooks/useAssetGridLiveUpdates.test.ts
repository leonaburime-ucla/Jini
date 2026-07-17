// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAssetGridLiveUpdates, useWiredAssetGridLiveUpdates } from './useAssetGridLiveUpdates.js';
import type { AssetGridDependencies, AssetGridLiveUpdateHandlers, AssetGridLiveUpdatesPort } from '../../ports.js';

interface TestAsset {
  id: string;
  kind: string;
}

function fakeLiveUpdatesPort(): { port: AssetGridLiveUpdatesPort; fire: () => AssetGridLiveUpdateHandlers; unsubscribe: () => boolean } {
  let handlers: AssetGridLiveUpdateHandlers | null = null;
  let unsubscribed = false;
  const port: AssetGridLiveUpdatesPort = {
    subscribe(h) {
      handlers = h;
      unsubscribed = false;
      return () => {
        unsubscribed = true;
      };
    },
  };
  return {
    port,
    fire: () => {
      if (!handlers) throw new Error('not subscribed');
      return handlers;
    },
    unsubscribe: () => unsubscribed,
  };
}

describe('useAssetGridLiveUpdates', () => {
  it('does nothing when inactive or no liveUpdates port is supplied', () => {
    const setAssets = vi.fn();
    const reload = vi.fn();
    renderHook(() =>
      useAssetGridLiveUpdates<TestAsset>({
        active: false,
        liveUpdates: undefined,
        filtersActive: false,
        setAssets,
        reload,
      }),
    );
    expect(setAssets).not.toHaveBeenCalled();
  });

  it('applies a delete event locally without fetching', async () => {
    vi.useFakeTimers();
    const { port, fire } = fakeLiveUpdatesPort();
    const setAssets = vi.fn();
    const reload = vi.fn().mockResolvedValue(undefined);
    renderHook(() =>
      useAssetGridLiveUpdates<TestAsset>({
        active: true,
        liveUpdates: port,
        filtersActive: false,
        setAssets,
        reload,
        coalesceMs: 50,
      }),
    );
    act(() => fire().onDelete('a'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(reload).not.toHaveBeenCalled();
    expect(setAssets).toHaveBeenCalledTimes(1);
    const updater = setAssets.mock.calls[0]![0] as (prev: TestAsset[]) => TestAsset[];
    expect(updater([{ id: 'a', kind: 'image' }, { id: 'b', kind: 'image' }])).toEqual([{ id: 'b', kind: 'image' }]);
    vi.useRealTimers();
  });

  it('resolves an ingest event via fetchAssetById and merges it', async () => {
    vi.useFakeTimers();
    const { port, fire } = fakeLiveUpdatesPort();
    const setAssets = vi.fn();
    const reload = vi.fn().mockResolvedValue(undefined);
    const fetchAssetById = vi.fn().mockResolvedValue({ id: 'new', kind: 'image' });
    renderHook(() =>
      useAssetGridLiveUpdates<TestAsset>({
        active: true,
        liveUpdates: port,
        filtersActive: false,
        fetchAssetById,
        setAssets,
        reload,
        coalesceMs: 50,
      }),
    );
    act(() => fire().onIngest('new'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(fetchAssetById).toHaveBeenCalledWith('new');
    expect(reload).not.toHaveBeenCalled();
    expect(setAssets).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('falls back to a full reload when filtersActive is true, even for an ingest event', async () => {
    vi.useFakeTimers();
    const { port, fire } = fakeLiveUpdatesPort();
    const setAssets = vi.fn();
    const reload = vi.fn().mockResolvedValue(undefined);
    const fetchAssetById = vi.fn().mockResolvedValue({ id: 'new', kind: 'image' });
    renderHook(() =>
      useAssetGridLiveUpdates<TestAsset>({
        active: true,
        liveUpdates: port,
        filtersActive: true,
        fetchAssetById,
        setAssets,
        reload,
        coalesceMs: 50,
      }),
    );
    act(() => fire().onIngest('new'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(fetchAssetById).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('falls back to a full reload for onFullReload', async () => {
    vi.useFakeTimers();
    const { port, fire } = fakeLiveUpdatesPort();
    const setAssets = vi.fn();
    const reload = vi.fn().mockResolvedValue(undefined);
    renderHook(() =>
      useAssetGridLiveUpdates<TestAsset>({
        active: true,
        liveUpdates: port,
        filtersActive: false,
        setAssets,
        reload,
        coalesceMs: 50,
      }),
    );
    act(() => fire().onFullReload());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(reload).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('falls back to a full reload when no fetchAssetById is supplied for an ingest event', async () => {
    vi.useFakeTimers();
    const { port, fire } = fakeLiveUpdatesPort();
    const setAssets = vi.fn();
    const reload = vi.fn().mockResolvedValue(undefined);
    renderHook(() =>
      useAssetGridLiveUpdates<TestAsset>({
        active: true,
        liveUpdates: port,
        filtersActive: false,
        setAssets,
        reload,
        coalesceMs: 50,
      }),
    );
    act(() => fire().onIngest('new'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(reload).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('falls back to a full reload when a resolved ingest id fetches null (ambiguous race)', async () => {
    vi.useFakeTimers();
    const { port, fire } = fakeLiveUpdatesPort();
    const setAssets = vi.fn();
    const reload = vi.fn().mockResolvedValue(undefined);
    const fetchAssetById = vi.fn().mockResolvedValue(null);
    renderHook(() =>
      useAssetGridLiveUpdates<TestAsset>({
        active: true,
        liveUpdates: port,
        filtersActive: false,
        fetchAssetById,
        setAssets,
        reload,
        coalesceMs: 50,
      }),
    );
    act(() => fire().onIngest('gone'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(reload).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('coalesces a burst of events within the window into one flush', async () => {
    vi.useFakeTimers();
    const { port, fire } = fakeLiveUpdatesPort();
    const setAssets = vi.fn();
    const reload = vi.fn().mockResolvedValue(undefined);
    const fetchAssetById = vi.fn().mockResolvedValue({ id: 'a', kind: 'image' });
    renderHook(() =>
      useAssetGridLiveUpdates<TestAsset>({
        active: true,
        liveUpdates: port,
        filtersActive: false,
        fetchAssetById,
        setAssets,
        reload,
        coalesceMs: 50,
      }),
    );
    act(() => {
      fire().onIngest('a');
      fire().onIngest('b');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(fetchAssetById).toHaveBeenCalledTimes(2);
    expect(setAssets).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('unsubscribes on unmount', () => {
    const { port, unsubscribe } = fakeLiveUpdatesPort();
    const { unmount } = renderHook(() =>
      useAssetGridLiveUpdates<TestAsset>({
        active: true,
        liveUpdates: port,
        filtersActive: false,
        setAssets: vi.fn(),
        reload: vi.fn().mockResolvedValue(undefined),
      }),
    );
    expect(unsubscribe()).toBe(false);
    unmount();
    expect(unsubscribe()).toBe(true);
  });
});

describe('useWiredAssetGridLiveUpdates', () => {
  it('binds `liveUpdates`/`fetchAssetById` from the supplied `dependencies` (not a hardcoded fake)', async () => {
    vi.useFakeTimers();
    const { port, fire } = fakeLiveUpdatesPort();
    const fetchAssetById = vi.fn().mockResolvedValue({ id: 'new', kind: 'image' });
    const dependencies: AssetGridDependencies<TestAsset> = {
      data: { fetchAssets: vi.fn().mockResolvedValue([]), fetchAssetById },
      liveUpdates: port,
    };
    const setAssets = vi.fn();
    const reload = vi.fn().mockResolvedValue(undefined);
    renderHook(() =>
      useWiredAssetGridLiveUpdates<TestAsset>({
        dependencies,
        active: true,
        filtersActive: false,
        setAssets,
        reload,
        coalesceMs: 50,
      }),
    );
    act(() => fire().onIngest('new'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(fetchAssetById).toHaveBeenCalledWith('new');
    expect(setAssets).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('falls back to the package in-memory fake (no liveUpdates, no-op) when `dependencies` is omitted', () => {
    const setAssets = vi.fn();
    const reload = vi.fn();
    renderHook(() =>
      useWiredAssetGridLiveUpdates<TestAsset>({
        active: true,
        filtersActive: false,
        setAssets,
        reload,
      }),
    );
    expect(setAssets).not.toHaveBeenCalled();
  });
});
