import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ResourceRunHistoryList } from './ResourceRunHistoryList.js';
import type { ResourceRunHistoryItem } from '../../types.js';

const statusLabel = (status: string) => `Status: ${status}`;

describe('ResourceRunHistoryList', () => {
  it('renders the loading label while loading', () => {
    render(<ResourceRunHistoryList items={undefined} loading titleLabel="History" loadingLabel="Loading…" emptyLabel="No runs." statusLabel={statusLabel} />);
    expect(screen.getByTestId('resource-row-history')).toHaveTextContent('Loading…');
  });

  it('renders the loading label when items is undefined even if loading is false (not yet fetched)', () => {
    render(
      <ResourceRunHistoryList items={undefined} loading={false} titleLabel="History" loadingLabel="Loading…" emptyLabel="No runs." statusLabel={statusLabel} />,
    );
    expect(screen.getByTestId('resource-row-history')).toHaveTextContent('Loading…');
  });

  it('renders the empty label for an empty list', () => {
    render(<ResourceRunHistoryList items={[]} loading={false} titleLabel="History" loadingLabel="Loading…" emptyLabel="No runs." statusLabel={statusLabel} />);
    expect(screen.getByTestId('resource-row-history')).toHaveTextContent('No runs.');
  });

  it('renders a row per history item with status, timing, and title header', () => {
    const items: ResourceRunHistoryItem[] = [{ id: 'r1', status: 'succeeded', startedAtLabel: 'Jan 1', durationLabel: '3s' }];
    render(<ResourceRunHistoryList items={items} loading={false} titleLabel="Run history" loadingLabel="Loading…" emptyLabel="No runs." statusLabel={statusLabel} />);
    expect(screen.getByText('Run history')).toBeInTheDocument();
    expect(screen.getByText('Status: succeeded')).toBeInTheDocument();
    expect(screen.getByText('Jan 1')).toBeInTheDocument();
    expect(screen.getByText('3s')).toBeInTheDocument();
  });

  it('omits the duration span when durationLabel is absent', () => {
    const items: ResourceRunHistoryItem[] = [{ id: 'r1', status: 'running', startedAtLabel: 'Jan 1' }];
    render(<ResourceRunHistoryList items={items} loading={false} titleLabel="History" loadingLabel="Loading…" emptyLabel="No runs." statusLabel={statusLabel} />);
    expect(screen.queryByText('3s')).not.toBeInTheDocument();
  });

  it('renders a message, marked as error when isError is set', () => {
    const items: ResourceRunHistoryItem[] = [{ id: 'r1', status: 'failed', startedAtLabel: 'Jan 1', message: 'boom', isError: true }];
    render(<ResourceRunHistoryList items={items} loading={false} titleLabel="History" loadingLabel="Loading…" emptyLabel="No runs." statusLabel={statusLabel} />);
    expect(screen.getByText('boom')).toHaveClass('is-error');
  });

  it('omits the message div entirely when neither message is set', () => {
    const items: ResourceRunHistoryItem[] = [{ id: 'r1', status: 'succeeded', startedAtLabel: 'Jan 1' }];
    render(<ResourceRunHistoryList items={items} loading={false} titleLabel="History" loadingLabel="Loading…" emptyLabel="No runs." statusLabel={statusLabel} />);
    expect(screen.queryByText('boom')).not.toBeInTheDocument();
  });

  it('applies the tone map to the status pill', () => {
    const items: ResourceRunHistoryItem[] = [{ id: 'r1', status: 'failed', startedAtLabel: 'Jan 1' }];
    render(
      <ResourceRunHistoryList
        items={items}
        loading={false}
        titleLabel="History"
        loadingLabel="Loading…"
        emptyLabel="No runs."
        statusLabel={statusLabel}
        toneMap={{ failed: 'error' }}
      />,
    );
    expect(screen.getByTestId('resource-status-pill')).toHaveClass('tone-error');
  });

  it('renders no action buttons when a history item has none', () => {
    const items: ResourceRunHistoryItem[] = [{ id: 'r1', status: 'succeeded', startedAtLabel: 'Jan 1' }];
    render(<ResourceRunHistoryList items={items} loading={false} titleLabel="History" loadingLabel="Loading…" emptyLabel="No runs." statusLabel={statusLabel} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders and dispatches actions with the history item id and action kind', async () => {
    const items: ResourceRunHistoryItem[] = [
      { id: 'r1', status: 'succeeded', startedAtLabel: 'Jan 1', actions: [{ kind: 'open', label: 'Open' }, { kind: 'archive', label: 'Archive', danger: true, disabled: true }] },
    ];
    const onAction = vi.fn();
    render(<ResourceRunHistoryList items={items} loading={false} titleLabel="History" loadingLabel="Loading…" emptyLabel="No runs." statusLabel={statusLabel} onAction={onAction} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(onAction).toHaveBeenCalledWith('r1', 'open');
    expect(screen.getByRole('button', { name: 'Archive' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Archive' })).toHaveClass('danger');
  });

  it('does not throw clicking an action when onAction is omitted', async () => {
    const items: ResourceRunHistoryItem[] = [{ id: 'r1', status: 'succeeded', startedAtLabel: 'Jan 1', actions: [{ kind: 'open', label: 'Open' }] }];
    render(<ResourceRunHistoryList items={items} loading={false} titleLabel="History" loadingLabel="Loading…" emptyLabel="No runs." statusLabel={statusLabel} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
  });
});
