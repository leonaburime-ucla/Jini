import { StatusPill } from './StatusPill.js';
import { ResourceRunHistoryList } from './ResourceRunHistoryList.js';
import type { ResourceRowItem, ResourceRunHistoryItem, ResourceStatusToneMap } from '../../types.js';

export interface ResourceRowListItemProps {
  row: ResourceRowItem;
  busy: boolean;
  statusLabel: (status: string) => string;
  toneMap?: ResourceStatusToneMap;
  canExpandHistory: boolean;
  expanded: boolean;
  showHistoryLabel: string;
  hideHistoryLabel: string;
  historyItems: ResourceRunHistoryItem[] | undefined;
  historyLoading: boolean;
  historyTitleLabel: string;
  historyLoadingLabel: string;
  historyEmptyLabel: string;
  onToggleExpand: () => void;
  onAction: (kind: string) => void;
  onHistoryItemAction?: (historyItemId: string, actionKind: string) => void;
}

/**
 * One row in the flat "your automations"-shaped list — TasksView's
 * `automation-row`: title/meta/detail lines, a last-run `StatusPill` +
 * label, always-visible inline action buttons (never a kebab menu, unlike
 * `ResourceCard`), an optional history-expand toggle, and the expanded
 * `ResourceRunHistoryList` sublist.
 */
export function ResourceRowListItem({
  row,
  busy,
  statusLabel,
  toneMap,
  canExpandHistory,
  expanded,
  showHistoryLabel,
  hideHistoryLabel,
  historyItems,
  historyLoading,
  historyTitleLabel,
  historyLoadingLabel,
  historyEmptyLabel,
  onToggleExpand,
  onAction,
  onHistoryItemAction,
}: ResourceRowListItemProps) {
  return (
    <li className={`resource-row-list-item${row.paused ? ' is-paused' : ''}`} data-testid="resource-row-list-item">
      <div className="resource-row-list-item-main">
        <div className="resource-row-list-item-content">
          <span className="resource-row-list-item-title">{row.title}</span>
          {row.metaLine ? <span className="resource-row-list-item-meta">{row.metaLine}</span> : null}
          {row.detailLine ? <span className="resource-row-list-item-detail">{row.detailLine}</span> : null}
          {row.lastRunStatus ? (
            <span className="resource-row-list-item-last-run">
              <StatusPill status={row.lastRunStatus} label={statusLabel(row.lastRunStatus)} {...(toneMap ? { toneMap } : {})} />
              {row.lastRunLabel ? <span>{row.lastRunLabel}</span> : null}
            </span>
          ) : null}
        </div>
      </div>
      <div className="resource-row-list-item-actions">
        {row.actions.map((action) => (
          <button
            key={action.kind}
            type="button"
            className={action.danger ? 'danger' : undefined}
            disabled={busy || action.disabled}
            onClick={() => onAction(action.kind)}
          >
            {action.label}
          </button>
        ))}
        {canExpandHistory ? (
          <button type="button" aria-expanded={expanded} onClick={onToggleExpand}>
            {expanded ? hideHistoryLabel : showHistoryLabel}
          </button>
        ) : null}
      </div>
      {expanded ? (
        <ResourceRunHistoryList
          items={historyItems}
          loading={historyLoading}
          titleLabel={historyTitleLabel}
          loadingLabel={historyLoadingLabel}
          emptyLabel={historyEmptyLabel}
          statusLabel={statusLabel}
          {...(toneMap ? { toneMap } : {})}
          {...(onHistoryItemAction ? { onAction: onHistoryItemAction } : {})}
        />
      ) : null}
    </li>
  );
}
