import { ResourceMetrics } from './ResourceMetrics.js';
import { ResourceRowListItem } from './ResourceRowListItem.js';
import type { ResourceMetric, ResourceRowItem, ResourceRunHistoryItem, ResourceStatusToneMap } from '../../types.js';

export interface ResourceRowListViewProps {
  eyebrow?: string;
  title: string;
  lede?: string;
  metrics: ResourceMetric[];
  metricsAriaLabel: string;
  createLabel?: string;
  onCreate?: () => void;

  loading: boolean;
  error: string | null;
  errorLabel?: string;

  sectionLabel: string;
  loadingLabel: string;
  emptyTitle: string;
  emptyBody: string;

  rows: ResourceRowItem[];
  isRowBusy: (id: string) => boolean;
  statusLabel: (status: string) => string;
  toneMap?: ResourceStatusToneMap;
  canExpandHistory: boolean;
  expandedRowId: string | null;
  historyLoadingRowId: string | null;
  historyByRowId: Record<string, ResourceRunHistoryItem[] | undefined>;
  showHistoryLabel: string;
  hideHistoryLabel: string;
  historyTitleLabel: string;
  historyLoadingLabel: string;
  historyEmptyLabel: string;
  onToggleExpand: (id: string) => void;
  onRowAction: (id: string, kind: string) => void;
  onHistoryItemAction?: (rowId: string, historyItemId: string, actionKind: string) => void;
}

/**
 * Pure composition (props in, JSX out): TasksView's hero header (eyebrow +
 * title + lede + metric tiles + a primary create CTA) followed by the flat
 * "your automations" row-list section — loading, a clickable empty state
 * (TasksView's own empty state is itself the create button), or the rows.
 * The template-gallery and proposals-review sections are deliberately NOT
 * part of this primitive — see `packages/ui/source-map.md`'s "Dropped"
 * list (create-flow and automation-evolution-specific concerns, no
 * DesignsTab analog at all).
 */
export function ResourceRowListView({
  eyebrow,
  title,
  lede,
  metrics,
  metricsAriaLabel,
  createLabel,
  onCreate,
  loading,
  error,
  errorLabel,
  sectionLabel,
  loadingLabel,
  emptyTitle,
  emptyBody,
  rows,
  isRowBusy,
  statusLabel,
  toneMap,
  canExpandHistory,
  expandedRowId,
  historyLoadingRowId,
  historyByRowId,
  showHistoryLabel,
  hideHistoryLabel,
  historyTitleLabel,
  historyLoadingLabel,
  historyEmptyLabel,
  onToggleExpand,
  onRowAction,
  onHistoryItemAction,
}: ResourceRowListViewProps) {
  const isEmpty = !loading && rows.length === 0;

  return (
    <section className="resource-row-list">
      <header className="resource-row-list-hero">
        <div className="resource-row-list-hero-copy">
          {eyebrow ? <span className="resource-row-list-hero-eyebrow">{eyebrow}</span> : null}
          <h1 className="resource-row-list-hero-title">{title}</h1>
          {lede ? <p className="resource-row-list-hero-lede">{lede}</p> : null}
        </div>
        <div className="resource-row-list-hero-actions">
          <ResourceMetrics metrics={metrics} ariaLabel={metricsAriaLabel} />
          {onCreate && createLabel ? (
            <button type="button" className="resource-row-list-new" onClick={onCreate}>
              {createLabel}
            </button>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="resource-row-list-error" role="alert">
          {errorLabel ?? error}
        </div>
      ) : null}

      <section className="resource-row-list-saved" aria-label={sectionLabel}>
        <div className="resource-row-list-section-head">
          <h2>{sectionLabel}</h2>
          {loading ? <span className="resource-row-list-section-meta">{loadingLabel}</span> : null}
        </div>

        {isEmpty ? (
          onCreate ? (
            <button type="button" className="resource-row-list-empty" onClick={onCreate}>
              <strong>{emptyTitle}</strong>
              <span>{emptyBody}</span>
            </button>
          ) : (
            <div className="resource-row-list-empty">
              <strong>{emptyTitle}</strong>
              <span>{emptyBody}</span>
            </div>
          )
        ) : rows.length > 0 ? (
          <ul className="resource-row-list-items">
            {rows.map((row) => (
              <ResourceRowListItem
                key={row.id}
                row={row}
                busy={isRowBusy(row.id)}
                statusLabel={statusLabel}
                {...(toneMap ? { toneMap } : {})}
                canExpandHistory={canExpandHistory}
                expanded={expandedRowId === row.id}
                showHistoryLabel={showHistoryLabel}
                hideHistoryLabel={hideHistoryLabel}
                historyItems={historyByRowId[row.id]}
                historyLoading={historyLoadingRowId === row.id}
                historyTitleLabel={historyTitleLabel}
                historyLoadingLabel={historyLoadingLabel}
                historyEmptyLabel={historyEmptyLabel}
                onToggleExpand={() => onToggleExpand(row.id)}
                onAction={(kind) => onRowAction(row.id, kind)}
                {...(onHistoryItemAction ? { onHistoryItemAction: (historyItemId: string, kind: string) => onHistoryItemAction(row.id, historyItemId, kind) } : {})}
              />
            ))}
          </ul>
        ) : null}
      </section>
    </section>
  );
}
