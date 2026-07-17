import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/index.js';
import { ConnectorsBrowser } from './ConnectorsBrowser.js';
import { createFakeConnectorsDependencies } from './dependencies.js';
import type { Connector, ConnectorActionResult } from './types.js';

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

  it('renders translated copy when mounted under an I18nProvider with a matching dictionary', async () => {
    const dependencies = createFakeConnectorsDependencies({ connectors: [makeConnector()] });
    render(
      <I18nProvider dictionaries={{ fr: { Connectors: 'Connecteurs', Connect: 'Connecter' } }} initialLocale="fr">
        <ConnectorsBrowser unlocked dependencies={dependencies} />
      </I18nProvider>,
    );
    expect(screen.getByText('Connecteurs')).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Connecter' })).toBeTruthy());
  });

  it('self-wires default dependencies, falls back to the default provider tab id, and threads onConnectorsChanged', async () => {
    const onConnectorsChanged = vi.fn();
    render(<ConnectorsBrowser unlocked={false} providerTabs={[]} onConnectorsChanged={onConnectorsChanged} />);
    await waitFor(() => expect(screen.getByTestId('connector-grid-wrap')).toBeTruthy());
    expect(screen.getByText('Connectors')).toBeTruthy();
  });

  it('disconnects a connector from the grid', async () => {
    const dependencies = createFakeConnectorsDependencies({ connectors: [makeConnector({ status: 'connected' })] });
    const onConnectorAuthResult = vi.fn();
    render(<ConnectorsBrowser unlocked dependencies={dependencies} onConnectorAuthResult={onConnectorAuthResult} />);
    await waitFor(() => expect(screen.getByText('Slack')).toBeTruthy());

    await userEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    await waitFor(() =>
      expect(onConnectorAuthResult).toHaveBeenCalledWith({ connectorId: 'slack', action: 'disconnect', result: 'success' }),
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Connect' })).toBeTruthy());
  });

  it('clears the search filter via the empty-state clear action', async () => {
    const dependencies = createFakeConnectorsDependencies({ connectors: [makeConnector()] });
    render(<ConnectorsBrowser unlocked dependencies={dependencies} />);
    await waitFor(() => expect(screen.getByText('Slack')).toBeTruthy());

    await userEvent.type(screen.getByTestId('connectors-search-input'), 'zzz-no-match');
    await waitFor(() => expect(screen.getByTestId('connectors-empty')).toBeTruthy());

    await userEvent.click(within(screen.getByTestId('connectors-empty')).getByRole('button', { name: 'Clear search' }));
    expect((screen.getByTestId('connectors-search-input') as HTMLInputElement).value).toBe('');
    await waitFor(() => expect(screen.getByText('Slack')).toBeTruthy());
  });

  it('shows authorization-pending controls in the grid and supports cancel + continue-in-browser', async () => {
    const connector = makeConnector({ id: 'notion', name: 'Notion' });
    const dependencies = createFakeConnectorsDependencies({ connectors: [connector] });
    const redirectUrl = 'https://auth.example.com/continue';
    dependencies.data.connectConnector = async (connectorId: string): Promise<ConnectorActionResult> => ({
      connector: { ...connector, id: connectorId, status: 'available' },
      auth: { kind: 'redirect_required', redirectUrl },
    });
    const openExternalUrlSpy = vi.spyOn(dependencies.data, 'openExternalUrl');
    render(<ConnectorsBrowser unlocked dependencies={dependencies} />);
    await waitFor(() => expect(screen.getByText('Notion')).toBeTruthy());

    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel authorization' })).toBeTruthy());

    await userEvent.click(screen.getByRole('button', { name: 'Continue in browser' }));
    expect(openExternalUrlSpy).toHaveBeenCalledWith(redirectUrl);

    await userEvent.click(screen.getByRole('button', { name: 'Cancel authorization' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cancel authorization' })).toBeNull());
  });

  it('shows authorization-pending controls in the detail drawer and supports cancel + continue-in-browser', async () => {
    const connector = makeConnector({ id: 'notion', name: 'Notion', description: 'A workspace tool' });
    const dependencies = createFakeConnectorsDependencies({ connectors: [connector] });
    const redirectUrl = 'https://auth.example.com/continue';
    dependencies.data.connectConnector = async (connectorId: string): Promise<ConnectorActionResult> => ({
      connector: { ...connector, id: connectorId, status: 'available' },
      auth: { kind: 'redirect_required', redirectUrl },
    });
    const openExternalUrlSpy = vi.spyOn(dependencies.data, 'openExternalUrl');
    render(<ConnectorsBrowser unlocked dependencies={dependencies} />);
    await waitFor(() => expect(screen.getByText('Notion')).toBeTruthy());

    const card = screen.getByText('Notion').closest('article') as HTMLElement;
    await userEvent.click(within(card).getByRole('button', { name: 'Connect' }));
    await waitFor(() => expect(within(card).getByRole('button', { name: 'Cancel authorization' })).toBeTruthy());

    await userEvent.click(screen.getByRole('button', { name: 'Open details for Notion' }));
    const drawer = screen.getByTestId('connector-drawer');
    await waitFor(() => expect(within(drawer).getByRole('button', { name: 'Continue in browser' })).toBeTruthy());

    await userEvent.click(within(drawer).getByRole('button', { name: 'Continue in browser' }));
    expect(openExternalUrlSpy).toHaveBeenCalledWith(redirectUrl);

    await userEvent.click(within(drawer).getByRole('button', { name: 'Cancel authorization' }));
    await waitFor(() => expect(within(drawer).queryByRole('button', { name: 'Cancel authorization' })).toBeNull());
  });

  it('supports connect, load-more-tools, and disconnect from the detail drawer, with custom label formatters', async () => {
    const availableConnector = makeConnector({
      id: 'available-conn',
      name: 'Available Co',
      status: 'available',
      tools: [{ name: 'tool-one', safety: { sideEffect: 'read' } }],
      toolsNextCursor: 'cursor-1',
    });
    const connectedConnector = makeConnector({
      id: 'connected-conn',
      name: 'Connected Co',
      status: 'connected',
      accountLabel: 'user@example.com',
    });
    const dependencies = createFakeConnectorsDependencies({ connectors: [availableConnector, connectedConnector] });
    const getCategoryLabel = vi.fn((category: string) => `Category: ${category}`);
    const getDisplayableAccountLabel = vi.fn((c: Connector) => c.accountLabel);
    render(
      <ConnectorsBrowser
        unlocked
        dependencies={dependencies}
        getCategoryLabel={getCategoryLabel}
        getDisplayableAccountLabel={getDisplayableAccountLabel}
      />,
    );
    await waitFor(() => expect(screen.getByText('Available Co')).toBeTruthy());

    await userEvent.click(screen.getByRole('button', { name: 'Open details for Available Co' }));
    const firstDrawer = screen.getByTestId('connector-drawer');
    await waitFor(() => expect(within(firstDrawer).getByRole('button', { name: 'Load more tools' })).toBeTruthy());
    await userEvent.click(within(firstDrawer).getByRole('button', { name: 'Load more tools' }));

    await userEvent.click(within(firstDrawer).getByRole('button', { name: 'Connect' }));
    await waitFor(() => expect(within(firstDrawer).queryByRole('button', { name: 'Connect' })).toBeNull());

    await userEvent.click(within(firstDrawer).getByTestId('connector-drawer-close'));
    await waitFor(() => expect(screen.queryByTestId('connector-drawer')).toBeNull());

    await userEvent.click(screen.getByRole('button', { name: 'Open details for Connected Co' }));
    const secondDrawer = screen.getByTestId('connector-drawer');
    expect(getCategoryLabel).toHaveBeenCalledWith('communication');
    expect(getDisplayableAccountLabel).toHaveBeenCalledWith(expect.objectContaining({ id: 'connected-conn' }));
    expect(within(secondDrawer).getByText('user@example.com')).toBeTruthy();

    await userEvent.click(within(secondDrawer).getByRole('button', { name: 'Disconnect' }));
    await waitFor(() => expect(within(secondDrawer).getByRole('button', { name: 'Connect' })).toBeTruthy());
  });

  it('reflects the in-flight pendingConnectorAction only for the matching connector in the detail drawer', async () => {
    const connectorA = makeConnector({ id: 'a', name: 'Connector A' });
    const connectorB = makeConnector({ id: 'b', name: 'Connector B' });
    const dependencies = createFakeConnectorsDependencies({ connectors: [connectorA, connectorB] });
    let resolveConnect: ((result: ConnectorActionResult) => void) | undefined;
    dependencies.data.connectConnector = () =>
      new Promise<ConnectorActionResult>((resolve) => {
        resolveConnect = resolve;
      });
    render(<ConnectorsBrowser unlocked dependencies={dependencies} />);
    await waitFor(() => expect(screen.getByText('Connector A')).toBeTruthy());

    const cardA = screen.getByText('Connector A').closest('article') as HTMLElement;
    await userEvent.click(within(cardA).getByRole('button', { name: 'Connect' }));

    // Connector B's drawer: no in-flight action for B, so its Connect button stays enabled.
    await userEvent.click(screen.getByRole('button', { name: 'Open details for Connector B' }));
    const drawerB = screen.getByTestId('connector-drawer');
    expect(within(drawerB).getByRole('button', { name: 'Connect' })).not.toBeDisabled();
    await userEvent.click(within(drawerB).getByTestId('connector-drawer-close'));
    await waitFor(() => expect(screen.queryByTestId('connector-drawer')).toBeNull());

    // Connector A's drawer: the in-flight action matches this connector, so it shows pending.
    await userEvent.click(screen.getByRole('button', { name: 'Open details for Connector A' }));
    const drawerA = screen.getByTestId('connector-drawer');
    expect(within(drawerA).getByRole('button', { name: 'Connect' })).toBeDisabled();

    resolveConnect?.({ connector: { ...connectorA, status: 'connected' }, auth: { kind: 'connected' } });
    await waitFor(() => expect(within(drawerA).queryByRole('button', { name: 'Connect' })).toBeNull());
  });

  it('fires onProviderTabClick and gate.onClick when the gate CTA is clicked', async () => {
    const dependencies = createFakeConnectorsDependencies({ connectors: [makeConnector()] });
    const onProviderTabClick = vi.fn();
    const gateOnClick = vi.fn();
    render(
      <ConnectorsBrowser
        unlocked={false}
        dependencies={dependencies}
        gate={{ title: 'Add a key', body: 'body', ctaLabel: 'Get key', ctaHref: 'https://example.com', onClick: gateOnClick }}
        onProviderTabClick={onProviderTabClick}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('connector-gate')).toBeTruthy());

    const gateLink = screen.getByTestId('connector-gate').querySelector('a') as HTMLAnchorElement;
    await userEvent.click(gateLink);
    expect(onProviderTabClick).toHaveBeenCalledWith('gate_card');
    expect(gateOnClick).toHaveBeenCalledTimes(1);
  });
});
