import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ResourceBoardView, type ResourceBoardViewProps } from './ResourceBoardView.js';
import type { ResourceBoardItem } from '../../types.js';

const ITEM_A: ResourceBoardItem = { id: 'a', title: 'Alpha', status: 'running', menuActions: [{ kind: 'delete', label: 'Delete' }] };
const ITEM_B: ResourceBoardItem = { id: 'b', title: 'Beta', status: 'succeeded' };

function baseProps(overrides: Partial<ResourceBoardViewProps> = {}): ResourceBoardViewProps {
  return {
    loading: false,
    error: null,
    hasAnyItems: true,
    items: [ITEM_A, ITEM_B],
    kanbanColumns: [
      { status: 'running', label: 'Running', items: [ITEM_A] },
      { status: 'succeeded', label: 'Succeeded', items: [ITEM_B] },
    ],
    sortOptions: [],
    onSortChange: vi.fn(),
    sortAriaLabel: 'Sort',
    query: '',
    onQueryChange: vi.fn(),
    searchPlaceholder: 'Search…',
    viewMode: 'grid',
    onViewModeChange: vi.fn(),
    viewToggleAriaLabel: 'View',
    gridViewLabel: 'Grid',
    kanbanViewLabel: 'Kanban',
    enableBulkDelete: false,
    selectMode: false,
    selected: new Set(),
    bulkDeleteBusy: false,
    onEnterSelectMode: vi.fn(),
    onExitSelectMode: vi.fn(),
    onBulkDelete: vi.fn(),
    selectModeLabel: 'Select',
    selectedCountLabel: (n) => `${n} selected`,
    deleteSelectedLabel: 'Delete selected',
    cancelSelectLabel: 'Cancel',
    openMenuId: null,
    onToggleMenu: vi.fn(),
    onItemAction: vi.fn(),
    isItemBusy: () => false,
    onOpenItem: vi.fn(),
    onToggleSelected: vi.fn(),
    statusLabel: (status) => `Status: ${status}`,
    moreLabel: 'More',
    deleteLabel: 'Delete',
    deleteAriaLabel: (title) => `Delete ${title}`,
    emptyColumnLabel: 'No items',
    emptyStateTitle: 'No items yet',
    emptyStateNoMatch: 'No matches',
    ...overrides,
  };
}

