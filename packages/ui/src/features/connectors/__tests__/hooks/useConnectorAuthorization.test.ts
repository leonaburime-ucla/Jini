import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useConnectorAuthorization } from '../../hooks/useConnectorAuthorization.js';
import { createFakeConnectorsPort } from '../../dependencies.js';
import type { ConnectorAuthBridgePort, ConnectorAuthPendingStoragePort } from '../../ports.js';
import type { Connector, ConnectorAuthorizationPendingState } from '../../types.js';

function makeConnector(overrides: Partial<Connector> = {}): Connector {
  return { id: 'slack', name: 'Slack', provider: 'Composio', category: 'communication', status: 'available', tools: [], ...overrides };
}

function makeMemoryStorage(initial: ConnectorAuthorizationPendingState = {}): ConnectorAuthPendingStoragePort {
  let state = initial;
  return {
    load: () => state,
    save: (next) => {
      state = next;
    },
  };
}

function makeControllableBridge() {
  let authCallback: (() => void) | null = null;
  let refocusCallback: (() => void) | null = null;
  const bridge: ConnectorAuthBridgePort = {
    subscribeAuthCallback: (cb) => {
      authCallback = cb;
      return () => {
        authCallback = null;
      };
    },
    subscribeWindowRefocus: (cb) => {
      refocusCallback = cb;
      return () => {
        refocusCallback = null;
      };
    },
  };
  return {
    bridge,
    fireAuthCallback: () => authCallback?.(),
    fireRefocus: () => refocusCallback?.(),
  };
}

function useHarness(port: ReturnType<typeof createFakeConnectorsPort>, storage: ConnectorAuthPendingStoragePort, bridge: ConnectorAuthBridgePort) {
  return renderHook(
    ({ connectors }: { connectors: Connector[] }) => {
      const setConnectors = vi.fn();
      return useConnectorAuthorization(port, storage, bridge, { connectors, setConnectors });
    },
    { initialProps: { connectors: [makeConnector()] } },
  );
}

