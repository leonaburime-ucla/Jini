import type { KeyboardEvent as ReactKeyboardEvent, SyntheticEvent } from 'react';
import type { Connector, ConnectorAction, ConnectorAuthorizationPending } from '../types.js';
import { formatToolsBadge, getConnectorDisplayToolCount, statusLabel } from '../rules.js';
import { Icon } from '../../../components/Icon.js';
import { ConnectorLogo } from './ConnectorLogo.js';

export interface ConnectorCardProps {
  connector: Connector;
  disabled?: boolean;
  pendingAction: ConnectorAction | null;
  authorizationPending?: ConnectorAuthorizationPending | undefined;
  authorizationCancelFailed: boolean;
  toolsLoaded: boolean;
  onConnect: (connectorId: string) => void;
  onDisconnect: (connectorId: string) => void;
  onCancelAuthorization: (connectorId: string) => void;
  onOpenDetails: (connectorId: string) => void;
  getCategoryLabel?: (category: string) => string;
  cancelFailedMessage?: string;
  continueInBrowserLabel?: string;
  onOpenExternalUrl?: (url: string) => void;
}

export function ConnectorCard({
  connector,
  disabled = false,
  pendingAction,
  authorizationPending,
  authorizationCancelFailed,
  toolsLoaded,
  onConnect,
  onDisconnect,
  onCancelAuthorization,
  onOpenDetails,
  getCategoryLabel = (category) => category,
  cancelFailedMessage = "Couldn't cancel authorization. Try again.",
  continueInBrowserLabel = 'Continue in browser',
  onOpenExternalUrl,
}: ConnectorCardProps) {
  const isConnecting = pendingAction === 'connect';
  const isDisconnecting = pendingAction === 'disconnect';
  const isConnected = connector.status === 'connected';
  const isAuthorizationPending = !isConnected && authorizationPending !== undefined;
  const isPending = pendingAction !== null || isAuthorizationPending;
  const canConnect = !disabled && !isPending && connector.status === 'available';
  const canDisconnect = !disabled && !isPending && isConnected;
  const toolCount = getConnectorDisplayToolCount(connector);
  const showToolsBadge = connector.toolCount !== undefined || connector.tools.length > 0 || toolsLoaded;
  const toolsBadgeLabel = formatToolsBadge(toolCount);
  const categoryLabel = getCategoryLabel(connector.category);

  function openDetails() {
    if (disabled) return;
    onOpenDetails(connector.id);
  }

  function onKeyActivate(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    openDetails();
  }

  function stop(event: SyntheticEvent) {
    event.stopPropagation();
  }

  function continueAuthorization(event: SyntheticEvent) {
    stop(event);
    if (!authorizationPending?.redirectUrl) return;
    onOpenExternalUrl?.(authorizationPending.redirectUrl);
  }

  return (
    <article
      className={`connector-card status-${connector.status}${disabled ? ' is-locked' : ''}`}
      data-connector-id={connector.id}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-label={`Open details for ${connector.name}`}
      onClick={openDetails}
      onKeyDown={onKeyActivate}
    >
      <div className="connector-card-top">
        <ConnectorLogo connectorId={connector.id} connectorName={connector.name} logoUrl={connector.logoUrl} size="sm" />
        <div className="connector-card-head">
          <h3 className="connector-card-title">
            <span className="connector-card-title-name">{connector.name}</span>
            {isConnected ? (
              <span
                className={`connector-status-dot connector-card-title-dot status-${connector.status}`}
                aria-label={statusLabel(connector.status)}
                title={statusLabel(connector.status)}
                role="img"
              />
            ) : isAuthorizationPending ? (
              <span
                className="connector-status-dot connector-card-title-dot status-pending"
                aria-label="Authorization pending"
                title="Authorization pending"
                role="img"
              />
            ) : null}
          </h3>
          <div className="connector-meta">
            <span className="connector-meta-item connector-meta-category" title={categoryLabel}>
              {categoryLabel}
            </span>
            <span className="connector-meta-tools" aria-hidden={!showToolsBadge}>
              {showToolsBadge ? (
                <span className="connector-tools-badge is-ready" title={toolsBadgeLabel}>
                  <span>{toolsBadgeLabel}</span>
                </span>
              ) : null}
            </span>
          </div>
        </div>
        <div className="connector-card-actions">
          {isConnected ? (
            <button
              type="button"
              className={`icon-only connector-action is-disconnect${isDisconnecting ? ' is-loading' : ''}`}
              disabled={!canDisconnect}
              aria-busy={isDisconnecting || undefined}
              aria-label="Disconnect"
              title="Disconnect"
              tabIndex={disabled ? -1 : undefined}
              onMouseDown={stop}
              onKeyDown={stop}
              onClick={(e) => {
                stop(e);
                onDisconnect(connector.id);
              }}
            >
              <Icon name={isDisconnecting ? 'spinner' : 'close'} size={12} />
            </button>
          ) : (
            <button
              type="button"
              className={`icon-only connector-action is-connect${isConnecting || isAuthorizationPending ? ' is-loading' : ''}`}
              disabled={!canConnect}
              aria-busy={isConnecting || isAuthorizationPending || undefined}
              aria-label={isAuthorizationPending ? 'Authorization pending' : 'Connect'}
              title={isAuthorizationPending ? 'Authorization in progress' : 'Connect'}
              tabIndex={disabled ? -1 : undefined}
              onMouseDown={stop}
              onKeyDown={stop}
              onClick={(e) => {
                stop(e);
                onConnect(connector.id);
              }}
            >
              <Icon name={isConnecting || isAuthorizationPending ? 'spinner' : 'plus'} size={12} />
            </button>
          )}
          {isAuthorizationPending ? (
            <button
              type="button"
              className="icon-only connector-action is-cancel-authorization"
              aria-label="Cancel authorization"
              title="Cancel authorization"
              onMouseDown={stop}
              onKeyDown={stop}
              onClick={(e) => {
                stop(e);
                onCancelAuthorization(connector.id);
              }}
            >
              <Icon name="close" size={12} />
            </button>
          ) : null}
          {connector.status === 'error' || connector.status === 'disabled' ? (
            <span className={`connector-status-pill status-${connector.status}`}>{statusLabel(connector.status)}</span>
          ) : null}
        </div>
      </div>
      {authorizationCancelFailed ? (
        <p className="connector-authorization-hint connector-authorization-error" role="alert">
          {cancelFailedMessage}
        </p>
      ) : null}
      {isAuthorizationPending && authorizationPending.redirectUrl ? (
        <button type="button" className="connector-authorization-link" title="Authorization in progress" onClick={continueAuthorization}>
          {continueInBrowserLabel}
        </button>
      ) : null}
    </article>
  );
}
