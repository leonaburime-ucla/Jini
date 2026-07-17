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

  it('renders the About section without an authorization block when not mid-authorization', () => {
    render(
      <ConnectorDetailDrawer
        connector={makeConnector({ description: 'Team messaging' })}
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
    expect(screen.getByText('Team messaging')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the in-progress authorization hint without a continue-in-browser link when no redirect URL is present yet', () => {
    render(
      <ConnectorDetailDrawer
        connector={makeConnector({ description: 'Team messaging' })}
        disabled={false}
        pendingAction={null}
        authorizationPending={{}}
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
    expect(screen.getByText('Authorization in progress. It should finish shortly.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Continue in browser' })).toBeNull();
  });

  it('hides the tools badge chip when the tool count is not yet knowable', () => {
    render(
      <ConnectorDetailDrawer
        connector={makeConnector()}
        disabled={false}
        pendingAction={null}
        authorizationCancelFailed={false}
        authorizationError={null}
        toolsPreviewLoading={false}
        toolsLoaded={false}
        onClose={noop}
        onConnect={noop}
        onDisconnect={noop}
        onCancelAuthorization={noop}
        onLoadMoreTools={noop}
      />,
    );
    expect(document.querySelector('.connector-drawer-tool-count-chip')).toBeNull();
  });

  it('shows an in-progress authorization hint and opens the redirect URL from the About section', async () => {
    const onOpenExternalUrl = vi.fn();
    render(
      <ConnectorDetailDrawer
        connector={makeConnector({ description: 'Team messaging' })}
        disabled={false}
        pendingAction={null}
        authorizationPending={{ redirectUrl: 'https://oauth.example.com' }}
        authorizationCancelFailed={false}
        authorizationError={null}
        toolsPreviewLoading={false}
        toolsLoaded
        onClose={noop}
        onConnect={noop}
        onDisconnect={noop}
        onCancelAuthorization={noop}
        onLoadMoreTools={noop}
        onOpenExternalUrl={onOpenExternalUrl}
      />,
    );
    expect(screen.getByText('Authorization in progress. It should finish shortly.')).toBeTruthy();
    expect(screen.getAllByText('Authorization pending').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Continue in browser' }));
    expect(onOpenExternalUrl).toHaveBeenCalledWith('https://oauth.example.com');
  });

  it('shows the cancel-authorization footer action while authorization is pending, and fires onCancelAuthorization', async () => {
    const onCancelAuthorization = vi.fn();
    render(
      <ConnectorDetailDrawer
        connector={makeConnector()}
        disabled={false}
        pendingAction={null}
        authorizationPending={{ redirectUrl: 'https://oauth.example.com' }}
        authorizationCancelFailed={false}
        authorizationError={null}
        toolsPreviewLoading={false}
        toolsLoaded
        onClose={noop}
        onConnect={noop}
        onDisconnect={noop}
        onCancelAuthorization={onCancelAuthorization}
        onLoadMoreTools={noop}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel authorization' }));
    expect(onCancelAuthorization).toHaveBeenCalledWith('slack');
  });

  it('shows the cancel-failed hint when cancellation previously failed', () => {
    render(
      <ConnectorDetailDrawer
        connector={makeConnector()}
        disabled={false}
        pendingAction={null}
        authorizationCancelFailed
        authorizationError={null}
        toolsPreviewLoading={false}
        toolsLoaded
        onClose={noop}
        onConnect={noop}
        onDisconnect={noop}
        onCancelAuthorization={noop}
        onLoadMoreTools={noop}
        cancelFailedMessage="Try again please"
      />,
    );
    expect(screen.getAllByRole('alert').at(-1)!.textContent).toContain('Try again please');
  });

  it('fires onDisconnect from the Details-section action for a connected connector', async () => {
    const onDisconnect = vi.fn();
    render(
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
        onDisconnect={onDisconnect}
        onCancelAuthorization={noop}
        onLoadMoreTools={noop}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(onDisconnect).toHaveBeenCalledWith('slack');
  });

  it('reflects a pending disconnect as a loading, disabled state on the Details-section action', () => {
    render(
      <ConnectorDetailDrawer
        connector={makeConnector({ status: 'connected' })}
        disabled={false}
        pendingAction="disconnect"
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
    const disconnectButton = screen.getByRole('button', { name: 'Disconnect' });
    expect(disconnectButton.className).toContain('is-loading');
    expect((disconnectButton as HTMLButtonElement).disabled).toBe(true);
  });

  it('fires onConnect from the footer for an available connector', async () => {
    const onConnect = vi.fn();
    render(
      <ConnectorDetailDrawer
        connector={makeConnector()}
        disabled={false}
        pendingAction={null}
        authorizationCancelFailed={false}
        authorizationError={null}
        toolsPreviewLoading={false}
        toolsLoaded
        onClose={noop}
        onConnect={onConnect}
        onDisconnect={noop}
        onCancelAuthorization={noop}
        onLoadMoreTools={noop}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(onConnect).toHaveBeenCalledWith('slack');
  });

  it('shows an account label and a last-error detail row when present', () => {
    render(
      <ConnectorDetailDrawer
        connector={makeConnector({ accountLabel: 'user@example.com', lastError: 'Token expired' })}
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
    expect(screen.getByText('user@example.com')).toBeTruthy();
    expect(screen.getByText('Token expired')).toBeTruthy();
  });

  it('shows a tools badge chip once the tool count is knowable', () => {
    render(
      <ConnectorDetailDrawer
        connector={makeConnector({ toolCount: 4 })}
        disabled={false}
        pendingAction={null}
        authorizationCancelFailed={false}
        authorizationError={null}
        toolsPreviewLoading={false}
        toolsLoaded={false}
        onClose={noop}
        onConnect={noop}
        onDisconnect={noop}
        onCancelAuthorization={noop}
        onLoadMoreTools={noop}
      />,
    );
    expect(document.querySelector('.connector-drawer-tool-count-chip')).toBeTruthy();
  });

  it('renders a tool list without a load-more button when there is no next cursor', () => {
    render(
      <ConnectorDetailDrawer
        connector={makeConnector({
          tools: [{ name: 'send_message', title: 'Send message', safety: { sideEffect: 'no_side_effect' } }],
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
        onLoadMoreTools={noop}
      />,
    );
    expect(screen.getByText('Send message')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Load more tools' })).toBeNull();
  });

  it('falls back to the tool name when a tool has no title, and renders a tool description when present', () => {
    render(
      <ConnectorDetailDrawer
        connector={makeConnector({
          tools: [{ name: 'raw_tool_name', description: 'Does a thing', safety: { sideEffect: 'no_side_effect' } }],
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
        onLoadMoreTools={noop}
      />,
    );
    expect(screen.getByText('raw_tool_name', { selector: '.connector-drawer-tool-title' })).toBeTruthy();
    expect(screen.getByText('Does a thing')).toBeTruthy();
  });
});
