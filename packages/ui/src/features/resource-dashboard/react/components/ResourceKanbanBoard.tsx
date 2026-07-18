import type { ResourceBoardItem } from '../../types.js';

export interface ResourceKanbanColumn<TBody = unknown> {
  status: string;
  label: string;
  items: ResourceBoardItem<TBody>[];
}

export interface ResourceKanbanBoardProps<TBody = unknown> {
  columns: readonly ResourceKanbanColumn<TBody>[];
  emptyColumnLabel: string;
  deleteLabel: string;
  deleteAriaLabel: (title: string) => string;
  isBusy: (id: string) => boolean;
  onOpen: (id: string) => void;
  /** Omitted entirely -> no delete button renders (mirrors this feature's other capability-derived-from-callback-presence pattern). */
  onDelete?: (id: string) => void;
}

/**
 * The status-grouped board view — DesignsTab's `design-kanban-board`
 * (`STATUS_ORDER.map(status => ...)` column build). Deliberately a lighter
 * card than `ResourceCard`: the origin's own kanban card
 * (`design-kanban-card`) has no select-mode, no kebab menu, and no visible
 * status badge (status is conveyed by column placement plus a
 * `status-${status}` CSS class only) — just a title, an optional subtitle,
 * and a single always-visible delete button. Reusing the full
 * `ResourceCard` here would mean inventing kanban-mode select/menu behavior
 * the origin never has (confirmed by reading `DesignsTab.tsx`'s kanban
 * branch: no `onDragStart`/`draggable`/`dnd` either — this is a static
 * board, matching r6 §1.17's own finding).
 */
export function ResourceKanbanBoard<TBody = unknown>({
  columns,
  emptyColumnLabel,
  deleteLabel,
  deleteAriaLabel,
  isBusy,
  onOpen,
  onDelete,
}: ResourceKanbanBoardProps<TBody>) {
  return (
    <div className="resource-kanban-board" data-testid="resource-kanban-board">
      {columns.map((column) => (
        <div key={column.status} className="resource-kanban-column">
          <div className="resource-kanban-column-header">
            <span>{column.label}</span>
            <span className="resource-kanban-column-count">{column.items.length}</span>
          </div>
          <div className="resource-kanban-column-list">
            {column.items.length === 0 ? (
              <div className="resource-kanban-column-empty">{emptyColumnLabel}</div>
            ) : (
              column.items.map((item) => (
                <div
                  key={item.id}
                  className={`resource-kanban-card status-${column.status}`}
                  role="button"
                  tabIndex={0}
                  data-testid="resource-kanban-card"
                  onClick={() => onOpen(item.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onOpen(item.id);
                    }
                  }}
                >
                  {onDelete ? (
                    <button
                      type="button"
                      className="resource-kanban-card-close"
                      title={deleteLabel}
                      aria-label={deleteAriaLabel(item.title)}
                      disabled={isBusy(item.id)}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(item.id);
                      }}
                    >
                      {deleteLabel}
                    </button>
                  ) : null}
                  <div className="resource-kanban-card-title" title={item.title}>
                    {item.title}
                  </div>
                  {item.subtitle ? <div className="resource-kanban-card-subtitle">{item.subtitle}</div> : null}
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