describe('useConnectorAuthorization', () => {
  it('starts with whatever the storage port had persisted', () => {
    const storage = makeMemoryStorage({ slack: { expiresAt: '2099-01-01T00:00:00Z' } });
    const { bridge } = makeControllableBridge();
    const port = createFakeConnectorsPort({ connectors: [makeConnector()] });
    const { result } = useHarness(port, storage, bridge);
    expect(result.current.pending).toEqual({ slack: { expiresAt: '2099-01-01T00:00:00Z' } });
  });

  it('a successful connect with a redirect records a pending authorization and calls onAuthResult', async () => {
    const port = createFakeConnectorsPort({ connectors: [makeConnector()] });
    port.connectConnector = vi.fn(async () => ({
      connector: makeConnector(),
      auth: { kind: 'redirect_required' as const, redirectUrl: 'https://oauth.example.com', expiresAt: '2099-01-01T00:00:00Z' },
    }));
    const storage = makeMemoryStorage();
    const { bridge } = makeControllableBridge();
    const onAuthResult = vi.fn();
    const { result } = renderHook(() => {
      const setConnectors = vi.fn();
      return useConnectorAuthorization(port, storage, bridge, {
        connectors: [makeConnector()],
        setConnectors,
        onAuthResult,
      });
    });

    await act(async () => {
      await result.current.runConnectorAction('slack', 'connect');
    });

    expect(result.current.pending.slack).toEqual({ expiresAt: '2099-01-01T00:00:00Z', redirectUrl: 'https://oauth.example.com' });
    expect(onAuthResult).toHaveBeenCalledWith({ connectorId: 'slack', action: 'connect', result: 'success' });
  });

  it('a failed connect records the error and does not leave a pending authorization', async () => {
    const port = createFakeConnectorsPort({ connectors: [makeConnector()] });
    port.connectConnector = vi.fn(async () => ({ connector: null, error: 'boom' }));
    const storage = makeMemoryStorage();
    const { bridge } = makeControllableBridge();
    const onAuthResult = vi.fn();
    const { result } = renderHook(() => {
      const setConnectors = vi.fn();
      return useConnectorAuthorization(port, storage, bridge, { connectors: [makeConnector()], setConnectors, onAuthResult });
    });

    await act(async () => {
      await result.current.runConnectorAction('slack', 'connect');
    });

    expect(result.current.authError.slack).toBe('boom');
    expect(result.current.pending.slack).toBeUndefined();
    expect(onAuthResult).toHaveBeenCalledWith({ connectorId: 'slack', action: 'connect', result: 'failed', errorCode: 'boom' });
  });

  it('ignores a second runConnectorAction while one is already pending', async () => {
    const port = createFakeConnectorsPort({ connectors: [makeConnector()] });
    let resolveConnect!: (value: import('../../types.js').ConnectorActionResult) => void;
    port.connectConnector = vi.fn(
      () =>
        new Promise<import('../../types.js').ConnectorActionResult>((resolve) => {
          resolveConnect = resolve;
        }),
    );
    const storage = makeMemoryStorage();
    const { bridge } = makeControllableBridge();
    const { result } = renderHook(() => {
      const setConnectors = vi.fn();
      return useConnectorAuthorization(port, storage, bridge, { connectors: [makeConnector()], setConnectors });
    });

    let firstCallDone = false;
    act(() => {
      void result.current.runConnectorAction('slack', 'connect').then(() => {
        firstCallDone = true;
      });
    });
    await act(async () => {
      await result.current.runConnectorAction('slack', 'disconnect');
    });
    expect(port.connectConnector).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveConnect({ connector: makeConnector({ status: 'connected' }), auth: { kind: 'connected' } });
      await Promise.resolve();
    });
    expect(firstCallDone).toBe(true);
  });

  it('reloadStatuses clears authError/cancelFailed once a connector reports connected', async () => {
    const port = createFakeConnectorsPort({ connectors: [makeConnector({ status: 'connected' })] });
    const storage = makeMemoryStorage();
    const { bridge } = makeControllableBridge();
    const { result } = renderHook(() => {
      const setConnectors = vi.fn();
      return useConnectorAuthorization(port, storage, bridge, { connectors: [makeConnector({ status: 'available' })], setConnectors });
    });

    // Seed a stale error/cancel-failed flag as if a prior attempt failed.
    act(() => {
      void result.current.cancelAuthorization('slack');
    });
    await waitFor(() => expect(result.current.cancelFailed.slack).toBeUndefined());
  });

  it('the OAuth callback bridge triggers a status reload', async () => {
    const port = createFakeConnectorsPort({ connectors: [makeConnector({ status: 'connected' })] });
    const fetchStatuses = vi.fn(port.fetchConnectorStatuses.bind(port));
    port.fetchConnectorStatuses = fetchStatuses;
    const storage = makeMemoryStorage();
    const { bridge, fireAuthCallback } = makeControllableBridge();
    renderHook(() => {
      const setConnectors = vi.fn();
      return useConnectorAuthorization(port, storage, bridge, { connectors: [makeConnector()], setConnectors });
    });

    expect(fetchStatuses).not.toHaveBeenCalled();
    await act(async () => {
      fireAuthCallback();
      await Promise.resolve();
    });
    expect(fetchStatuses).toHaveBeenCalledTimes(1);
  });

  it('window refocus reloads statuses and auto-cancels a stale pending authorization', async () => {
    // expiresAt is in the near future *as of mount* (so the load-time prune
    // below doesn't discard it before the refocus path ever runs), and goes
    // stale a moment later, before refocus fires — this is what actually
    // goes stale mid-session, as opposed to an already-expired entry from a
    // prior session (which the load-time prune test below covers instead).
    // Real timers throughout (a short real delay, not vi.useFakeTimers())
    // since waitFor's internal polling doesn't play well with mocked timers.
    const port = createFakeConnectorsPort({ connectors: [makeConnector({ status: 'available' })] });
    const cancelSpy = vi.spyOn(port, 'cancelConnectorAuthorization');
    const storage = makeMemoryStorage({ slack: { expiresAt: new Date(Date.now() + 20).toISOString() } });
    const { bridge, fireRefocus } = makeControllableBridge();
    const { result } = renderHook(() => {
      const setConnectors = vi.fn();
      return useConnectorAuthorization(port, storage, bridge, { connectors: [makeConnector()], setConnectors });
    });

    expect(result.current.pending.slack).toBeDefined();
    await new Promise((resolve) => setTimeout(resolve, 30));
    await act(async () => {
      fireRefocus();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(cancelSpy).toHaveBeenCalledWith('slack');
    await waitFor(() => expect(result.current.pending.slack).toBeUndefined());
  });

  it('prunes an already-expired pending entry from storage immediately on load (no refocus/poll needed)', () => {
    const port = createFakeConnectorsPort({ connectors: [makeConnector({ status: 'available' })] });
    const storage = makeMemoryStorage({ slack: { expiresAt: '2020-01-01T00:00:00Z' } });
    const { bridge } = makeControllableBridge();
    const { result } = renderHook(() => {
      const setConnectors = vi.fn();
      return useConnectorAuthorization(port, storage, bridge, { connectors: [makeConnector()], setConnectors });
    });

    expect(result.current.pending.slack).toBeUndefined();
  });

  it('does not auto-cancel a pending authorization that has not expired yet', async () => {
    const port = createFakeConnectorsPort({ connectors: [makeConnector({ status: 'available' })] });
    const cancelSpy = vi.spyOn(port, 'cancelConnectorAuthorization');
    const storage = makeMemoryStorage({ slack: { expiresAt: '2099-01-01T00:00:00Z' } });
    const { bridge, fireRefocus } = makeControllableBridge();
    renderHook(() => {
      const setConnectors = vi.fn();
      return useConnectorAuthorization(port, storage, bridge, { connectors: [makeConnector()], setConnectors });
    });

    await act(async () => {
      fireRefocus();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(cancelSpy).not.toHaveBeenCalled();
  });

  it('polls fetchConnectorStatuses on an interval while an authorization is pending, and stops once cleared', async () => {
    vi.useFakeTimers();
    try {
      const port = createFakeConnectorsPort({ connectors: [makeConnector({ status: 'available' })] });
      const fetchStatuses = vi.fn(port.fetchConnectorStatuses.bind(port));
      port.fetchConnectorStatuses = fetchStatuses;
      const storage = makeMemoryStorage({ slack: { expiresAt: '2099-01-01T00:00:00Z' } });
      const { bridge } = makeControllableBridge();
      renderHook(() => {
        const setConnectors = vi.fn();
        return useConnectorAuthorization(port, storage, bridge, { connectors: [makeConnector()], setConnectors, pollMs: 1000 });
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(fetchStatuses).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(fetchStatuses).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancelAuthorization falls back to marking cancel-failed when the port cannot cancel and status is not connected', async () => {
    const port = createFakeConnectorsPort({ connectors: [makeConnector({ status: 'available' })] });
    port.cancelConnectorAuthorization = vi.fn(async () => null);
    const storage = makeMemoryStorage();
    const { bridge } = makeControllableBridge();
    const { result } = renderHook(() => {
      const setConnectors = vi.fn();
      return useConnectorAuthorization(port, storage, bridge, { connectors: [makeConnector()], setConnectors });
    });

    await act(async () => {
      await result.current.cancelAuthorization('slack');
    });
    expect(result.current.cancelFailed.slack).toBe(true);
  });

  it('persists pending state to the storage port whenever it changes', async () => {
    const port = createFakeConnectorsPort({ connectors: [makeConnector()] });
    port.connectConnector = vi.fn(async () => ({
      connector: makeConnector(),
      auth: { kind: 'pending' as const },
    }));
    const storage = makeMemoryStorage();
    const saveSpy = vi.spyOn(storage, 'save');
    const { bridge } = makeControllableBridge();
    const { result } = renderHook(() => {
      const setConnectors = vi.fn();
      return useConnectorAuthorization(port, storage, bridge, { connectors: [makeConnector()], setConnectors });
    });

    await act(async () => {
      await result.current.runConnectorAction('slack', 'connect');
    });
    expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ slack: {} }));
  });
});
