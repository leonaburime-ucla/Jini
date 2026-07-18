import { useCallback, useEffect, useState } from 'react';
import { isActionPending, withoutPendingAction, withPendingAction } from '../../rules.js';
import type { ResourceRowListDependencies, ResourceRowListPort } from '../../ports.js';
import type { ResourceRowItem, ResourceRunHistoryItem } from '../../types.js';

const ROW_ACTION_KIND = 'row-action';
const LOAD_FAILED_MESSAGE = 'Failed to load items.';

export interface UseResourceRowListParams<TRow extends ResourceRowItem> {
  port: ResourceRowListPort<TRow>;
  /** Bumping this value re-fetches (same controlled-invalidation pattern as `useResourceBoard`). */
  refreshToken?: string | number;
}

export interface ResourceRowListController<TRow extends ResourceRowItem> {
  rows: TRow[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  isRowBusy: (id: string) => boolean;
  /**
   * Runs an arbitrary host-supplied action for `id` (TasksView's
   * run/edit/pause-resume/delete buttons dispatch through this — this
   * primitive never hardcodes their semantics, see `ports.ts`), tracking
   * busy state for the duration and, on success, reloading the row list and
   * — if `id` is the currently-expanded row — its run history too (mirrors
   * TasksView's own `runNow` bumping `historyTick` after a successful run).
   * A rejection from `run` propagates to the caller and does NOT reload.
   */
  dispatchRowAction: (id: string, run: () => Promise<void> | void) => Promise<void>;
  /** Whether any row can expand at all — derived from `port.fetchRowHistory` being present. */
  canExpandHistory: boolean;
  expandedRowId: string | null;
  historyLoadingRowId: string | null;
  historyByRowId: Record<string, ResourceRunHistoryItem[] | undefined>;
  /** Expands `id` (fetching fresh history every time, matching TasksView's own re-fetch-on-every-expand behavior) or collapses it if already expanded. No-ops when the port has no `fetchRowHistory`. */
  toggleExpand: (id: string) => void;
}

export function useResourceRowList<TRow extends ResourceRowItem>(
  params: UseResourceRowListParams<TRow>,
): ResourceRowListController<TRow> {
  const { port, refreshToken } = params;
  const [rows, setRows] = useState<TRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingKeys, setPendingKeys] = useState<ReadonlySet<string>>(new Set());
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [historyLoadingRowId, setHistoryLoadingRowId] = useState<string | null>(null);
  const [historyByRowId, setHistoryByRowId] = useState<Record<string, ResourceRunHistoryItem[] | undefined>>({});

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const fetched = await port.fetchRows();
      setRows(fetched);
      setError(null);
    } catch {
      setError(LOAD_FAILED_MESSAGE);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [port]);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [port, refreshToken]);

  const isRowBusy = useCallback((id: string) => isActionPending(pendingKeys, id, ROW_ACTION_KIND), [pendingKeys]);

  const fetchHistoryFor = useCallback(
    async (id: string) => {
      if (!port.fetchRowHistory) return;
      setHistoryLoadingRowId(id);
      try {
        const items = await port.fetchRowHistory(id);
        setHistoryByRowId((current) => ({ ...current, [id]: items }));
      } finally {
        setHistoryLoadingRowId((current) => (current === id ? null : current));
      }
    },
    [port],
  );

  const toggleExpand = useCallback(
    (id: string) => {
      if (!port.fetchRowHistory) return;
      setExpandedRowId((current) => {
        const next = current === id ? null : id;
        if (next) void fetchHistoryFor(id);
        return next;
      });
    },
    [port, fetchHistoryFor],
  );

  const dispatchRowAction = useCallback(
    async (id: string, run: () => Promise<void> | void) => {
      setPendingKeys((current) => withPendingAction(current, id, ROW_ACTION_KIND));
      try {
        await run();
        await reload();
        if (id === expandedRowId) await fetchHistoryFor(id);
      } finally {
        setPendingKeys((current) => withoutPendingAction(current, id, ROW_ACTION_KIND));
      }
    },
    [reload, expandedRowId, fetchHistoryFor],
  );

  return {
    rows,
    loading,
    error,
    reload,
    isRowBusy,
    dispatchRowAction,
    canExpandHistory: Boolean(port.fetchRowHistory),
    expandedRowId,
    historyLoadingRowId,
    historyByRowId,
    toggleExpand,
  };
}

export type UseWiredResourceRowListParams<TRow extends ResourceRowItem> = {
  dependencies: ResourceRowListDependencies<TRow>;
} & Omit<UseResourceRowListParams<TRow>, 'port'>;

export function useWiredResourceRowList<TRow extends ResourceRowItem>(
  params: UseWiredResourceRowListParams<TRow>,
): ResourceRowListController<TRow> {
  const { dependencies, ...rest } = params;
  return useResourceRowList({ port: dependencies.port, ...rest });
}
