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
