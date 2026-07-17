import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConnectorDetailDrawer } from './ConnectorDetailDrawer.js';
import type { Connector } from '../types.js';

function makeConnector(overrides: Partial<Connector> = {}): Connector {
  return { id: 'slack', name: 'Slack', provider: 'Composio', category: 'communication', status: 'available', tools: [], ...overrides };
}

const noop = () => {};

describe('ConnectorDetailDrawer', () => {
  it('calls onClose on Escape and restores body overflow on unmount', () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <ConnectorDetailDrawer
        connector={makeConnector()}
        disabled={false}
        pendingAction={null}
        authorizationCancelFailed={false}
        authorizationError={null}
        toolsPreviewLoading={false}
        toolsLoaded
        onClose={onClose}
        onConnect={noop}
        onDisconnect={noop}
        onCancelAuthorization={noop}
        onLoadMoreTools={noop}
      />,
    );
    expect(document.body.style.overflow).toBe('hidden');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('calls onClose when the backdrop (not the drawer itself) is clicked', async () => {
    const onClose = vi.fn();
    render(
      <ConnectorDetailDrawer
        connector={makeConnector()}
        disabled={false}
        pendingAction={null}
        authorizationCancelFailed={false}
        authorizationError={null}
        toolsPreviewLoading={false}
        toolsLoaded
        onClose={onClose}
        onConnect={noop}
        onDisconnect={noop}
        onCancelAuthorization={noop}
        onLoadMoreTools={noop}
      />,
    );
    await userEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows a loading state for tools while preview is loading', () => {
    render(
      <ConnectorDetailDrawer
        connector={makeConnector({ toolCount: 3 })}
        disabled={false}
        pendingAction={null}
        authorizationCancelFailed={false}
        authorizationError={null}
        toolsPreviewLoading
        toolsLoaded={false}
        onClose={noop}
        onConnect={noop}
        onDisconnect={noop}
        onCancelAuthorization={noop}
        onLoadMoreTools={noop}
      />,
    );
    expect(screen.getByText('Loading tools…')).toBeTruthy();
  });

  it('renders the tool list with a load-more button when a next cursor exists, and fires onLoadMoreTools', async () => {
    const onLoadMoreTools = vi.fn();
    render(
      <ConnectorDetailDrawer
        connector={makeConnector({
          toolCount: 2,
          tools: [{ name: 'send_message', title: 'Send message', safety: { sideEffect: 'no_side_effect' } }],
          toolsNextCursor: 'cursor-2',
        })}
        disabled={false}
        pendingAction={null}
        authorizationCancelFailed={false}
        authorizationError={null}
        toolsPreviewLoading={false}
        toolsLoaded
        onClose={noop}
        onConnect={noop}
        onDisconnect={noop}
        onCancelAuthorization={noop}
        onLoadMoreTools={onLoadMoreTools}
      />,
    );
    expect(screen.getByText('Send message')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Load more tools' }));
    expect(onLoadMoreTools).toHaveBeenCalledWith('slack', 'cursor-2');
  });

  it('reports tool details as unavailable when toolCount exists but no tools loaded', () => {
    render(
      <ConnectorDetailDrawer
        connector={makeConnector({ toolCount: 5, tools: [] })}
        disabled={false}
        pendingAction={null}
        authorizationCancelFailed={false}
        authorizationError={null}
        toolsPreviewLoading={false}
        toolsLoaded
        onClose={noop}
        onConnect={noop}
        onDisconnect={noop}
        onCancelAuthorization={noop}
        onLoadMoreTools={noop}
      />,
    );
    expect(screen.getByText('Tool details unavailable (5)')).toBeTruthy();
  });

  it('shows a connect footer for an unconnected connector and a disconnect action for a connected one', () => {
    const { rerender } = render(
      <ConnectorDetailDrawer
        connector={makeConnector()}
        disabled={false}
        pendingAction={null}
        authorizationCancelFailed={false}
        authorizationError={null}
        toolsPreviewLoading={false}
        toolsLoaded
        onClose={noop}
        onConnect={noop}
        onDisconnect={noop}
        onCancelAuthorization={noop}
        onLoadMoreTools={noop}
      />,
    );
    expect(screen.getByRole('button', { name: 'Connect' })).toBeTruthy();

    rerender(
      <ConnectorDetailDrawer
        connector={makeConnector({ status: 'connected' })}
        disabled={false}
        pendingAction={null}
        authorizationCancelFailed={false}
        authorizationError={null}
        toolsPreviewLoading={false}
        toolsLoaded
        onClose={noop}
        onConnect={noop}
        onDisconnect={noop}
        onCancelAuthorization={noop}
        onLoadMoreTools={noop}
      />,
    );
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeTruthy();
  });

  it('surfaces an authorizationError alert', () => {
    render(
      <ConnectorDetailDrawer
        connector={makeConnector()}
        disabled={false}
        pendingAction={null}
        authorizationCancelFailed={false}
        authorizationError="Something went wrong"
        toolsPreviewLoading={false}
        toolsLoaded
        onClose={noop}
        onConnect={noop}
        onDisconnect={noop}
        onCancelAuthorization={noop}
        onLoadMoreTools={noop}
      />,
    );
    expect(screen.getAllByRole('alert')[0]!.textContent).toContain('Something went wrong');
  });
});
