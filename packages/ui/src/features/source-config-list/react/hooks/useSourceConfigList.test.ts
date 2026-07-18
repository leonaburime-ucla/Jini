import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSourceConfigList, useWiredSourceConfigList } from './useSourceConfigList.js';
import type { SourceConfigPort } from '../../ports.js';
import type { SourceConfigItem } from '../../types.js';

function fakePort(overrides: Partial<SourceConfigPort<SourceConfigItem>> = {}): SourceConfigPort<SourceConfigItem> {
  return {
    fetchSources: vi.fn().mockResolvedValue([]),
    addSource: vi.fn(),
    removeSource: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

const SEED: SourceConfigItem = { id: 'a', fields: { url: 'https://a.example' }, trust: 'restricted' };

describe('useSourceConfigList', () => {
  it('loads sources on mount', async () => {
    const port = fakePort({ fetchSources: vi.fn().mockResolvedValue([SEED]) });
    const { result } = renderHook(() => useSourceConfigList({ port }));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sources).toEqual([SEED]);
    expect(result.current.error).toBeNull();
  });

  it('sets an error when the initial load rejects', async () => {
    const port = fakePort({ fetchSources: vi.fn().mockRejectedValue(new Error('network down')) });
    const { result } = renderHook(() => useSourceConfigList({ port }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Failed to load sources.');
    expect(result.current.sources).toEqual([]);
  });

  it('reload() re-fetches and clears a prior error', async () => {
    const fetchSources = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce([SEED]);
    const port = fakePort({ fetchSources });
    const { result } = renderHook(() => useSourceConfigList({ port }));
    await waitFor(() => expect(result.current.error).toBe('Failed to load sources.'));
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.sources).toEqual([SEED]);
  });

  it('derives capabilities from which optional port methods are present', async () => {
    const fullPort = fakePort({ refreshSource: vi.fn(), setTrust: vi.fn(), testSource: vi.fn() });
    const { result: full } = renderHook(() => useSourceConfigList({ port: fullPort }));
    await waitFor(() => expect(full.current.loading).toBe(false));
    expect(full.current.capabilities).toEqual({ canRefresh: true, canSetTrust: true, canTest: true });

    const minimalPort = fakePort();
    const { result: minimal } = renderHook(() => useSourceConfigList({ port: minimalPort }));
    await waitFor(() => expect(minimal.current.loading).toBe(false));
    expect(minimal.current.capabilities).toEqual({ canRefresh: false, canSetTrust: false, canTest: false });
  });

  it('addSourceToList upserts a source into the in-memory list without a reload', async () => {
    const port = fakePort();
    const { result } = renderHook(() => useSourceConfigList({ port }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.addSourceToList(SEED));
    expect(result.current.sources).toEqual([SEED]);
  });

  describe('remove', () => {
    it('removes the source on success and tracks pending only during the call', async () => {
      const removeSource = vi.fn().mockResolvedValue(true);
      const port = fakePort({ fetchSources: vi.fn().mockResolvedValue([SEED]), removeSource });
      const { result } = renderHook(() => useSourceConfigList({ port }));
      await waitFor(() => expect(result.current.sources).toEqual([SEED]));

      await act(async () => {
        await result.current.remove('a');
      });
      expect(removeSource).toHaveBeenCalledWith('a');
      expect(result.current.sources).toEqual([]);
      expect(result.current.isPending('a', 'remove')).toBe(false);
    });

    it('leaves the list unchanged when the port reports failure', async () => {
      const port = fakePort({ fetchSources: vi.fn().mockResolvedValue([SEED]), removeSource: vi.fn().mockResolvedValue(false) });
      const { result } = renderHook(() => useSourceConfigList({ port }));
      await waitFor(() => expect(result.current.sources).toEqual([SEED]));
      await act(async () => {
        await result.current.remove('a');
      });
      expect(result.current.sources).toEqual([SEED]);
    });

    it('clears the pending flag even when the port call throws', async () => {
      const port = fakePort({
        fetchSources: vi.fn().mockResolvedValue([SEED]),
        removeSource: vi.fn().mockRejectedValue(new Error('boom')),
      });
      const { result } = renderHook(() => useSourceConfigList({ port }));
      await waitFor(() => expect(result.current.sources).toEqual([SEED]));
      await act(async () => {
        await expect(result.current.remove('a')).rejects.toThrow('boom');
      });
      expect(result.current.isPending('a', 'remove')).toBe(false);
    });
  });

  describe('refresh', () => {
    it('is a no-op when the port has no refreshSource', async () => {
      const port = fakePort({ fetchSources: vi.fn().mockResolvedValue([SEED]) });
      const { result } = renderHook(() => useSourceConfigList({ port }));
      await waitFor(() => expect(result.current.sources).toEqual([SEED]));
      await act(async () => {
        await result.current.refresh('a');
      });
      expect(result.current.sources).toEqual([SEED]);
    });

    it('updates the source with the refreshed value on success', async () => {
      const refreshed: SourceConfigItem = { ...SEED, statusMessage: 'fresh' };
      const port = fakePort({
        fetchSources: vi.fn().mockResolvedValue([SEED]),
        refreshSource: vi.fn().mockResolvedValue(refreshed),
      });
      const { result } = renderHook(() => useSourceConfigList({ port }));
      await waitFor(() => expect(result.current.sources).toEqual([SEED]));
      await act(async () => {
        await result.current.refresh('a');
      });
      expect(result.current.sources[0]?.statusMessage).toBe('fresh');
    });

    it('leaves the list unchanged when the port returns null', async () => {
      const port = fakePort({
        fetchSources: vi.fn().mockResolvedValue([SEED]),
        refreshSource: vi.fn().mockResolvedValue(null),
      });
      const { result } = renderHook(() => useSourceConfigList({ port }));
      await waitFor(() => expect(result.current.sources).toEqual([SEED]));
      await act(async () => {
        await result.current.refresh('a');
      });
      expect(result.current.sources).toEqual([SEED]);
    });
  });

  describe('setTrust', () => {
    it('is a no-op when the port has no setTrust', async () => {
      const port = fakePort({ fetchSources: vi.fn().mockResolvedValue([SEED]) });
      const { result } = renderHook(() => useSourceConfigList({ port }));
      await waitFor(() => expect(result.current.sources).toEqual([SEED]));
      await act(async () => {
        await result.current.setTrust('a', 'trusted');
      });
      expect(result.current.sources[0]?.trust).toBe('restricted');
    });

    it('updates the source trust on success', async () => {
      const updated: SourceConfigItem = { ...SEED, trust: 'official' };
      const port = fakePort({
        fetchSources: vi.fn().mockResolvedValue([SEED]),
        setTrust: vi.fn().mockResolvedValue(updated),
      });
      const { result } = renderHook(() => useSourceConfigList({ port }));
      await waitFor(() => expect(result.current.sources).toEqual([SEED]));
      await act(async () => {
        await result.current.setTrust('a', 'official');
      });
      expect(result.current.sources[0]?.trust).toBe('official');
    });
  });

  describe('test', () => {
    it('is a no-op when the port has no testSource', async () => {
      const port = fakePort({ fetchSources: vi.fn().mockResolvedValue([SEED]) });
      const { result } = renderHook(() => useSourceConfigList({ port }));
      await waitFor(() => expect(result.current.sources).toEqual([SEED]));
      await act(async () => {
        await result.current.test('a');
      });
      expect(result.current.testResults).toEqual({});
    });

    it('stores the result keyed by source id, and forwards an optional draft', async () => {
      const testSource = vi.fn().mockResolvedValue({ ok: true, message: 'reached', latencyMs: 12 });
      const port = fakePort({ fetchSources: vi.fn().mockResolvedValue([SEED]), testSource });
      const { result } = renderHook(() => useSourceConfigList({ port }));
      await waitFor(() => expect(result.current.sources).toEqual([SEED]));
      await act(async () => {
        await result.current.test('a', { url: 'https://draft.example' });
      });
      expect(testSource).toHaveBeenCalledWith('a', { url: 'https://draft.example' });
      expect(result.current.testResults.a).toEqual({ ok: true, message: 'reached', latencyMs: 12 });
    });
  });
});

describe('useWiredSourceConfigList', () => {
  it('binds the port from dependencies', async () => {
    const port = fakePort({ fetchSources: vi.fn().mockResolvedValue([SEED]) });
    const { result } = renderHook(() => useWiredSourceConfigList({ dependencies: { port } }));
    await waitFor(() => expect(result.current.sources).toEqual([SEED]));
  });
});
