import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ResourceBoardToolbar, type ResourceBoardToolbarProps } from './ResourceBoardToolbar.js';

function baseProps(overrides: Partial<ResourceBoardToolbarProps> = {}): ResourceBoardToolbarProps {
  return {
    sortOptions: [
      { value: 'recent', label: 'Recent' },
      { value: 'yours', label: 'Yours' },
    ],
    activeSort: 'recent',
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
    enableBulkDelete: true,
    selectMode: false,
    selectedCount: 0,
    bulkDeleteBusy: false,
    onEnterSelectMode: vi.fn(),
    onExitSelectMode: vi.fn(),
    onBulkDelete: vi.fn(),
    selectModeLabel: 'Select',
    selectedCountLabel: (n) => `${n} selected`,
    deleteSelectedLabel: 'Delete selected',
    cancelSelectLabel: 'Cancel',
    ...overrides,
  };
}

describe('ResourceBoardToolbar', () => {
  it('renders a sort pill per option and marks the active one pressed', () => {
    render(<ResourceBoardToolbar {...baseProps()} />);
    expect(screen.getByRole('button', { name: 'Recent' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Yours' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders no sort pill group when sortOptions is empty', () => {
    render(<ResourceBoardToolbar {...baseProps({ sortOptions: [] })} />);
    expect(screen.queryByRole('group', { name: 'Sort' })).not.toBeInTheDocument();
  });

  it('calls onSortChange when a sort pill is clicked', async () => {
    const onSortChange = vi.fn();
    render(<ResourceBoardToolbar {...baseProps({ onSortChange })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Yours' }));
    expect(onSortChange).toHaveBeenCalledWith('yours');
  });

  it('renders the search input with the given value and placeholder', () => {
    render(<ResourceBoardToolbar {...baseProps({ query: 'abc' })} />);
    expect(screen.getByPlaceholderText('Search…')).toHaveValue('abc');
  });

  it('calls onQueryChange as the search input changes', async () => {
    const onQueryChange = vi.fn();
    render(<ResourceBoardToolbar {...baseProps({ onQueryChange })} />);
    await userEvent.type(screen.getByPlaceholderText('Search…'), 'x');
    expect(onQueryChange).toHaveBeenCalledWith('x');
  });

  it('renders no create button when onCreate is omitted', () => {
    render(<ResourceBoardToolbar {...baseProps()} />);
    expect(screen.queryByRole('button', { name: 'New' })).not.toBeInTheDocument();
  });

  it('renders and wires the create button when both onCreate and createLabel are given', async () => {
    const onCreate = vi.fn();
    render(<ResourceBoardToolbar {...baseProps({ onCreate, createLabel: 'New' })} />);
    await userEvent.click(screen.getByRole('button', { name: 'New' }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('renders the select-mode toggle in grid view when bulk delete is enabled', () => {
    render(<ResourceBoardToolbar {...baseProps()} />);
    expect(screen.getByRole('button', { name: 'Select' })).toBeInTheDocument();
  });

  it('omits select controls entirely when enableBulkDelete is false', () => {
    render(<ResourceBoardToolbar {...baseProps({ enableBulkDelete: false })} />);
    expect(screen.queryByRole('button', { name: 'Select' })).not.toBeInTheDocument();
  });

  it('omits select controls in kanban view even when bulk delete is enabled', () => {
    render(<ResourceBoardToolbar {...baseProps({ viewMode: 'kanban' })} />);
    expect(screen.queryByRole('button', { name: 'Select' })).not.toBeInTheDocument();
  });

  it('calls onEnterSelectMode when the select toggle is clicked', async () => {
    const onEnterSelectMode = vi.fn();
    render(<ResourceBoardToolbar {...baseProps({ onEnterSelectMode })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Select' }));
    expect(onEnterSelectMode).toHaveBeenCalledTimes(1);
  });

  it('renders the select-mode bar (count + delete + cancel) when selectMode is true', () => {
    render(<ResourceBoardToolbar {...baseProps({ selectMode: true, selectedCount: 2 })} />);
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete selected' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('disables the delete-selected button when nothing is selected', () => {
    render(<ResourceBoardToolbar {...baseProps({ selectMode: true, selectedCount: 0 })} />);
    expect(screen.getByRole('button', { name: 'Delete selected' })).toBeDisabled();
  });

  it('disables the delete-selected button while a bulk delete is in flight', () => {
    render(<ResourceBoardToolbar {...baseProps({ selectMode: true, selectedCount: 2, bulkDeleteBusy: true })} />);
    expect(screen.getByRole('button', { name: 'Delete selected' })).toBeDisabled();
  });

  it('calls onBulkDelete when delete-selected is clicked', async () => {
    const onBulkDelete = vi.fn();
    render(<ResourceBoardToolbar {...baseProps({ selectMode: true, selectedCount: 1, onBulkDelete })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete selected' }));
    expect(onBulkDelete).toHaveBeenCalledTimes(1);
  });

  it('calls onExitSelectMode when cancel is clicked', async () => {
    const onExitSelectMode = vi.fn();
    render(<ResourceBoardToolbar {...baseProps({ selectMode: true, onExitSelectMode })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onExitSelectMode).toHaveBeenCalledTimes(1);
  });

  it('marks the active view mode pressed and calls onViewModeChange for kanban', async () => {
    const onViewModeChange = vi.fn();
    render(<ResourceBoardToolbar {...baseProps({ onViewModeChange })} />);
    expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Kanban' })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(screen.getByRole('button', { name: 'Kanban' }));
    expect(onViewModeChange).toHaveBeenCalledWith('kanban');
  });

  it('calls onViewModeChange for grid when currently in kanban view', async () => {
    const onViewModeChange = vi.fn();
    render(<ResourceBoardToolbar {...baseProps({ viewMode: 'kanban', onViewModeChange })} />);
    expect(screen.getByRole('button', { name: 'Kanban' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Grid' }));
    expect(onViewModeChange).toHaveBeenCalledWith('grid');
  });
});
