import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useResourceRowList, useWiredResourceRowList } from './useResourceRowList.js';
import type { ResourceRowListPort } from '../../ports.js';
import type { ResourceRowItem, ResourceRunHistoryItem } from '../../types.js';

function fakePort(overrides: Partial<ResourceRowListPort> = {}): ResourceRowListPort {
  return {
    fetchRows: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

const ROW_A: ResourceRowItem = { id: 'a', title: 'Routine A', actions: [] };
const ROW_B: ResourceRowItem = { id: 'b', title: 'Routine B', actions: [] };
const RUN_1: ResourceRunHistoryItem = { id: 'run-1', status: 'succeeded', startedAtLabel: 'today' };

describe('useResourceRowList', () => {
  it('loads rows on mount', async () => {
    const port = fakePort({ fetchRows: vi.fn().mockResolvedValue([ROW_A]) });
    const { result } = renderHook(() => useResourceRowList({ port }));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows).toEqual([ROW_A]);
    expect(result.current.error).toBeNull();
  });

  it('sets an error when the initial load rejects', async () => {
    const port = fakePort({ fetchRows: vi.fn().mockRejectedValue(new Error('down')) });
    const { result } = renderHook(() => useResourceRowList({ port }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Failed to load items.');
    expect(result.current.rows).toEqual([]);
  });

  it('reload() re-fetches and clears a prior error', async () => {
    const fetchRows = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce([ROW_A]);
    const port = fakePort({ fetchRows });
    const { result } = renderHook(() => useResourceRowList({ port }));
    await waitFor(() => expect(result.current.error).toBe('Failed to load items.'));
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.rows).toEqual([ROW_A]);
  });

  it('re-fetches when refreshToken changes', async () => {
    const fetchRows = vi.fn().mockResolvedValue([ROW_A]);
    const port = fakePort({ fetchRows });
    const { rerender } = renderHook(({ refreshToken }) => useResourceRowList({ port, refreshToken }), {
      initialProps: { refreshToken: 1 },
    });
    await waitFor(() => expect(fetchRows).toHaveBeenCalledTimes(1));
    rerender({ refreshToken: 2 });
    await waitFor(() => expect(fetchRows).toHaveBeenCalledTimes(2));
  });

  it('derives canExpandHistory from whether fetchRowHistory is present', () => {
    const withHistory = renderHook(() => useResourceRowList({ port: fakePort({ fetchRowHistory: vi.fn() }) }));
    expect(withHistory.result.current.canExpandHistory).toBe(true);
    const withoutHistory = renderHook(() => useResourceRowList({ port: fakePort() }));
    expect(withoutHistory.result.current.canExpandHistory).toBe(false);
  });

  describe('toggleExpand', () => {
    it('expands a row and fetches its history', async () => {
      const fetchRowHistory = vi.fn().mockResolvedValue([RUN_1]);
      const port = fakePort({ fetchRows: vi.fn().mockResolvedValue([ROW_A]), fetchRowHistory });
      const { result } = renderHook(() => useResourceRowList({ port }));
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => result.current.toggleExpand('a'));
      expect(result.current.expandedRowId).toBe('a');
      await waitFor(() => expect(result.current.historyByRowId['a']).toEqual([RUN_1]));
      expect(fetchRowHistory).toHaveBeenCalledWith('a');
    });

    it('collapses an already-expanded row on a second call', async () => {
      const port = fakePort({ fetchRowHistory: vi.fn().mockResolvedValue([]) });
      const { result } = renderHook(() => useResourceRowList({ port }));
      act(() => result.current.toggleExpand('a'));
      expect(result.current.expandedRowId).toBe('a');
      act(() => result.current.toggleExpand('a'));
      expect(result.current.expandedRowId).toBeNull();
    });

    it('switches the expanded row and fetches the new row\'s history', async () => {
      const fetchRowHistory = vi.fn().mockImplementation((id: string) => Promise.resolve(id === 'a' ? [RUN_1] : []));
      const port = fakePort({ fetchRowHistory });
      const { result } = renderHook(() => useResourceRowList({ port }));
      act(() => result.current.toggleExpand('a'));
      await waitFor(() => expect(result.current.historyByRowId['a']).toEqual([RUN_1]));
      act(() => result.current.toggleExpand('b'));
      expect(result.current.expandedRowId).toBe('b');
      await waitFor(() => expect(fetchRowHistory).toHaveBeenCalledWith('b'));
    });

    it('is a no-op when the port has no fetchRowHistory', () => {
      const port = fakePort();
      const { result } = renderHook(() => useResourceRowList({ port }));
      act(() => result.current.toggleExpand('a'));
      expect(result.current.expandedRowId).toBeNull();
    });

    it('tracks historyLoadingRowId only for the duration of the fetch', async () => {
      let resolveHistory!: (items: ResourceRunHistoryItem[]) => void;
      const fetchRowHistory = vi.fn().mockReturnValue(new Promise<ResourceRunHistoryItem[]>((resolve) => (resolveHistory = resolve)));
      const port = fakePort({ fetchRowHistory });
      const { result } = renderHook(() => useResourceRowList({ port }));
      act(() => result.current.toggleExpand('a'));
      expect(result.current.historyLoadingRowId).toBe('a');
      await act(async () => {
        resolveHistory([RUN_1]);
        await Promise.resolve();
      });
      expect(result.current.historyLoadingRowId).toBeNull();
    });

    it('does not clobber a newer row\'s historyLoadingRowId when an older, slower fetch for a different row finally resolves', async () => {
      let resolveA!: (items: ResourceRunHistoryItem[]) => void;
      const fetchRowHistory = vi
        .fn()
        .mockImplementationOnce(() => new Promise<ResourceRunHistoryItem[]>((resolve) => (resolveA = resolve)))
        .mockResolvedValueOnce([]);
      const port = fakePort({ fetchRowHistory });
      const { result } = renderHook(() => useResourceRowList({ port }));
      act(() => result.current.toggleExpand('a')); // starts a slow fetch for 'a'
      expect(result.current.historyLoadingRowId).toBe('a');
      act(() => result.current.toggleExpand('b')); // switches to 'b', starts (and resolves) a fetch for 'b'
      await waitFor(() => expect(result.current.historyLoadingRowId).toBeNull());
      // 'a's slow fetch finally resolves now, well after 'b' already cleared the flag.
      await act(async () => {
        resolveA([RUN_1]);
        await Promise.resolve();
      });
      // Must still be null (not incorrectly reset to 'a' by the late resolution).
      expect(result.current.historyLoadingRowId).toBeNull();
      expect(result.current.historyByRowId['a']).toEqual([RUN_1]);
    });

    it('re-fetches fresh history every time the same row is re-expanded (not cached)', async () => {
      const fetchRowHistory = vi.fn().mockResolvedValueOnce([RUN_1]).mockResolvedValueOnce([]);
      const port = fakePort({ fetchRowHistory });
      const { result } = renderHook(() => useResourceRowList({ port }));
      act(() => result.current.toggleExpand('a'));
      await waitFor(() => expect(result.current.historyByRowId['a']).toEqual([RUN_1]));
      act(() => result.current.toggleExpand('a')); // collapse
      act(() => result.current.toggleExpand('a')); // re-expand
      await waitFor(() => expect(fetchRowHistory).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(result.current.historyByRowId['a']).toEqual([]));
    });
  });

  describe('isRowBusy / dispatchRowAction', () => {
    it('tracks busy for exactly the id acted on, for the duration of the call', async () => {
      const port = fakePort({ fetchRows: vi.fn().mockResolvedValue([ROW_A, ROW_B]) });
      const { result } = renderHook(() => useResourceRowList({ port }));
      await waitFor(() => expect(result.current.loading).toBe(false));
      let resolveAction!: () => void;
      const run = vi.fn().mockReturnValue(new Promise<void>((resolve) => (resolveAction = resolve)));
      let dispatchPromise!: Promise<void>;
      act(() => {
        dispatchPromise = result.current.dispatchRowAction('a', run);
      });
      expect(result.current.isRowBusy('a')).toBe(true);
      expect(result.current.isRowBusy('b')).toBe(false);
      await act(async () => {
        resolveAction();
        await dispatchPromise;
      });
      expect(result.current.isRowBusy('a')).toBe(false);
    });

    it('reloads the row list after a successful action', async () => {
      const fetchRows = vi.fn().mockResolvedValueOnce([ROW_A]).mockResolvedValueOnce([ROW_A, ROW_B]);
      const port = fakePort({ fetchRows });
      const { result } = renderHook(() => useResourceRowList({ port }));
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        await result.current.dispatchRowAction('a', () => {});
      });
      expect(fetchRows).toHaveBeenCalledTimes(2);
      expect(result.current.rows).toEqual([ROW_A, ROW_B]);
    });

    it('propagates a rejection from run and does not reload', async () => {
      const fetchRows = vi.fn().mockResolvedValue([ROW_A]);
      const port = fakePort({ fetchRows });
      const { result } = renderHook(() => useResourceRowList({ port }));
      await waitFor(() => expect(result.current.loading).toBe(false));
      await expect(
        act(async () => {
          await result.current.dispatchRowAction('a', () => Promise.reject(new Error('boom')));
        }),
      ).rejects.toThrow('boom');
      expect(fetchRows).toHaveBeenCalledTimes(1);
      expect(result.current.isRowBusy('a')).toBe(false);
    });

    it('refreshes the expanded row\'s history after a successful action on that same row', async () => {
      const fetchRowHistory = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([RUN_1]);
      const port = fakePort({ fetchRowHistory });
      const { result } = renderHook(() => useResourceRowList({ port }));
      act(() => result.current.toggleExpand('a'));
      await waitFor(() => expect(fetchRowHistory).toHaveBeenCalledTimes(1));
      await act(async () => {
        await result.current.dispatchRowAction('a', () => {});
      });
      expect(fetchRowHistory).toHaveBeenCalledTimes(2);
      expect(result.current.historyByRowId['a']).toEqual([RUN_1]);
    });

    it('does not touch history for an action on a row other than the expanded one', async () => {
      const fetchRowHistory = vi.fn().mockResolvedValue([]);
      const port = fakePort({ fetchRowHistory });
      const { result } = renderHook(() => useResourceRowList({ port }));
      act(() => result.current.toggleExpand('a'));
      await waitFor(() => expect(fetchRowHistory).toHaveBeenCalledTimes(1));
      await act(async () => {
        await result.current.dispatchRowAction('b', () => {});
      });
      expect(fetchRowHistory).toHaveBeenCalledTimes(1);
    });
  });
});

describe('useWiredResourceRowList', () => {
  it('binds port from dependencies', async () => {
    const dependencies = { port: fakePort({ fetchRows: vi.fn().mockResolvedValue([ROW_A]) }) };
    const { result } = renderHook(() => useWiredResourceRowList({ dependencies }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows).toEqual([ROW_A]);
  });
});
