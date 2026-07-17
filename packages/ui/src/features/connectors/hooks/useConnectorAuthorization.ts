import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ConnectorAuthBridgePort, ConnectorAuthPendingStoragePort, ConnectorsPort } from '../ports.js';
import type {
  Connector,
  ConnectorAction,
  ConnectorAuthorizationPendingState,
  ConnectorAuthResultEvent,
  ConnectorStatusMap,
  PendingConnectorAction,
} from '../types.js';
import {
  applyConnectorStatuses,
  clearConnectorAuthorizationCancelFailuresForConnected,
  clearConnectorAuthorizationErrorsForConnected,
  clearConnectorAuthorizationPending,
  findStaleAuthorizations,
  hasConnectorStatusChanges,
  mergeConnectorActionResult,
  pruneConnectorAuthorizationPending,
  updateConnectorAuthorizationPendingFromConnectResponse,
  updateConnectorAuthorizationPendingFromStatuses,
} from '../rules.js';
import { CONNECTOR_AUTH_PENDING_POLL_MS } from '../constants.js';

export interface UseConnectorAuthorizationParams {
  connectors: Connector[];
  setConnectors: Dispatch<SetStateAction<Connector[]>>;
  /** Fired when a status refresh detects a real connect/disconnect change (for cross-surface refresh). */
  onConnectorsChanged?: () => void;
  onAuthResult?: (event: ConnectorAuthResultEvent) => void;
  pollMs?: number;
}

export interface ConnectorAuthorizationController {
  pending: ConnectorAuthorizationPendingState;
  cancelFailed: Record<string, boolean>;
  authError: Record<string, string>;
  pendingConnectorAction: PendingConnectorAction | null;
  reloadStatuses: () => Promise<ConnectorStatusMap>;
  runConnectorAction: (connectorId: string, action: ConnectorAction) => Promise<void>;
  cancelAuthorization: (connectorId: string) => Promise<void>;
}

/**
 * The concurrency-correctness core: persists in-flight OAuth authorization
 * state, polls statuses while anything is pending, listens for the OAuth
 * popup's postMessage callback, and refreshes + auto-cancels stale
 * authorizations on window refocus (a system-browser auth flow has no
 * opener to post back to, so this is the only way that path resolves).
 */