describe('ResourceBoardView', () => {
  it('renders a loading state and nothing else', () => {
    render(<ResourceBoardView {...baseProps({ loading: true })} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('resource-board-grid')).not.toBeInTheDocument();
  });

  it('renders an error banner using errorLabel when given', () => {
    render(<ResourceBoardView {...baseProps({ error: 'raw', errorLabel: 'Translated error' })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Translated error');
  });

  it('falls back to the raw error string when errorLabel is omitted', () => {
    render(<ResourceBoardView {...baseProps({ error: 'raw error' })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('raw error');
  });

  it('shows emptyStateTitle when there are no items at all', () => {
    render(<ResourceBoardView {...baseProps({ items: [], kanbanColumns: [], hasAnyItems: false })} />);
    expect(screen.getByText('No items yet')).toBeInTheDocument();
  });

  it('shows emptyStateNoMatch when items exist but the filtered list is empty', () => {
    render(<ResourceBoardView {...baseProps({ items: [], kanbanColumns: [], hasAnyItems: true })} />);
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('renders a card per item in grid view, with resolved status label', () => {
    render(<ResourceBoardView {...baseProps()} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Status: running')).toBeInTheDocument();
  });

  it('calls onOpenItem when a card is opened', async () => {
    const onOpenItem = vi.fn();
    render(<ResourceBoardView {...baseProps({ onOpenItem })} />);
    await userEvent.click(screen.getByText('Alpha'));
    expect(onOpenItem).toHaveBeenCalledWith('a');
  });

  it('calls onToggleSelected when a card is clicked in select mode', async () => {
    const onToggleSelected = vi.fn();
    render(<ResourceBoardView {...baseProps({ selectMode: true, onToggleSelected })} />);
    await userEvent.click(screen.getByText('Alpha'));
    expect(onToggleSelected).toHaveBeenCalledWith('a');
  });

  it('calls onToggleMenu when a card kebab button is clicked', async () => {
    const onToggleMenu = vi.fn();
    render(<ResourceBoardView {...baseProps({ onToggleMenu })} />);
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(onToggleMenu).toHaveBeenCalledWith('a');
  });

  it('calls onItemAction with the item id and action kind when a menu action is clicked', async () => {
    const onItemAction = vi.fn();
    render(<ResourceBoardView {...baseProps({ openMenuId: 'a', onItemAction })} />);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(onItemAction).toHaveBeenCalledWith('a', 'delete');
  });

  it('renders the kanban board in kanban view', () => {
    render(<ResourceBoardView {...baseProps({ viewMode: 'kanban' })} />);
    expect(screen.getByTestId('resource-kanban-board')).toBeInTheDocument();
    expect(screen.queryByTestId('resource-board-grid')).not.toBeInTheDocument();
  });

  it('calls onOpenItem from a kanban card', async () => {
    const onOpenItem = vi.fn();
    render(<ResourceBoardView {...baseProps({ viewMode: 'kanban', onOpenItem })} />);
    await userEvent.click(screen.getByText('Alpha'));
    expect(onOpenItem).toHaveBeenCalledWith('a');
  });

  it('wires onKanbanDelete to the kanban board only when supplied', () => {
    const { rerender } = render(<ResourceBoardView {...baseProps({ viewMode: 'kanban' })} />);
    expect(screen.getAllByTestId('resource-kanban-card')[0]!.querySelector('button')).toBeNull();
    rerender(<ResourceBoardView {...baseProps({ viewMode: 'kanban', onKanbanDelete: vi.fn() })} />);
    expect(screen.getAllByTestId('resource-kanban-card')[0]!.querySelector('button')).not.toBeNull();
  });

  it('bubbles view-mode/search/sort toolbar changes', async () => {
    const onViewModeChange = vi.fn();
    const onQueryChange = vi.fn();
    const onSortChange = vi.fn();
    render(
      <ResourceBoardView
        {...baseProps({
          sortOptions: [{ value: 'recent', label: 'Recent' }],
          onViewModeChange,
          onQueryChange,
          onSortChange,
        })}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Kanban' }));
    expect(onViewModeChange).toHaveBeenCalledWith('kanban');
    await userEvent.type(screen.getByPlaceholderText('Search…'), 'x');
    expect(onQueryChange).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Recent' }));
    expect(onSortChange).toHaveBeenCalledWith('recent');
  });

  it('bubbles select-mode/bulk-delete toolbar interactions', async () => {
    const onEnterSelectMode = vi.fn();
    const onBulkDelete = vi.fn();
    const onExitSelectMode = vi.fn();
    const { rerender } = render(<ResourceBoardView {...baseProps({ enableBulkDelete: true })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Select' }));
    rerender(<ResourceBoardView {...baseProps({ enableBulkDelete: true, selectMode: true, selected: new Set(['a']) })} />);
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    render(
      <ResourceBoardView
        {...baseProps({ enableBulkDelete: true, selectMode: true, selected: new Set(['a']), onEnterSelectMode, onBulkDelete, onExitSelectMode })}
      />,
    );
  });

  it('renders the create button only when both onCreate and createLabel are given', () => {
    const { rerender } = render(<ResourceBoardView {...baseProps()} />);
    expect(screen.queryByRole('button', { name: 'New' })).not.toBeInTheDocument();
    rerender(<ResourceBoardView {...baseProps({ onCreate: vi.fn(), createLabel: 'New' })} />);
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
  });

  it('passes toneMap/menuActionLabel/renderBody through to the card', () => {
    render(
      <ResourceBoardView
        {...baseProps({
          toneMap: { running: 'active' },
          menuActionLabel: (_kind, fallback) => `t:${fallback}`,
          renderBody: (item) => <span>body-{item.id}</span>,
          openMenuId: 'a',
        })}
      />,
    );
    expect(screen.getAllByTestId('resource-status-pill')[0]).toHaveClass('tone-active');
    expect(screen.getByRole('menuitem', { name: 't:Delete' })).toBeInTheDocument();
    expect(screen.getByText('body-a')).toBeInTheDocument();
  });
});
