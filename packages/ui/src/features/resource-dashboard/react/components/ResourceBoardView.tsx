import type { ReactNode } from 'react';
import { ResourceBoardToolbar } from './ResourceBoardToolbar.js';
import { ResourceCard } from './ResourceCard.js';
import { ResourceKanbanBoard, type ResourceKanbanColumn } from './ResourceKanbanBoard.js';
import type { ResourceBoardItem, ResourceBoardViewMode, ResourceSortOption, ResourceStatusToneMap } from '../../types.js';

export interface ResourceBoardViewProps<TBody = unknown> {
  loading: boolean;
  error: string | null;
  errorLabel?: string;
  /** Whether the port returned any item at all, BEFORE search filtering — distinguishes "nothing exists yet" (with a create CTA) from "search matched nothing" (DesignsTab's own two distinct empty states). */
  hasAnyItems: boolean;
  items: ResourceBoardItem<TBody>[];
  kanbanColumns: readonly ResourceKanbanColumn<TBody>[];

  sortOptions: ResourceSortOption[];
  activeSort?: string;
  onSortChange: (value: string) => void;
  sortAriaLabel: string;

  query: string;
  onQueryChange: (value: string) => void;
  searchPlaceholder: string;

  viewMode: ResourceBoardViewMode;
  onViewModeChange: (mode: ResourceBoardViewMode) => void;
  viewToggleAriaLabel: string;
  gridViewLabel: string;
  kanbanViewLabel: string;

  enableBulkDelete: boolean;
  selectMode: boolean;
  selected: ReadonlySet<string>;
  bulkDeleteBusy: boolean;
  onEnterSelectMode: () => void;
  onExitSelectMode: () => void;
  onBulkDelete: () => void;
  selectModeLabel: string;
  selectedCountLabel: (n: number) => string;
  deleteSelectedLabel: string;
  cancelSelectLabel: string;

  createLabel?: string;
  onCreate?: () => void;

  openMenuId: string | null;
  onToggleMenu: (id: string) => void;
  onItemAction: (id: string, kind: string) => void;
  isItemBusy: (id: string) => boolean;
  onOpenItem: (id: string) => void;
  onToggleSelected: (id: string) => void;
  onKanbanDelete?: (id: string) => void;

  statusLabel: (status: string) => string;
  toneMap?: ResourceStatusToneMap;
  menuActionLabel?: (kind: string, fallback: string) => string;
  moreLabel: string;
  deleteLabel: string;
  deleteAriaLabel: (title: string) => string;
  emptyColumnLabel: string;
  emptyStateTitle: string;
  emptyStateNoMatch: string;
  renderBody?: (item: ResourceBoardItem<TBody>) => ReactNode;
}

/**
 * Pure composition (props in, JSX out): the toolbar, then either the empty
 * state, the card grid, or the kanban board — DesignsTab's own
 * `filtered.length === 0 ? empty : view === "grid" ? grid : kanban` branch.
 */
export function ResourceBoardView<TBody = unknown>({
  loading,
  error,
  errorLabel,
  hasAnyItems,
  items,
  kanbanColumns,
  sortOptions,
  activeSort,
  onSortChange,
  sortAriaLabel,
  query,
  onQueryChange,
  searchPlaceholder,
  viewMode,
  onViewModeChange,
  viewToggleAriaLabel,
  gridViewLabel,
  kanbanViewLabel,
  enableBulkDelete,
  selectMode,
  selected,
  bulkDeleteBusy,
  onEnterSelectMode,
  onExitSelectMode,
  onBulkDelete,
  selectModeLabel,
  selectedCountLabel,
  deleteSelectedLabel,
  cancelSelectLabel,
  createLabel,
  onCreate,
  openMenuId,
  onToggleMenu,
  onItemAction,
  isItemBusy,
  onOpenItem,
  onToggleSelected,
  onKanbanDelete,
  statusLabel,
  toneMap,
  menuActionLabel,
  moreLabel,
  deleteLabel,
  deleteAriaLabel,
  emptyColumnLabel,
  emptyStateTitle,
  emptyStateNoMatch,
  renderBody,
}: ResourceBoardViewProps<TBody>) {
  const isEmpty = !loading && !error && items.length === 0;

  return (
    <div className={`resource-board${viewMode === 'kanban' ? ' is-kanban' : ''}`}>
      <ResourceBoardToolbar
        sortOptions={sortOptions}
        {...(activeSort !== undefined ? { activeSort } : {})}
        onSortChange={onSortChange}
        sortAriaLabel={sortAriaLabel}
        query={query}
        onQueryChange={onQueryChange}
        searchPlaceholder={searchPlaceholder}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        viewToggleAriaLabel={viewToggleAriaLabel}
        gridViewLabel={gridViewLabel}
        kanbanViewLabel={kanbanViewLabel}
        enableBulkDelete={enableBulkDelete}
        selectMode={selectMode}
        selectedCount={selected.size}
        bulkDeleteBusy={bulkDeleteBusy}
        onEnterSelectMode={onEnterSelectMode}
        onExitSelectMode={onExitSelectMode}
        onBulkDelete={onBulkDelete}
        selectModeLabel={selectModeLabel}
        selectedCountLabel={selectedCountLabel}
        deleteSelectedLabel={deleteSelectedLabel}
        cancelSelectLabel={cancelSelectLabel}
        {...(createLabel !== undefined ? { createLabel } : {})}
        {...(onCreate !== undefined ? { onCreate } : {})}
      />

      {error ? (
        <div className="resource-board-error" role="alert">
          {errorLabel ?? error}
        </div>
      ) : null}

      {loading ? (
        <div className="resource-board-loading" role="status" />
      ) : isEmpty ? (
        <div className="resource-board-empty">{hasAnyItems ? emptyStateNoMatch : emptyStateTitle}</div>
      ) : viewMode === 'grid' ? (
        <div className="resource-board-grid" data-testid="resource-board-grid">
          {items.map((item) => (
            <ResourceCard
              key={item.id}
              item={item}
              selectMode={selectMode}
              selected={selected.has(item.id)}
              menuOpen={openMenuId === item.id}
              busy={isItemBusy(item.id)}
              {...(item.status ? { statusLabel: statusLabel(item.status) } : {})}
              {...(toneMap ? { toneMap } : {})}
              {...(menuActionLabel ? { menuActionLabel } : {})}
              moreLabel={moreLabel}
              {...(renderBody ? { renderBody } : {})}
              onOpen={() => onOpenItem(item.id)}
              onToggleSelected={() => onToggleSelected(item.id)}
              onToggleMenu={() => onToggleMenu(item.id)}
              onAction={(kind) => onItemAction(item.id, kind)}
            />
          ))}
        </div>
      ) : (
        <ResourceKanbanBoard
          columns={kanbanColumns}
          emptyColumnLabel={emptyColumnLabel}
          deleteLabel={deleteLabel}
          deleteAriaLabel={deleteAriaLabel}
          isBusy={isItemBusy}
          onOpen={onOpenItem}
          {...(onKanbanDelete ? { onDelete: onKanbanDelete } : {})}
        />
      )}
    </div>
  );
}
