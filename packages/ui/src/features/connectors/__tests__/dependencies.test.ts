import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createBrowserConnectorAuthBridge,
  createBrowserConnectorAuthPendingStorage,
  createFakeConnectorsPort,
} from '../dependencies.js';
import type { Connector } from '../types.js';

function makeConnector(overrides: Partial<Connector> = {}): Connector {
  return { id: 'slack', name: 'Slack', provider: 'Composio', category: 'communication', status: 'available', tools: [], ...overrides };
}

describe('createFakeConnectorsPort', () => {
  it('fetchConnectors returns a copy of the seeded catalog', async () => {
    const port = createFakeConnectorsPort({ connectors: [makeConnector()] });
    const connectors = await port.fetchConnectors();
    expect(connectors).toEqual([makeConnector()]);
  });

  it('connectConnector marks the connector connected', async () => {
    const port = createFakeConnectorsPort({ connectors: [makeConnector()] });
    const result = await port.connectConnector('slack');
    expect(result.connector?.status).toBe('connected');
    expect(result.auth).toEqual({ kind: 'connected' });
    const [refetched] = await port.fetchConnectors();
    expect(refetched!.status).toBe('connected');
  });

  it('connectConnector reports an error for an unknown id', async () => {
    const port = createFakeConnectorsPort({ connectors: [] });
    const result = await port.connectConnector('missing');
    expect(result.connector).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it('disconnectConnector marks the connector available again', async () => {
    const port = createFakeConnectorsPort({ connectors: [makeConnector({ status: 'connected' })] });
    const result = await port.disconnectConnector('slack');
    expect(result?.status).toBe('available');
  });

  it('disconnectConnector returns null for an unknown id', async () => {
    const port = createFakeConnectorsPort({ connectors: [] });
    expect(await port.disconnectConnector('missing')).toBeNull();
  });

  it('fetchConnectorStatuses reflects current status', async () => {
    const port = createFakeConnectorsPort({ connectors: [makeConnector({ status: 'connected', accountLabel: 'me@x.com' })] });
    const statuses = await port.fetchConnectorStatuses();
    expect(statuses.slack).toEqual({ status: 'connected', accountLabel: 'me@x.com' });
  });

  it('fetchConnectorDetail returns null for an unknown id', async () => {
    const port = createFakeConnectorsPort({ connectors: [] });
    expect(await port.fetchConnectorDetail('missing')).toBeNull();
  });

  it('honors simulated latency', async () => {
    vi.useFakeTimers();
    const port = createFakeConnectorsPort({ connectors: [makeConnector()], latencyMs: 50 });
    const promise = port.fetchConnectors();
    let resolved = false;
    void promise.then(() => {
      resolved = true;
    });
    await vi.advanceTimersByTimeAsync(10);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(50);
    expect(resolved).toBe(true);
    vi.useRealTimers();
  });
});

describe('createBrowserConnectorAuthPendingStorage', () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('load() returns {} when nothing is stored', () => {
    const storage = createBrowserConnectorAuthPendingStorage();
    expect(storage.load()).toEqual({});
  });

  it('save() then load() round-trips', () => {
    const storage = createBrowserConnectorAuthPendingStorage();
    storage.save({ slack: { expiresAt: '2099-01-01T00:00:00Z' } });
    expect(storage.load()).toEqual({ slack: { expiresAt: '2099-01-01T00:00:00Z' } });
  });

  it('save() with an empty object clears the stored key', () => {
    const storage = createBrowserConnectorAuthPendingStorage();
    storage.save({ slack: {} });
    storage.save({});
    expect(window.sessionStorage.getItem('jini-connectors-authorization-pending')).toBeNull();
  });
});

describe('createBrowserConnectorAuthBridge', () => {
  it('subscribeAuthCallback fires only for trusted-origin, correctly-typed messages', () => {
    const bridge = createBrowserConnectorAuthBridge();
    const onTrusted = vi.fn();
    const unsubscribe = bridge.subscribeAuthCallback(onTrusted);

    window.dispatchEvent(
      new MessageEvent('message', { data: { type: 'not-a-connector-message' }, origin: window.location.origin }),
    );
    expect(onTrusted).not.toHaveBeenCalled();

    window.dispatchEvent(
      new MessageEvent('message', { data: { type: 'jini:connector-connected' }, origin: 'https://evil.example.com' }),
    );
    expect(onTrusted).not.toHaveBeenCalled();

    window.dispatchEvent(
      new MessageEvent('message', { data: { type: 'jini:connector-connected' }, origin: window.location.origin }),
    );
    expect(onTrusted).toHaveBeenCalledTimes(1);

    unsubscribe();
    window.dispatchEvent(
      new MessageEvent('message', { data: { type: 'jini:connector-connected' }, origin: window.location.origin }),
    );
    expect(onTrusted).toHaveBeenCalledTimes(1);
  });

  it('subscribeWindowRefocus fires on focus and pageshow, and on visibilitychange only when visible', () => {
    const bridge = createBrowserConnectorAuthBridge();
    const onRefocus = vi.fn();
    const unsubscribe = bridge.subscribeWindowRefocus(onRefocus);

    window.dispatchEvent(new Event('focus'));
    expect(onRefocus).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event('pageshow'));
    expect(onRefocus).toHaveBeenCalledTimes(2);

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(onRefocus).toHaveBeenCalledTimes(2);

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(onRefocus).toHaveBeenCalledTimes(3);

    unsubscribe();
    window.dispatchEvent(new Event('focus'));
    expect(onRefocus).toHaveBeenCalledTimes(3);

    vi.restoreAllMocks();
  });
});
