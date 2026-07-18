import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConnectorCard } from '../../components/ConnectorCard.js';
import type { Connector } from '../../types.js';

function makeConnector(overrides: Partial<Connector> = {}): Connector {
  return { id: 'slack', name: 'Slack', provider: 'Composio', category: 'communication', status: 'available', tools: [], ...overrides };
}

const noop = () => {};

describe('ConnectorCard', () => {
  it('shows a connect action for an available connector and fires onConnect', async () => {
    const onConnect = vi.fn();
    render(
      <ConnectorCard
        connector={makeConnector()}
        pendingAction={null}
        authorizationCancelFailed={false}
        toolsLoaded={false}
        onConnect={onConnect}
        onDisconnect={noop}
        onCancelAuthorization={noop}
        onOpenDetails={noop}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(onConnect).toHaveBeenCalledWith('slack');
  });

  it('shows a disconnect action + status dot for a connected connector', () => {
    render(
      <ConnectorCard
        connector={makeConnector({ status: 'connected' })}
        pendingAction={null}
        authorizationCancelFailed={false}
        toolsLoaded={false}
        onConnect={noop}
        onDisconnect={noop}
        onCancelAuthorization={noop}
        onOpenDetails={noop}
      />,
    );
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeTruthy();
  });

  it('shows a cancel-authorization action while authorization is pending, and a continue-in-browser link when a redirectUrl exists', async () => {
    const onCancel = vi.fn();
    const onOpenExternalUrl = vi.fn();
    render(
      <ConnectorCard
        connector={makeConnector()}
        pendingAction={null}
        authorizationPending={{ redirectUrl: 'https://oauth.example.com' }}
        authorizationCancelFailed={false}
        toolsLoaded={false}
        onConnect={noop}
        onDisconnect={noop}
        onCancelAuthorization={onCancel}
        onOpenDetails={noop}
        onOpenExternalUrl={onOpenExternalUrl}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel authorization' }));
    expect(onCancel).toHaveBeenCalledWith('slack');

    await userEvent.click(screen.getByRole('button', { name: 'Continue in browser' }));
    expect(onOpenExternalUrl).toHaveBeenCalledWith('https://oauth.example.com');
  });

  it('shows the cancel-failed hint when cancellation previously failed', () => {
    render(
      <ConnectorCard
        connector={makeConnector()}
        pendingAction={null}
        authorizationCancelFailed
        toolsLoaded={false}
        onConnect={noop}
        onDisconnect={noop}
        onCancelAuthorization={noop}
        onOpenDetails={noop}
        cancelFailedMessage="Try again please"
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain('Try again please');
  });

  it('disables actions and hides them from the tab order when disabled/locked', () => {
    render(
      <ConnectorCard
        connector={makeConnector()}
        disabled
        pendingAction={null}
        authorizationCancelFailed={false}
        toolsLoaded={false}
        onConnect={noop}
        onDisconnect={noop}
        onCancelAuthorization={noop}
        onOpenDetails={noop}
      />,
    );
    expect((screen.getByRole('button', { name: 'Connect' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Open details for Slack' }).getAttribute('tabIndex')).toBe('-1');
  });

  it('opens details on click and on Enter/Space when focused directly on the card', async () => {
    const onOpenDetails = vi.fn();
    render(
      <ConnectorCard
        connector={makeConnector()}
        pendingAction={null}
        authorizationCancelFailed={false}
        toolsLoaded={false}
        onConnect={noop}
        onDisconnect={noop}
        onCancelAuthorization={noop}
        onOpenDetails={onOpenDetails}
      />,
    );
    const card = screen.getByRole('button', { name: 'Open details for Slack' });
    await userEvent.click(card);
    expect(onOpenDetails).toHaveBeenCalledWith('slack');

    onOpenDetails.mockClear();
    card.focus();
    await userEvent.keyboard('{Enter}');
    expect(onOpenDetails).toHaveBeenCalledWith('slack');
  });

  it('shows an error/disabled status pill for those statuses', () => {
    render(
      <ConnectorCard
        connector={makeConnector({ status: 'error' })}
        pendingAction={null}
        authorizationCancelFailed={false}
        toolsLoaded={false}
        onConnect={noop}
        onDisconnect={noop}
        onCancelAuthorization={noop}
        onOpenDetails={noop}
      />,
    );
    expect(screen.getByText('Error')).toBeTruthy();
  });

  it('renders a category label through getCategoryLabel when provided', () => {
    render(
      <ConnectorCard
        connector={makeConnector({ category: 'crm' })}
        pendingAction={null}
        authorizationCancelFailed={false}
        toolsLoaded={false}
        onConnect={noop}
        onDisconnect={noop}
        onCancelAuthorization={noop}
        onOpenDetails={noop}
        getCategoryLabel={(c) => c.toUpperCase()}
      />,
    );
    expect(screen.getByText('CRM')).toBeTruthy();
  });
});
