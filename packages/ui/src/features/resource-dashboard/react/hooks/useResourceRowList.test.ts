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

    /**
     * Regression: a rejected `fetchRowHistory` had no `catch` at all — the
     * rejection was unhandled AND `historyByRowId[id]` stayed `undefined`
     * forever, which `ResourceRunHistoryList.tsx` renders as a permanent
     * "Loading…" (its `items === undefined` check). Real OD
     * `TasksView.tsx`'s history fetch catches a failure to an empty result;
     * this must too.
     */
    it('catches a rejected fetchRowHistory to an empty result instead of leaving history undefined forever', async () => {
      const fetchRowHistory = vi.fn().mockRejectedValue(new Error('history down'));
      const port = fakePort({ fetchRowHistory });
      const { result } = renderHook(() => useResourceRowList({ port }));
      await act(async () => {
        result.current.toggleExpand('a');
        await Promise.resolve();
        await Promise.resolve();
      });
      await waitFor(() => expect(result.current.historyByRowId['a']).toEqual([]));
      expect(result.current.historyLoadingRowId).toBeNull();
    });

    /**
     * Regression: collapsing and re-expanding the SAME row before the first
     * fetch settles starts a second, overlapping `fetchRowHistory` call for
     * that id. If the OLDER call resolves AFTER the newer one, it must not
     * overwrite the newer, already-committed history with stale data.
     */
    it('does not let a stale, older response for the SAME row overwrite a newer response that already resolved', async () => {
      let resolveFirst!: (items: ResourceRunHistoryItem[]) => void;
      const RUN_2: ResourceRunHistoryItem = { id: 'run-2', status: 'succeeded', startedAtLabel: 'later' };
      const fetchRowHistory = vi
        .fn()
        .mockImplementationOnce(() => new Promise<ResourceRunHistoryItem[]>((resolve) => (resolveFirst = resolve)))
        .mockResolvedValueOnce([RUN_2]);
      const port = fakePort({ fetchRowHistory });
      const { result } = renderHook(() => useResourceRowList({ port }));

      act(() => result.current.toggleExpand('a')); // starts the slow FIRST fetch for 'a'
      act(() => result.current.toggleExpand('a')); // collapses (no new fetch)
      act(() => result.current.toggleExpand('a')); // re-expands: starts the SECOND, newer fetch for 'a', which resolves immediately
      await waitFor(() => expect(result.current.historyByRowId['a']).toEqual([RUN_2]));

      // The first (older) fetch finally resolves now, well after the second
      // already committed its result.
      await act(async () => {
        resolveFirst([RUN_1]);
        await Promise.resolve();
      });
      // Must still be the NEWER result, not overwritten by the stale one.
      expect(result.current.historyByRowId['a']).toEqual([RUN_2]);
      expect(result.current.historyLoadingRowId).toBeNull();
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

    /**
     * Regression: `dispatchRowAction` still re-throws (proven above — that
     * contract is unchanged), but the ORIGINAL bug was that
     * `ResourceRowList.tsx`'s orchestrator fired this with a bare `void`,
     * which discards the returned promise without a rejection handler —
     * both an unhandled rejection AND no visible error anywhere. This
     * asserts the hook itself now ALSO records a visible `actionError`
     * alongside the still-propagating rejection, so a fire-and-forget
     * caller has something real to render.
     */
    it('sets actionError when run rejects, in addition to still propagating the rejection', async () => {
      const port = fakePort({ fetchRows: vi.fn().mockResolvedValue([ROW_A]) });
      const { result } = renderHook(() => useResourceRowList({ port }));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.actionError).toBeNull();
      let caught: unknown;
      await act(async () => {
        try {
          await result.current.dispatchRowAction('a', () => Promise.reject(new Error('boom')));
        } catch (err) {
          caught = err;
        }
      });
      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).message).toBe('boom');
      expect(result.current.actionError).toBe('Failed to complete action.');
    });

    it('clears a prior actionError at the start of the next dispatchRowAction call', async () => {
      const port = fakePort({ fetchRows: vi.fn().mockResolvedValue([ROW_A]) });
      const { result } = renderHook(() => useResourceRowList({ port }));
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        try {
          await result.current.dispatchRowAction('a', () => Promise.reject(new Error('boom')));
        } catch {
          // expected — asserted in the previous test; this test only cares about the actionError side-channel.
        }
      });
      expect(result.current.actionError).toBe('Failed to complete action.');
      await act(async () => {
        await result.current.dispatchRowAction('a', () => {});
      });
      expect(result.current.actionError).toBeNull();
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
