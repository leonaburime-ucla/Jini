import { useT } from '../../../i18n/index.js';
import { useWiredResourceRowList } from '../hooks/useResourceRowList.js';
import { ResourceRowListView } from './ResourceRowListView.js';
import type { ResourceRowListDependencies } from '../../ports.js';
import type { ResourceMetric, ResourceRowItem, ResourceStatusOption, ResourceStatusToneMap } from '../../types.js';

export interface ResourceRowListProps<TRow extends ResourceRowItem> {
  dependencies: ResourceRowListDependencies<TRow>;
  title: string;
  eyebrow?: string;
  lede?: string;
  /** Host-computed hero metric tiles (TasksView's active/paused counts) — this primitive never derives domain-specific counts itself. */
  metrics?: ResourceMetric[];
  /** Backs both a row's own `StatusPill` (`lastRunStatus`) and every run-history item's `StatusPill` — TasksView uses one shared `RoutineRun['status']` vocabulary for both, not two. */
  statusOptions: ResourceStatusOption[];
  toneMap?: ResourceStatusToneMap;
  /**
   * Fired for EVERY row action button click (`row.actions`) — unlike
   * `ResourceBoard`, no action kind is natively understood here (run/edit/
   * pause-resume/delete all vary too much per host to hardcode), so this
   * primitive always bubbles out, tracking busy state and reloading
   * (+ refreshing the row's history if expanded) around whatever `onRowAction`
   * returns. Return a Promise to have the busy state cover the async work.
   */
  onRowAction: (id: string, kind: string) => void | Promise<void>;
  onHistoryItemAction?: (rowId: string, historyItemId: string, actionKind: string) => void;
  onCreate?: () => void;
  createLabel?: string;
  refreshToken?: string | number;
}

/**
 * The TasksView-shaped orchestrator: wires `useWiredResourceRowList` +
 * `useT()` + `ResourceRowListView`.
 */
export function ResourceRowList<TRow extends ResourceRowItem>({
  dependencies,
  title,
  eyebrow,
  lede,
  metrics = [],
  statusOptions,
  toneMap,
  onRowAction,
  onHistoryItemAction,
  onCreate,
  createLabel,
  refreshToken,
}: ResourceRowListProps<TRow>) {
  const t = useT();
  const list = useWiredResourceRowList<TRow>({
    dependencies,
    ...(refreshToken !== undefined ? { refreshToken } : {}),
  });

  const statusLabel = (status: string) => t(statusOptions.find((option) => option.value === status)?.label ?? status);

  return (
    <ResourceRowListView
      {...(eyebrow !== undefined ? { eyebrow } : {})}
      title={title}
      {...(lede !== undefined ? { lede } : {})}
      metrics={metrics}
      metricsAriaLabel={t('Summary')}
      {...(createLabel !== undefined || onCreate ? { createLabel: createLabel ?? t('New') } : {})}
      {...(onCreate ? { onCreate } : {})}
      loading={list.loading}
      error={list.error}
      {...(list.error ? { errorLabel: t(list.error) } : {})}
      sectionLabel={t('Your items')}
      loadingLabel={t('Loading…')}
      emptyTitle={t('Nothing here yet')}
      emptyBody={t('Create one to get started.')}
      rows={list.rows}
      isRowBusy={list.isRowBusy}
      statusLabel={statusLabel}
      {...(toneMap ? { toneMap } : {})}
      canExpandHistory={list.canExpandHistory}
      expandedRowId={list.expandedRowId}
      historyLoadingRowId={list.historyLoadingRowId}
      historyByRowId={list.historyByRowId}
      showHistoryLabel={t('History')}
      hideHistoryLabel={t('Hide history')}
      historyTitleLabel={t('Run history')}
      historyLoadingLabel={t('Loading…')}
      historyEmptyLabel={t('No runs yet.')}
      onToggleExpand={list.toggleExpand}
      onRowAction={(id, kind) => void list.dispatchRowAction(id, () => onRowAction(id, kind))}
      {...(onHistoryItemAction ? { onHistoryItemAction } : {})}
    />
  );
}