export function useConnectorAuthorization(
  port: ConnectorsPort,
  authPendingStorage: ConnectorAuthPendingStoragePort,
  authBridge: ConnectorAuthBridgePort,
  params: UseConnectorAuthorizationParams,
): ConnectorAuthorizationController {
  const { connectors, setConnectors, onConnectorsChanged, onAuthResult, pollMs = CONNECTOR_AUTH_PENDING_POLL_MS } = params;

  const [pending, setPending] = useState<ConnectorAuthorizationPendingState>(() =>
    pruneConnectorAuthorizationPending(authPendingStorage.load(), Date.now()),
  );
  const [cancelFailed, setCancelFailed] = useState<Record<string, boolean>>({});
  const [authError, setAuthError] = useState<Record<string, string>>({});
  const [pendingConnectorAction, setPendingConnectorAction] = useState<PendingConnectorAction | null>(null);

  const connectorsRef = useRef(connectors);
  useEffect(() => {
    connectorsRef.current = connectors;
  }, [connectors]);

  const pendingRef = useRef(pending);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  const updateConnector = useCallback(
    (next: Connector | null) => {
      if (!next) return;
      setConnectors((curr) => curr.map((c) => (c.id === next.id ? mergeConnectorActionResult(c, next) : c)));
    },
    [setConnectors],
  );

  const reloadStatuses = useCallback(async (): Promise<ConnectorStatusMap> => {
    const statuses = await port.fetchConnectorStatuses();
    const statusChanged = hasConnectorStatusChanges(connectorsRef.current, statuses);
    setConnectors((curr) => applyConnectorStatuses(curr, statuses));
    setPending((curr) => updateConnectorAuthorizationPendingFromStatuses(curr, statuses, Date.now()));
    setAuthError((curr) => clearConnectorAuthorizationErrorsForConnected(curr, statuses));
    setCancelFailed((curr) => clearConnectorAuthorizationCancelFailuresForConnected(curr, statuses));
    if (statusChanged) onConnectorsChanged?.();
    return statuses;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [port, setConnectors, onConnectorsChanged]);

  const cancelStaleAuthorizations = useCallback(
    async (pendingBeforeReload: ConnectorAuthorizationPendingState, statuses: ConnectorStatusMap) => {
      const stuck = findStaleAuthorizations(pendingBeforeReload, statuses, Date.now());
      if (stuck.length === 0) return;
      await Promise.allSettled(
        stuck.map(async (connectorId) => {
          let connector: Connector | null = null;
          try {
            connector = await port.cancelConnectorAuthorization(connectorId);
          } catch {
            connector = null;
          }
          if (!connector) {
            setCancelFailed((curr) => ({ ...curr, [connectorId]: true }));
            return;
          }
          updateConnector(connector);
          setCancelFailed((curr) => {
            if (curr[connectorId] === undefined) return curr;
            const next = { ...curr };
            delete next[connectorId];
            return next;
          });
          // No authError clear here (unlike the sibling cancelFailed clear
          // above): authError[connectorId] and pending[connectorId] can
          // never be simultaneously truthy by the time this runs. A failed
          // connect is the only thing that ever sets authError[connectorId],
          // and it unconditionally clears pending[connectorId] in the same
          // call (see the `else` branch of runConnectorAction's connect
          // case below); pending[connectorId] can only become truthy again
          // via a *successful* connect for that id, whose preamble clears
          // authError[connectorId] first, or via the initial storage load,
          // when authError is still always empty. So a stale, about-to-be
          // auto-cancelled pending entry implies authError[connectorId] is
          // already undefined here.
          setPending((curr) => clearConnectorAuthorizationPending(curr, connectorId));
        }),
      );
    },
    [port, updateConnector],
  );

  // Persist pending state whenever it changes.
  useEffect(() => {
    authPendingStorage.save(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  // Poll statuses while any authorization is in flight.
  useEffect(() => {
    if (Object.keys(pending).length === 0) return;
    const interval = setInterval(() => {
      setPending((curr) => pruneConnectorAuthorizationPending(curr, Date.now()));
      void reloadStatuses();
    }, pollMs);
    return () => clearInterval(interval);
  }, [pending, pollMs, reloadStatuses]);

  // OAuth popup/system-browser callback.
  useEffect(() => authBridge.subscribeAuthCallback(() => void reloadStatuses()), [authBridge, reloadStatuses]);

  // Refresh + auto-cancel stale authorizations on window refocus.
  useEffect(
    () =>
      authBridge.subscribeWindowRefocus(() => {
        void (async () => {
          const pendingBeforeReload = pendingRef.current;
          const statuses = await reloadStatuses();
          await cancelStaleAuthorizations(pendingBeforeReload, statuses);
        })();
      }),
    [authBridge, reloadStatuses, cancelStaleAuthorizations],
  );

  const runConnectorAction = useCallback(
    async (connectorId: string, action: ConnectorAction) => {
      if (pendingConnectorAction) return;
      setPendingConnectorAction({ connectorId, action });
      try {
        if (action === 'connect') {
          setCancelFailed((curr) => {
            if (curr[connectorId] === undefined) return curr;
            const next = { ...curr };
            delete next[connectorId];
            return next;
          });
          setAuthError((curr) => {
            if (curr[connectorId] === undefined) return curr;
            const next = { ...curr };
            delete next[connectorId];
            return next;
          });
          try {
            const result = await port.connectConnector(connectorId);
            updateConnector(result.connector);
            if (result.connector && !result.error) {
              if (result.connector.status === 'connected') onConnectorsChanged?.();
              setPending((curr) => updateConnectorAuthorizationPendingFromConnectResponse(curr, result, Date.now()));
              onAuthResult?.({ connectorId, action: 'connect', result: 'success' });
            } else {
              setPending((curr) => clearConnectorAuthorizationPending(curr, connectorId));
              if (result.error) {
                setAuthError((curr) => ({ ...curr, [connectorId]: result.error! }));
              }
              onAuthResult?.({ connectorId, action: 'connect', result: 'failed', ...(result.error ? { errorCode: result.error } : {}) });
            }
          } catch (err) {
            onAuthResult?.({
              connectorId,
              action: 'connect',
              result: 'failed',
              errorCode: err instanceof Error ? err.message : String(err),
            });
            throw err;
          }
        } else {
          setPending((curr) => clearConnectorAuthorizationPending(curr, connectorId));
          setAuthError((curr) => {
            if (curr[connectorId] === undefined) return curr;
            const next = { ...curr };
            delete next[connectorId];
            return next;
          });
          try {
            updateConnector(await port.disconnectConnector(connectorId));
            onConnectorsChanged?.();
            onAuthResult?.({ connectorId, action: 'disconnect', result: 'success' });
          } catch (err) {
            onAuthResult?.({
              connectorId,
              action: 'disconnect',
              result: 'failed',
              errorCode: err instanceof Error ? err.message : String(err),
            });
            throw err;
          }
        }
      } finally {
        setPendingConnectorAction(null);
      }
    },
    [pendingConnectorAction, port, updateConnector, onConnectorsChanged, onAuthResult],
  );

  const cancelAuthorization = useCallback(
    async (connectorId: string) => {
      const connector = await port.cancelConnectorAuthorization(connectorId);
      if (connector) {
        updateConnector(connector);
        setCancelFailed((curr) => {
          if (curr[connectorId] === undefined) return curr;
          const next = { ...curr };
          delete next[connectorId];
          return next;
        });
        setAuthError((curr) => {
          if (curr[connectorId] === undefined) return curr;
          const next = { ...curr };
          delete next[connectorId];
          return next;
        });
        setPending((curr) => clearConnectorAuthorizationPending(curr, connectorId));
        return;
      }
      try {
        const statuses = await reloadStatuses();
        if (statuses[connectorId]?.status === 'connected') return;
      } catch {
        // Keep the local failure visible when the status refresh itself fails.
      }
      setCancelFailed((curr) => ({ ...curr, [connectorId]: true }));
    },
    [port, updateConnector, reloadStatuses],
  );

  return { pending, cancelFailed, authError, pendingConnectorAction, reloadStatuses, runConnectorAction, cancelAuthorization };
}
