import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConnectorsBrowser } from './ConnectorsBrowser.js';
import { createFakeConnectorsDependencies } from './dependencies.js';
import type { Connector } from './types.js';

function makeConnector(overrides: Partial<Connector> = {}): Connector {
  return { id: 'slack', name: 'Slack', provider: 'Composio', category: 'communication', status: 'available', tools: [], ...overrides };
}

describe('ConnectorsBrowser', () => {
  it('loads and renders the catalog', async () => {
    const dependencies = createFakeConnectorsDependencies({ connectors: [makeConnector(), makeConnector({ id: 'notion', name: 'Notion' })] });
    render(<ConnectorsBrowser unlocked dependencies={dependencies} />);
    await waitFor(() => expect(screen.getByText('Slack')).toBeTruthy());
    expect(screen.getByText('Notion')).toBeTruthy();
  });

  it('shows the gate overlay and masks the grid when locked', async () => {
    const dependencies = createFakeConnectorsDependencies({ connectors: [makeConnector()] });
    render(
      <ConnectorsBrowser
        unlocked={false}
        dependencies={dependencies}
        gate={{ title: 'Add a key', body: 'body', ctaLabel: 'Get key', ctaHref: 'https://example.com' }}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('connector-gate')).toBeTruthy());
    expect(screen.getByTestId('connector-grid-wrap').className).toContain('is-masked');
  });

  it('filters the grid via search and shows the no-results empty state', async () => {
    const dependencies = createFakeConnectorsDependencies({
      connectors: [makeConnector(), makeConnector({ id: 'notion', name: 'Notion' })],
    });
    render(<ConnectorsBrowser unlocked dependencies={dependencies} />);
    await waitFor(() => expect(screen.getByText('Slack')).toBeTruthy());

    await userEvent.type(screen.getByTestId('connectors-search-input'), 'notion');
    await waitFor(() => expect(screen.queryByText('Slack')).toBeNull());
    expect(screen.getByText('Notion')).toBeTruthy();

    await userEvent.clear(screen.getByTestId('connectors-search-input'));
    await userEvent.type(screen.getByTestId('connectors-search-input'), 'zzz-no-match');
    await waitFor(() => expect(screen.getByTestId('connectors-empty')).toBeTruthy());
  });

  it('connects a connector end-to-end through the fake dependencies', async () => {
    const dependencies = createFakeConnectorsDependencies({ connectors: [makeConnector()] });
    const onConnectorAuthResult = vi.fn();
    render(<ConnectorsBrowser unlocked dependencies={dependencies} onConnectorAuthResult={onConnectorAuthResult} />);
    await waitFor(() => expect(screen.getByText('Slack')).toBeTruthy());

    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await waitFor(() => expect(onConnectorAuthResult).toHaveBeenCalledWith({ connectorId: 'slack', action: 'connect', result: 'success' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Disconnect' })).toBeTruthy());
  });

  it('fires onProviderTabClick for provider-tab and search interactions', async () => {
    const dependencies = createFakeConnectorsDependencies({ connectors: [makeConnector()] });
    const onProviderTabClick = vi.fn();
    render(
      <ConnectorsBrowser
        unlocked
        dependencies={dependencies}
        providerTabs={[{ id: 'default', label: 'All', match: () => true }]}
        onProviderTabClick={onProviderTabClick}
      />,
    );
    await waitFor(() => expect(screen.getByText('Slack')).toBeTruthy());

    await userEvent.click(screen.getByTestId('connectors-provider-tab-default'));
    expect(onProviderTabClick).toHaveBeenCalledWith('provider_chip');

    await userEvent.click(screen.getByTestId('connectors-search-input'));
    expect(onProviderTabClick).toHaveBeenCalledWith('search_connectors');
  });

  it('opens the detail drawer for a connector and closes it', async () => {
    const dependencies = createFakeConnectorsDependencies({ connectors: [makeConnector({ description: 'A chat tool' })] });
    render(<ConnectorsBrowser unlocked dependencies={dependencies} />);
    await waitFor(() => expect(screen.getByText('Slack')).toBeTruthy());

    await userEvent.click(screen.getByRole('button', { name: 'Open details for Slack' }));
    await waitFor(() => expect(screen.getByTestId('connector-drawer')).toBeTruthy());

    await userEvent.click(screen.getByTestId('connector-drawer-close'));
    expect(screen.queryByTestId('connector-drawer')).toBeNull();
  });
});
