import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResourceBoard } from './ResourceBoard.js';
import { createFakeResourceBoardDependencies } from '../../dependencies.js';
import { I18nProvider } from '../../../i18n/index.js';
import type { ResourceBoardItem, ResourceStatusOption } from '../../types.js';

// None of `createFakeResourceBoardDependencies`'s results below set a
// `viewModeStorage`, so `ResourceBoard` falls back to its real
// `localStorage`-backed default under the shared default scope key. Without
// clearing it between tests, one test's persisted view-mode choice (e.g.
// clicking "Kanban view") leaks into every later test in this file — see
// `useResourceBoard.test.ts` for the first time this exact pitfall was
// caught (documented in `packages/ui/source-map.md`).
beforeEach(() => {
  window.localStorage.clear();
});

const STATUS_OPTIONS: ResourceStatusOption[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'running', label: 'Running' },
  { value: 'succeeded', label: 'Succeeded' },
];

function seedItems(): ResourceBoardItem[] {
  return [
    { id: 'a', title: 'Alpha', status: 'running', menuActions: [{ kind: 'rename', label: 'Rename' }, { kind: 'delete', label: 'Delete', danger: true }] },
    { id: 'b', title: 'Beta', status: 'succeeded', menuActions: [{ kind: 'duplicate', label: 'Duplicate' }] },
  ];
}

