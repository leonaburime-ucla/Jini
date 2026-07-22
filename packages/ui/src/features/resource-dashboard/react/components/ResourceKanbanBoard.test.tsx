import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ResourceKanbanBoard, type ResourceKanbanColumn } from './ResourceKanbanBoard.js';

function makeColumns(): ResourceKanbanColumn[] {
  return [
    { status: 'not_started', label: 'Not started', items: [] },
    {
      status: 'running',
      label: 'Running',
      items: [
        { id: 'a', title: 'Project A', subtitle: 'Freeform' },
        { id: 'b', title: 'Project B' },
      ],
    },
  ];
}

describe('ResourceKanbanBoard', () => {
  it('renders one column per entry with its label and item count', () => {
    render(
      <ResourceKanbanBoard
        columns={makeColumns()}
        emptyColumnLabel="No items"
        deleteLabel="Delete"
        deleteAriaLabel={(title) => `Delete ${title}`}
        isBusy={() => false}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText('Not started')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getAllByText('2')).toHaveLength(1);
  });

  it('shows the empty-column message for a column with no items', () => {
    render(
      <ResourceKanbanBoard
        columns={makeColumns()}
        emptyColumnLabel="No items"
        deleteLabel="Delete"
        deleteAriaLabel={(title) => `Delete ${title}`}
        isBusy={() => false}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText('No items')).toBeInTheDocument();
  });

  it('renders card title and subtitle, subtitle omitted when absent', () => {
    render(
      <ResourceKanbanBoard
        columns={makeColumns()}
        emptyColumnLabel="No items"
        deleteLabel="Delete"
        deleteAriaLabel={(title) => `Delete ${title}`}
        isBusy={() => false}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText('Project A')).toBeInTheDocument();
    expect(screen.getByText('Freeform')).toBeInTheDocument();
    expect(screen.getByText('Project B')).toBeInTheDocument();
  });

  it('calls onOpen when a card is clicked', async () => {
    const onOpen = vi.fn();
    render(
      <ResourceKanbanBoard
        columns={makeColumns()}
        emptyColumnLabel="No items"
        deleteLabel="Delete"
        deleteAriaLabel={(title) => `Delete ${title}`}
        isBusy={() => false}
        onOpen={onOpen}
      />,
    );
    await userEvent.click(screen.getByText('Project A'));
    expect(onOpen).toHaveBeenCalledWith('a');
  });

  it('calls onOpen on Enter/Space keydown', async () => {
    const onOpen = vi.fn();
    render(
      <ResourceKanbanBoard
        columns={makeColumns()}
        emptyColumnLabel="No items"
        deleteLabel="Delete"
        deleteAriaLabel={(title) => `Delete ${title}`}
        isBusy={() => false}
        onOpen={onOpen}
      />,
    );
    const cards = screen.getAllByTestId('resource-kanban-card');
    cards[0]!.focus();
    await userEvent.keyboard('{Enter}');
    expect(onOpen).toHaveBeenCalledWith('a');
  });

  it('does not call onOpen for an unrelated key', async () => {
    const onOpen = vi.fn();
    render(
      <ResourceKanbanBoard
        columns={makeColumns()}
        emptyColumnLabel="No items"
        deleteLabel="Delete"
        deleteAriaLabel={(title) => `Delete ${title}`}
        isBusy={() => false}
        onOpen={onOpen}
      />,
    );
    screen.getAllByTestId('resource-kanban-card')[0]!.focus();
    await userEvent.keyboard('a');
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('renders no delete button when onDelete is omitted', () => {
    render(
      <ResourceKanbanBoard
        columns={makeColumns()}
        emptyColumnLabel="No items"
        deleteLabel="Delete"
        deleteAriaLabel={(title) => `Delete ${title}`}
        isBusy={() => false}
        onOpen={() => {}}
      />,
    );
    for (const card of screen.getAllByTestId('resource-kanban-card')) {
      expect(within(card).queryByRole('button')).not.toBeInTheDocument();
    }
  });

  it('calls onDelete without also calling onOpen, and does not bubble the click', async () => {
    const onOpen = vi.fn();
    const onDelete = vi.fn();
    render(
      <ResourceKanbanBoard
        columns={makeColumns()}
        emptyColumnLabel="No items"
        deleteLabel="Delete"
        deleteAriaLabel={(title) => `Delete ${title}`}
        isBusy={() => false}
        onOpen={onOpen}
        onDelete={onDelete}
      />,
    );
    const [cardA] = screen.getAllByTestId('resource-kanban-card');
    await userEvent.click(within(cardA!).getByRole('button'));
    expect(onDelete).toHaveBeenCalledWith('a');
    expect(onOpen).not.toHaveBeenCalled();
  });

  /**
   * Regression, same shape as `ResourceCard.tsx`'s identical fix:
   * `onClick`'s `stopPropagation` only stops the synthetic click a browser
   * fires for an Enter/Space keydown on a focused button — the raw keydown
   * event itself is separate and still bubbles unless stopped
   * independently. Before this fix, activating the delete button via the
   * keyboard also fired the outer card's own `onKeyDown` and opened it.
   */
  it('activating the delete button via keyboard (Enter) does not also call onOpen', async () => {
    const onOpen = vi.fn();
    const onDelete = vi.fn();
    render(
      <ResourceKanbanBoard
        columns={makeColumns()}
        emptyColumnLabel="No items"
        deleteLabel="Delete"
        deleteAriaLabel={(title) => `Delete ${title}`}
        isBusy={() => false}
        onOpen={onOpen}
        onDelete={onDelete}
      />,
    );
    const [cardA] = screen.getAllByTestId('resource-kanban-card');
    within(cardA!).getByRole('button').focus();
    await userEvent.keyboard('{Enter}');
    expect(onDelete).toHaveBeenCalledWith('a');
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('disables the delete button while busy', () => {
    render(
      <ResourceKanbanBoard
        columns={makeColumns()}
        emptyColumnLabel="No items"
        deleteLabel="Delete"
        deleteAriaLabel={(title) => `Delete ${title}`}
        isBusy={(id) => id === 'a'}
        onOpen={() => {}}
        onDelete={() => {}}
      />,
    );
    const [cardA, cardB] = screen.getAllByTestId('resource-kanban-card');
    expect(within(cardA!).getByRole('button')).toBeDisabled();
    expect(within(cardB!).getByRole('button')).not.toBeDisabled();
  });

  it('sets the delete button aria-label from deleteAriaLabel', () => {
    render(
      <ResourceKanbanBoard
        columns={makeColumns()}
        emptyColumnLabel="No items"
        deleteLabel="Delete"
        deleteAriaLabel={(title) => `Delete ${title}`}
        isBusy={() => false}
        onOpen={() => {}}
        onDelete={() => {}}
      />,
    );
    const [cardA] = screen.getAllByTestId('resource-kanban-card');
    expect(within(cardA!).getByRole('button')).toHaveAttribute('aria-label', 'Delete Project A');
  });

  it('applies a status-keyed class to each card', () => {
    render(
      <ResourceKanbanBoard
        columns={makeColumns()}
        emptyColumnLabel="No items"
        deleteLabel="Delete"
        deleteAriaLabel={(title) => `Delete ${title}`}
        isBusy={() => false}
        onOpen={() => {}}
      />,
    );
    const runningColumn = screen.getByText('Running').closest<HTMLElement>('.resource-kanban-column')!;
    const card = within(runningColumn).getAllByTestId('resource-kanban-card')[0]!;
    expect(card).toHaveClass('status-running');
  });
});
