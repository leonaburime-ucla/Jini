import { Icon } from '../../../react/components/Icon.js';

export interface ConnectorGateProps {
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  onClick?: () => void;
}

/** Locked/gated state shown when the host's provider isn't configured yet (e.g. no API key saved). */
export function ConnectorGate({ title, body, ctaLabel, ctaHref, onClick }: ConnectorGateProps) {
  return (
    <div className="connector-gate" role="region" aria-label={title} data-testid="connector-gate">
      <a className="connector-gate-card" href={ctaHref} target="_blank" rel="noreferrer" onClick={onClick}>
        <div className="connector-gate-icon" aria-hidden>
          <Icon name="settings" size={20} />
        </div>
        <h3 className="connector-gate-title">{title}</h3>
        <p className="connector-gate-body">{body}</p>
        <span className="connector-gate-cta">
          {ctaLabel}
          <Icon name="external-link" size={12} />
        </span>
      </a>
    </div>
  );
}
