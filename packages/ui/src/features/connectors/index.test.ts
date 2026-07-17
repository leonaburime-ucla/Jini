import { describe, expect, it } from 'vitest';
import * as connectors from './index.js';

/**
 * A barrel-only smoke test: every other test in this feature imports from
 * the concrete module (`./rules.js`, `./dependencies.js`, etc.) rather than
 * `./index.js`, so nothing else actually loads/exercises this file's
 * re-export statements. Importing the barrel here both closes that coverage
 * gap and catches a real class of bug — a typo'd or missing re-export name
 * that unit tests hitting the concrete modules directly would never notice.
 */
describe('connectors barrel (index.ts)', () => {
  it('re-exports the constants', () => {
    expect(connectors.CONNECTOR_AUTH_PENDING_STORAGE_KEY).toBe('jini-connectors-authorization-pending');
    expect(connectors.CONNECTOR_AUTH_PENDING_POLL_MS).toBeGreaterThan(0);
    expect(connectors.CONNECTOR_TOOL_PREVIEW_LIMIT).toBeGreaterThan(0);
    expect(connectors.AUTHORIZATION_CANCEL_FAILED_MESSAGE).toEqual(expect.any(String));
    expect(connectors.CONNECTOR_AUTH_CONTINUE_LABEL).toEqual(expect.any(String));
    expect(connectors.DEFAULT_PROVIDER_TABS.map((tab) => tab.id)).toEqual(['default']);
    expect(connectors.DEFAULT_PROVIDER_TAB_ID).toBe('default');
  });

  it('re-exports the pure rule functions', () => {
    expect(connectors.formatToolsBadge(0)).toBe('No tools');
    expect(connectors.statusLabel('connected')).toBe('Connected');
    expect(connectors.getDisplayableConnectorAccountLabel({ accountLabel: 'me@x.com' } as never)).toBe('me@x.com');
    expect(connectors.defaultCategoryLabel('communication')).toBe('communication');
    expect(connectors.toolsBadgeTranslation(1)).toEqual({ key: '1 tool' });
    expect(connectors.fallbackLogoInitials('Slack')).toBe('Sl');
    expect(connectors.fallbackLogoPaletteIndex('slack', 6)).toBe(connectors.fallbackLogoPaletteIndex('slack', 6));
    expect(
      connectors.isTrustedConnectorCallbackOrigin('https://app.example.com', 'https://app.example.com'),
    ).toBe(true);
    expect(connectors.mergeConnectors([], [])).toEqual([]);
    expect(connectors.pruneConnectorAuthorizationPending({}, Date.now())).toEqual({});
    expect(connectors.parseConnectorAuthorizationPendingState('not json')).toEqual({});
    expect(connectors.connectorPanelAlerts([], null, {}, {}, 'msg')).toEqual([]);
  });

  it('re-exports the dependency factories, hooks, and components as functions', () => {
    expect(typeof connectors.createBrowserConnectorAuthBridge).toBe('function');
    expect(typeof connectors.createBrowserConnectorAuthPendingStorage).toBe('function');
    expect(typeof connectors.createFakeConnectorsDependencies).toBe('function');
    expect(typeof connectors.createFakeConnectorsPort).toBe('function');

    expect(typeof connectors.useConnectorCatalog).toBe('function');
    expect(typeof connectors.useConnectorAuthorization).toBe('function');
    expect(typeof connectors.useConnectorDetail).toBe('function');

    expect(typeof connectors.ConnectorsBrowser).toBe('function');
    expect(typeof connectors.ConnectorLogo).toBe('function');
    expect(typeof connectors.ProviderTabBar).toBe('function');
    expect(typeof connectors.ConnectorSearchBar).toBe('function');
    expect(typeof connectors.ConnectorGate).toBe('function');
    expect(typeof connectors.ConnectorAlertList).toBe('function');
    expect(typeof connectors.ConnectorCard).toBe('function');
    expect(typeof connectors.ConnectorGrid).toBe('function');
    expect(typeof connectors.ConnectorDetailDrawer).toBe('function');
  });
});
