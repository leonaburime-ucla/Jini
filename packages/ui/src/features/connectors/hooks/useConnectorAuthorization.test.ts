import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useConnectorAuthorization } from './useConnectorAuthorization.js';
import { createFakeConnectorsPort } from '../dependencies.js';
import type { ConnectorAuthBridgePort, ConnectorAuthPendingStoragePort } from '../ports.js';
import type { Connector, ConnectorAuthorizationPendingState } from '../types.js';

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
    let resolveConnect!: (value: import('../types.js').ConnectorActionResult) => void;
    port.connectConnector = vi.fn(
      () =>
        new Promise<import('../types.js').ConnectorActionResult>((resolve) => {
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

  it('updateConnector (via a successful action) merges the matching connector into setConnectors and leaves others untouched', async () => {
    const port = createFakeConnectorsPort({ connectors: [makeConnector()] });
    const storage = makeMemoryStorage();
    const { bridge } = makeControllableBridge();
    const setConnectors = vi.fn();
    const { result } = renderHook(() =>
      useConnectorAuthorization(port, storage, bridge, { connectors: [makeConnector()], setConnectors }),
    );

    await act(async () => {
      await result.current.runConnectorAction('slack', 'connect');
    });

    const updater = setConnectors.mock.calls.at(-1)?.[0] as (curr: Connector[]) => Connector[];
    expect(typeof updater).toBe('function');
    const other = makeConnector({ id: 'github', name: 'GitHub' });
    const staleSlack = makeConnector({ status: 'available' });
    const merged = updater([other, staleSlack]);
    expect(merged[0]).toBe(other);
    expect(merged[1]?.status).toBe('connected');
  });

  it('reloadStatuses calls onConnectorsChanged when a status actually changed', async () => {
    const port = createFakeConnectorsPort({ connectors: [makeConnector({ status: 'connected' })] });
    const storage = makeMemoryStorage();
    const { bridge } = makeControllableBridge();
    const onConnectorsChanged = vi.fn();
    const { result } = renderHook(() => {
      const setConnectors = vi.fn();
      return useConnectorAuthorization(port, storage, bridge, {
        connectors: [makeConnector({ status: 'available' })],
        setConnectors,
        onConnectorsChanged,
      });
    });

    await act(async () => {
      await result.current.reloadStatuses();
    });
    expect(onConnectorsChanged).toHaveBeenCalledTimes(1);
  });

  it('a connect that lands as immediately connected calls onConnectorsChanged', async () => {
    const port = createFakeConnectorsPort({ connectors: [makeConnector()] });
    const onConnectorsChanged = vi.fn();
    const storage = makeMemoryStorage();
    const { bridge } = makeControllableBridge();
    const { result } = renderHook(() => {
      const setConnectors = vi.fn();
      return useConnectorAuthorization(port, storage, bridge, {
        connectors: [makeConnector()],
        setConnectors,
        onConnectorsChanged,
      });
    });

    await act(async () => {
      await result.current.runConnectorAction('slack', 'connect');
    });
    expect(onConnectorsChanged).toHaveBeenCalledTimes(1);
  });

  it('a failed connect with no error field skips setAuthError and reports onAuthResult without an errorCode', async () => {
    const port = createFakeConnectorsPort({ connectors: [makeConnector()] });
    port.connectConnector = vi.fn(async () => ({ connector: null }));
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
    expect(result.current.authError.slack).toBeUndefined();
    expect(onAuthResult).toHaveBeenCalledWith({ connectorId: 'slack', action: 'connect', result: 'failed' });
  });

  it('a connect that throws reports onAuthResult as failed and rethrows', async () => {
    const port = createFakeConnectorsPort({ connectors: [makeConnector()] });
    port.connectConnector = vi.fn(async () => {
      throw new Error('network down');
    });
    const storage = makeMemoryStorage();
    const { bridge } = makeControllableBridge();
    const onAuthResult = vi.fn();
    const { result } = renderHook(() => {
      const setConnectors = vi.fn();
      return useConnectorAuthorization(port, storage, bridge, { connectors: [makeConnector()], setConnectors, onAuthResult });
    });

    await act(async () => {
      await expect(result.current.runConnectorAction('slack', 'connect')).rejects.toThrow('network down');
    });
    expect(onAuthResult).toHaveBeenCalledWith({
      connectorId: 'slack',
      action: 'connect',
      result: 'failed',
      errorCode: 'network down',
    });
    // pendingConnectorAction must still be cleared by the `finally` even though the action threw.
    expect(result.current.pendingConnectorAction).toBeNull();
  });

  it('a connect clears pre-existing cancelFailed/authError entries for that connector before retrying', async () => {
    const port = createFakeConnectorsPort({ connectors: [makeConnector({ status: 'available' })] });
    port.cancelConnectorAuthorization = vi.fn(async () => null);
    const storage = makeMemoryStorage();
    const { bridge } = makeControllableBridge();
    const { result } = renderHook(() => {
      const setConnectors = vi.fn();
      return useConnectorAuthorization(port, storage, bridge, { connectors: [makeConnector()], setConnectors });
    });

    // Seed cancelFailed.slack via a failed direct cancel.
    await act(async () => {
      await result.current.cancelAuthorization('slack');
    });
    expect(result.current.cancelFailed.slack).toBe(true);

    // Seed authError.slack via a failed connect.
    port.connectConnector = vi.fn(async () => ({ connector: null, error: 'boom' }));
    await act(async () => {
      await result.current.runConnectorAction('slack', 'connect');
    });
    expect(result.current.authError.slack).toBe('boom');

    // A subsequent connect attempt must clear both stale flags up front, even though this attempt also fails.
    port.connectConnector = vi.fn(async () => ({ connector: null, error: 'boom-2' }));
    await act(async () => {
      await result.current.runConnectorAction('slack', 'connect');
    });
    // cancelFailed was cleared by the preamble and never re-set by a connect action.
    expect(result.current.cancelFailed.slack).toBeUndefined();
  });

  it('disconnect succeeds, clears a pre-existing authError, and notifies onConnectorsChanged/onAuthResult', async () => {
    const port = createFakeConnectorsPort({ connectors: [makeConnector({ status: 'connected' })] });
    port.connectConnector = vi.fn(async () => ({ connector: null, error: 'boom' }));
    const storage = makeMemoryStorage();
    const { bridge } = makeControllableBridge();
    const onConnectorsChanged = vi.fn();
    const onAuthResult = vi.fn();
    const { result } = renderHook(() => {
      const setConnectors = vi.fn();
      return useConnectorAuthorization(port, storage, bridge, {
        connectors: [makeConnector({ status: 'connected' })],
        setConnectors,
        onConnectorsChanged,
        onAuthResult,
      });
    });

    // Seed authError.slack via a failed connect (harmless no-op against an already-connected connector in the fake).
    await act(async () => {
      await result.current.runConnectorAction('slack', 'connect');
    });
    expect(result.current.authError.slack).toBe('boom');

    await act(async () => {
      await result.current.runConnectorAction('slack', 'disconnect');
    });
    expect(result.current.authError.slack).toBeUndefined();
    expect(onConnectorsChanged).toHaveBeenCalledTimes(1);
    expect(onAuthResult).toHaveBeenCalledWith({ connectorId: 'slack', action: 'disconnect', result: 'success' });
  });

  it('a disconnect that throws reports onAuthResult as failed and rethrows', async () => {
    const port = createFakeConnectorsPort({ connectors: [makeConnector({ status: 'connected' })] });
    port.disconnectConnector = vi.fn(async () => {
      throw new Error('disconnect failed');
    });
    const storage = makeMemoryStorage();
    const { bridge } = makeControllableBridge();
    const onAuthResult = vi.fn();
    const { result } = renderHook(() => {
      const setConnectors = vi.fn();
      return useConnectorAuthorization(port, storage, bridge, {
        connectors: [makeConnector({ status: 'connected' })],
        setConnectors,
        onAuthResult,
      });
    });

    await act(async () => {
      await expect(result.current.runConnectorAction('slack', 'disconnect')).rejects.toThrow('disconnect failed');
    });
    expect(onAuthResult).toHaveBeenCalledWith({
      connectorId: 'slack',
      action: 'disconnect',
      result: 'failed',
      errorCode: 'disconnect failed',
    });
  });

  it('a stale authorization whose cancel throws marks it cancel-failed instead of crashing', async () => {
    const port = createFakeConnectorsPort({ connectors: [makeConnector({ status: 'available' })] });
    port.cancelConnectorAuthorization = vi.fn(async () => {
      throw new Error('cancel network error');
    });
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

    await waitFor(() => expect(result.current.cancelFailed.slack).toBe(true));
  });

  it('a stale authorization that later auto-cancels successfully clears a pre-existing cancelFailed flag', async () => {
    const port = createFakeConnectorsPort({ connectors: [makeConnector({ status: 'available' })] });
    port.cancelConnectorAuthorization = vi.fn(async () => null);
    const storage = makeMemoryStorage({ slack: { expiresAt: new Date(Date.now() + 20).toISOString() } });
    const { bridge, fireRefocus } = makeControllableBridge();
    const { result } = renderHook(() => {
      const setConnectors = vi.fn();
      return useConnectorAuthorization(port, storage, bridge, { connectors: [makeConnector()], setConnectors });
    });

    // Seed cancelFailed.slack directly, without disturbing the still-fresh pending.slack entry
    // (a failed direct cancelAuthorization call only touches cancelFailed, never pending).
    await act(async () => {
      await result.current.cancelAuthorization('slack');
    });
    expect(result.current.cancelFailed.slack).toBe(true);
    expect(result.current.pending.slack).toBeDefined();

    // Now let the entry go stale and let the auto-cancel on refocus succeed this time.
    port.cancelConnectorAuthorization = vi.fn(async () => makeConnector({ status: 'available' }));
    await new Promise((resolve) => setTimeout(resolve, 30));
    await act(async () => {
      fireRefocus();
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.cancelFailed.slack).toBeUndefined());
  });

  it('cancelAuthorization clears pre-existing cancelFailed/authError entries on a direct successful cancel', async () => {
    const port = createFakeConnectorsPort({ connectors: [makeConnector({ status: 'available' })] });
    const storage = makeMemoryStorage();
    const { bridge } = makeControllableBridge();
    const { result } = renderHook(() => {
      const setConnectors = vi.fn();
      return useConnectorAuthorization(port, storage, bridge, { connectors: [makeConnector()], setConnectors });
    });

    // Seed authError.slack FIRST via a failed connect. At this point cancelFailed.slack is
    // still empty, so the connect preamble's cancelFailed-clear below is a no-op and doesn't
    // disturb anything yet.
    port.connectConnector = vi.fn(async () => ({ connector: null, error: 'boom' }));
    await act(async () => {
      await result.current.runConnectorAction('slack', 'connect');
    });
    expect(result.current.authError.slack).toBe('boom');

    // Now seed cancelFailed.slack via a failed direct cancel. This path only ever touches
    // cancelFailed, never authError, so authError.slack survives untouched.
    port.cancelConnectorAuthorization = vi.fn(async () => null);
    await act(async () => {
      await result.current.cancelAuthorization('slack');
    });
    expect(result.current.cancelFailed.slack).toBe(true);
    expect(result.current.authError.slack).toBe('boom');

    // A direct cancel that now succeeds must clear both in the same call.
    port.cancelConnectorAuthorization = vi.fn(async () => makeConnector({ status: 'available' }));
    await act(async () => {
      await result.current.cancelAuthorization('slack');
    });
    expect(result.current.cancelFailed.slack).toBeUndefined();
    expect(result.current.authError.slack).toBeUndefined();
  });

  it('a connect that throws a non-Error value stringifies it for the errorCode', async () => {
    const port = createFakeConnectorsPort({ connectors: [makeConnector()] });
    port.connectConnector = vi.fn(async () => {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw 'plain string failure';
    });
    const storage = makeMemoryStorage();
    const { bridge } = makeControllableBridge();
    const onAuthResult = vi.fn();
    const { result } = renderHook(() => {
      const setConnectors = vi.fn();
      return useConnectorAuthorization(port, storage, bridge, { connectors: [makeConnector()], setConnectors, onAuthResult });
    });

    await act(async () => {
      await expect(result.current.runConnectorAction('slack', 'connect')).rejects.toBe('plain string failure');
    });
    expect(onAuthResult).toHaveBeenCalledWith({
      connectorId: 'slack',
      action: 'connect',
      result: 'failed',
      errorCode: 'plain string failure',
    });
  });

  it('a disconnect that throws a non-Error value stringifies it for the errorCode', async () => {
    const port = createFakeConnectorsPort({ connectors: [makeConnector({ status: 'connected' })] });
    port.disconnectConnector = vi.fn(async () => {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw 'plain disconnect failure';
    });
    const storage = makeMemoryStorage();
    const { bridge } = makeControllableBridge();
    const onAuthResult = vi.fn();
    const { result } = renderHook(() => {
      const setConnectors = vi.fn();
      return useConnectorAuthorization(port, storage, bridge, {
        connectors: [makeConnector({ status: 'connected' })],
        setConnectors,
        onAuthResult,
      });
    });

    await act(async () => {
      await expect(result.current.runConnectorAction('slack', 'disconnect')).rejects.toBe('plain disconnect failure');
    });
    expect(onAuthResult).toHaveBeenCalledWith({
      connectorId: 'slack',
      action: 'disconnect',
      result: 'failed',
      errorCode: 'plain disconnect failure',
    });
  });

  it('cancelAuthorization does not mark cancel-failed when the status refresh shows it already connected', async () => {
    const port = createFakeConnectorsPort({ connectors: [makeConnector({ status: 'connected' })] });
    port.cancelConnectorAuthorization = vi.fn(async () => null);
    const storage = makeMemoryStorage();
    const { bridge } = makeControllableBridge();
    const { result } = renderHook(() => {
      const setConnectors = vi.fn();
      return useConnectorAuthorization(port, storage, bridge, { connectors: [makeConnector({ status: 'connected' })], setConnectors });
    });

    await act(async () => {
      await result.current.cancelAuthorization('slack');
    });
    expect(result.current.cancelFailed.slack).toBeUndefined();
  });

  it('cancelAuthorization marks cancel-failed when the fallback status refresh itself throws', async () => {
    const port = createFakeConnectorsPort({ connectors: [makeConnector({ status: 'available' })] });
    port.cancelConnectorAuthorization = vi.fn(async () => null);
    port.fetchConnectorStatuses = vi.fn(async () => {
      throw new Error('status refresh failed');
    });
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
});