describe('ResourceBoard', () => {
  it('loads and renders items', async () => {
    const dependencies = createFakeResourceBoardDependencies({ items: seedItems() });
    render(<ResourceBoard dependencies={dependencies} statusOptions={STATUS_OPTIONS} onOpenItem={() => {}} />);
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('shows the empty-not-started state before any items load and a translated empty title with no items', async () => {
    const dependencies = createFakeResourceBoardDependencies({ items: [] });
    render(<ResourceBoard dependencies={dependencies} statusOptions={STATUS_OPTIONS} onOpenItem={() => {}} />);
    await waitFor(() => expect(screen.getByText('No items yet.')).toBeInTheDocument());
  });

  it('calls onOpenItem when a card is clicked', async () => {
    const dependencies = createFakeResourceBoardDependencies({ items: seedItems() });
    const onOpenItem = vi.fn();
    render(<ResourceBoard dependencies={dependencies} statusOptions={STATUS_OPTIONS} onOpenItem={onOpenItem} />);
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Alpha'));
    expect(onOpenItem).toHaveBeenCalledWith('a');
  });

  it('deletes an item natively via the kebab menu (delete kind)', async () => {
    const dependencies = createFakeResourceBoardDependencies({ items: seedItems() });
    render(<ResourceBoard dependencies={dependencies} statusOptions={STATUS_OPTIONS} onOpenItem={() => {}} />);
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
    await userEvent.click(screen.getAllByRole('button', { name: 'More' })[0]!);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('Alpha')).not.toBeInTheDocument());
    expect(await dependencies.port.fetchItems()).toHaveLength(1);
  });

  it('duplicates an item natively via the kebab menu (duplicate kind)', async () => {
    const dependencies = createFakeResourceBoardDependencies({ items: seedItems() });
    render(<ResourceBoard dependencies={dependencies} statusOptions={STATUS_OPTIONS} onOpenItem={() => {}} />);
    await waitFor(() => expect(screen.getByText('Beta')).toBeInTheDocument());
    await userEvent.click(screen.getAllByRole('button', { name: 'More' })[1]!);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    await waitFor(() => expect(screen.getByText('Beta copy')).toBeInTheDocument());
  });

  it('bubbles a rename action to onRenameRequest with the current title, without calling the port', async () => {
    const dependencies = createFakeResourceBoardDependencies({ items: seedItems() });
    const deleteSpy = vi.spyOn(dependencies.port, 'deleteItem');
    const onRenameRequest = vi.fn();
    render(<ResourceBoard dependencies={dependencies} statusOptions={STATUS_OPTIONS} onOpenItem={() => {}} onRenameRequest={onRenameRequest} />);
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
    await userEvent.click(screen.getAllByRole('button', { name: 'More' })[0]!);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    expect(onRenameRequest).toHaveBeenCalledWith('a', 'Alpha');
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('bubbles an unrecognized action kind to onCustomItemAction', async () => {
    const items: ResourceBoardItem[] = [{ id: 'a', title: 'Alpha', menuActions: [{ kind: 'archive', label: 'Archive' }] }];
    const dependencies = createFakeResourceBoardDependencies({ items });
    const onCustomItemAction = vi.fn();
    render(
      <ResourceBoard dependencies={dependencies} statusOptions={STATUS_OPTIONS} onOpenItem={() => {}} onCustomItemAction={onCustomItemAction} />,
    );
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Archive' }));
    expect(onCustomItemAction).toHaveBeenCalledWith('a', 'archive');
  });

  it('bulk-deletes selected items via select mode', async () => {
    const dependencies = createFakeResourceBoardDependencies({ items: seedItems() });
    render(<ResourceBoard dependencies={dependencies} statusOptions={STATUS_OPTIONS} onOpenItem={() => {}} />);
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Select' }));
    await userEvent.click(screen.getByText('Alpha'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete selected' }));
    await waitFor(() => expect(screen.queryByText('Alpha')).not.toBeInTheDocument());
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('omits select-mode controls when enableBulkDelete is false', async () => {
    const dependencies = createFakeResourceBoardDependencies({ items: seedItems() });
    render(<ResourceBoard dependencies={dependencies} statusOptions={STATUS_OPTIONS} onOpenItem={() => {}} enableBulkDelete={false} />);
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Select' })).not.toBeInTheDocument();
  });

  it('deletes an item from the kanban board view', async () => {
    const dependencies = createFakeResourceBoardDependencies({ items: seedItems() });
    render(<ResourceBoard dependencies={dependencies} statusOptions={STATUS_OPTIONS} onOpenItem={() => {}} />);
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Kanban view' }));
    const alphaCard = screen.getByText('Alpha').closest<HTMLElement>('[data-testid="resource-kanban-card"]')!;
    await userEvent.click(within(alphaCard).getByRole('button'));
    await waitFor(() => expect(screen.queryByText('Alpha')).not.toBeInTheDocument());
  });

  it('groups an unrecognized status into a trailing "Other" column', async () => {
    const items: ResourceBoardItem[] = [{ id: 'a', title: 'Alpha', status: 'archived' }];
    const dependencies = createFakeResourceBoardDependencies({ items });
    render(<ResourceBoard dependencies={dependencies} statusOptions={STATUS_OPTIONS} onOpenItem={() => {}} />);
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Kanban view' }));
    expect(screen.getByText('Other')).toBeInTheDocument();
  });

  it('renders and wires the create button when onCreate is given', async () => {
    const dependencies = createFakeResourceBoardDependencies({ items: [] });
    const onCreate = vi.fn();
    render(<ResourceBoard dependencies={dependencies} statusOptions={STATUS_OPTIONS} onOpenItem={() => {}} onCreate={onCreate} />);
    await waitFor(() => expect(screen.getByText('No items yet.')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'New' }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('honors a custom createLabel override', async () => {
    const dependencies = createFakeResourceBoardDependencies({ items: [] });
    render(<ResourceBoard dependencies={dependencies} statusOptions={STATUS_OPTIONS} onOpenItem={() => {}} onCreate={() => {}} createLabel="Add project" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add project' })).toBeInTheDocument());
  });

  it('renders a translated status label and applies the given toneMap', async () => {
    const dependencies = createFakeResourceBoardDependencies({ items: seedItems() });
    render(<ResourceBoard dependencies={dependencies} statusOptions={STATUS_OPTIONS} onOpenItem={() => {}} toneMap={{ running: 'active' }} />);
    await waitFor(() => expect(screen.getByText('Running')).toBeInTheDocument());
    expect(screen.getAllByTestId('resource-status-pill')[0]).toHaveClass('tone-active');
  });

  it('renders translated copy end-to-end under I18nProvider with a real dictionary', async () => {
    const dependencies = createFakeResourceBoardDependencies({ items: [] });
    render(
      <I18nProvider dictionaries={{ en: { 'No items yet.': 'Rien pour le moment.', New: 'Nouveau' } }} initialLocale="en">
        <ResourceBoard dependencies={dependencies} statusOptions={STATUS_OPTIONS} onOpenItem={() => {}} onCreate={() => {}} />
      </I18nProvider>,
    );
    await waitFor(() => expect(screen.getByText('Rien pour le moment.')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Nouveau' })).toBeInTheDocument();
  });

  it('surfaces a translated load-failure error', async () => {
    const dependencies = createFakeResourceBoardDependencies({ items: [] });
    vi.spyOn(dependencies.port, 'fetchItems').mockRejectedValue(new Error('network down'));
    render(<ResourceBoard dependencies={dependencies} statusOptions={STATUS_OPTIONS} onOpenItem={() => {}} />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Failed to load items.'));
  });

  it('re-fetches when refreshToken changes', async () => {
    const dependencies = createFakeResourceBoardDependencies({ items: seedItems() });
    const fetchSpy = vi.spyOn(dependencies.port, 'fetchItems');
    const { rerender } = render(<ResourceBoard dependencies={dependencies} statusOptions={STATUS_OPTIONS} onOpenItem={() => {}} refreshToken={1} />);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    rerender(<ResourceBoard dependencies={dependencies} statusOptions={STATUS_OPTIONS} onOpenItem={() => {}} refreshToken={2} />);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
  });

  it('supports a host-supplied renderBody slot', async () => {
    const dependencies = createFakeResourceBoardDependencies({ items: seedItems() });
    render(
      <ResourceBoard
        dependencies={dependencies}
        statusOptions={STATUS_OPTIONS}
        onOpenItem={() => {}}
        renderBody={(item) => <span>slot-{item.id}</span>}
      />,
    );
    await waitFor(() => expect(screen.getByText('slot-a')).toBeInTheDocument());
  });

  it('applies initialSort/defaultViewMode/storageScopeKey/defaultStatus/normalizeStatus without throwing', async () => {
    const items: ResourceBoardItem[] = [
      { id: 'a', title: 'A', status: 'queued', sortValues: { recent: 2 } },
      { id: 'b', title: 'B', sortValues: { recent: 1 } },
    ];
    const dependencies = createFakeResourceBoardDependencies({ items });
    render(
      <ResourceBoard
        dependencies={dependencies}
        statusOptions={STATUS_OPTIONS}
        onOpenItem={() => {}}
        sortOptions={[{ value: 'recent', label: 'Recent' }]}
        initialSort="recent"
        defaultViewMode="kanban"
        storageScopeKey="test-scope"
        defaultStatus="not_started"
        normalizeStatus={(status) => (status === 'queued' ? 'running' : status)}
      />,
    );
    await waitFor(() => expect(screen.getByText('A')).toBeInTheDocument());
    expect(screen.getByTestId('resource-kanban-board')).toBeInTheDocument();
  });
});
