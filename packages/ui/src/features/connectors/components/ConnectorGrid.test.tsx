import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConnectorGrid } from './ConnectorGrid.js';
import type { Connector } from '../types.js';

function makeConnector(overrides: Partial<Connector> = {}): Connector {
  return { id: 'slack', name: 'Slack', provider: 'Composio', category: 'communication', status: 'available', tools: [], ...overrides };
}

const noop = () => {};

describe('ConnectorGrid', () => {
  it('renders a card per connector', () => {
    render(
      <ConnectorGrid
        connectors={[makeConnector({ id: 'a', name: 'A' }), makeConnector({ id: 'b', name: 'B' })]}
        locked={false}
        hasNoResults={false}
        searchQuery=""
        pendingConnectorAction={null}
        authorizationPending={{}}
        authorizationCancelFailed={{}}
        toolsLoaded={false}
        onConnect={noop}
        onDisconnect={noop}
        onCancelAuthorization={noop}
        onOpenDetails={noop}
        onClearSearch={noop}
      />,
    );
    expect(screen.getAllByRole('button', { name: /^Open details for/ })).toHaveLength(2);
  });

  it('shows the no-results empty state when hasNoResults, and clears search on action', async () => {
    const onClearSearch = vi.fn();
    render(
      <ConnectorGrid
        connectors={[]}
        locked={false}
        hasNoResults
        searchQuery="zzz"
        pendingConnectorAction={null}
        authorizationPending={{}}
        authorizationCancelFailed={{}}
        toolsLoaded={false}
        onConnect={noop}
        onDisconnect={noop}
        onCancelAuthorization={noop}
        onOpenDetails={noop}
        onClearSearch={onClearSearch}
      />,
    );
    expect(screen.getByTestId('connectors-empty')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(onClearSearch).toHaveBeenCalled();
  });

  it('passes the pending action through only to the matching connector, and forwards optional callbacks', () => {
    render(
      <ConnectorGrid
        connectors={[makeConnector({ id: 'a', name: 'A' }), makeConnector({ id: 'b', name: 'B', status: 'connected' })]}
        locked={false}
        hasNoResults={false}
        searchQuery=""
        pendingConnectorAction={{ connectorId: 'a', action: 'connect' }}
        authorizationPending={{}}
        authorizationCancelFailed={{}}
        toolsLoaded={false}
        onConnect={noop}
        onDisconnect={noop}
        onCancelAuthorization={noop}
        onOpenDetails={noop}
        onClearSearch={noop}
        getCategoryLabel={(c) => c.toUpperCase()}
        onOpenExternalUrl={noop}
      />,
    );
    // Connector "a" gets the pending action (its connect button shows a busy state).
    const cardA = screen.getByRole('button', { name: 'Open details for A' });
    expect(cardA.querySelector('.connector-action.is-connect.is-loading')).toBeTruthy();
    // Connector "b" does not match the pending action's connectorId, so it stays idle.
    const cardB = screen.getByRole('button', { name: 'Open details for B' });
    expect(cardB.querySelector('.connector-action.is-disconnect.is-loading')).toBeNull();
    // getCategoryLabel was forwarded and applied.
    expect(screen.getAllByText('COMMUNICATION')).toHaveLength(2);
  });

  it('shows the gate overlay when locked and a gate is supplied', () => {
    render(
      <ConnectorGrid
        connectors={[makeConnector()]}
        locked
        hasNoResults={false}
        searchQuery=""
        pendingConnectorAction={null}
        authorizationPending={{}}
        authorizationCancelFailed={{}}
        toolsLoaded={false}
        onConnect={noop}
        onDisconnect={noop}
        onCancelAuthorization={noop}
        onOpenDetails={noop}
        onClearSearch={noop}
        gate={{ title: 'Locked', body: 'Add a key', ctaLabel: 'Get key', ctaHref: 'https://example.com' }}
      />,
    );
    expect(screen.getByTestId('connector-gate')).toBeTruthy();
    expect(screen.getByTestId('connector-grid-wrap').className).toContain('is-masked');
  });
});
