import { useState } from 'react';
import { useT } from '../../../i18n/index.js';
import { maskFieldValue, sourceDisplayLabel } from '../../rules.js';
import { SourceConfigTestControl } from './SourceConfigTestControl.js';
import type { SourceConfigListCapabilities } from '../hooks/useSourceConfigList.js';
import type { SourceConfigItem, SourceFieldSpec, SourceTestResult, SourceTrustOption } from '../../types.js';

export interface SourceConfigItemCardProps<TSource extends SourceConfigItem> {
  source: TSource;
  fieldSpecs: readonly SourceFieldSpec[];
  trustOptions?: readonly SourceTrustOption[];
  capabilities: SourceConfigListCapabilities;
  removing: boolean;
  refreshing: boolean;
  settingTrust: boolean;
  testing: boolean;
  testResult?: SourceTestResult;
  onRefresh: () => void;
  onRemove: () => void;
  onTrustChange: (trust: string) => void;
  onTest: () => void;
}

/**
 * One configured source: a collapsed summary row (label + trust badge/select)
 * that expands to show every field (masked for `password`-kind values) and
 * the per-item refresh/remove/test actions — capability-gated by which
 * optional port methods the host's `capabilities` reports, so a source shape
 * with no trust concept (the origin MCP-server shape) never renders a trust
 * control at all. Ported in spirit from `McpClientSection.tsx`'s
 * expand-to-edit `McpRow` and `PluginsView.tsx`'s `SourcesPanel` marketplace
 * card.
 */
export function SourceConfigItemCard<TSource extends SourceConfigItem>({
  source,
  fieldSpecs,
  trustOptions,
  capabilities,
  removing,
  refreshing,
  settingTrust,
  testing,
  testResult,
  onRefresh,
  onRemove,
  onTrustChange,
  onTest,
}: SourceConfigItemCardProps<TSource>) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const label = sourceDisplayLabel(source, fieldSpecs);
  const trustOption = trustOptions?.find((option) => option.value === source.trust);
  const showTrustSelect = capabilities.canSetTrust && Boolean(trustOptions && trustOptions.length > 0);
  const anyActionPending = removing || refreshing || settingTrust;

  return (
    <article className={`source-config-item-card${expanded ? ' is-expanded' : ''}`} data-testid="source-config-item-card">
      <div className="source-config-item-card-head">
        <button
          type="button"
          className="source-config-item-card-summary"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
        >
          <span className="source-config-item-card-label">{label}</span>
          {source.trust ? (
            <span className="source-config-item-card-trust-badge">{trustOption?.label ?? source.trust}</span>
          ) : null}
        </button>
        <div className="source-config-item-card-actions">
          {showTrustSelect ? (
            <select
              value={source.trust ?? ''}
              disabled={settingTrust}
              aria-label={t('Trust level for {name}', { name: label })}
              onChange={(event) => onTrustChange(event.target.value)}
            >
              {(trustOptions ?? []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : null}
          {capabilities.canRefresh ? (
            <button type="button" onClick={onRefresh} disabled={anyActionPending}>
              {refreshing ? t('Refreshing…') : t('Refresh')}
            </button>
          ) : null}
          <button type="button" className="source-config-item-card-remove" onClick={onRemove} disabled={anyActionPending}>
            {removing ? t('Removing…') : t('Remove')}
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="source-config-item-card-body">
          <dl className="source-config-item-card-fields">
            {fieldSpecs.map((spec) => (
              <div key={spec.key} className="source-config-item-card-field">
                <dt>{spec.label}</dt>
                <dd>{maskFieldValue(spec.kind, source.fields[spec.key] ?? '')}</dd>
              </div>
            ))}
          </dl>
          {capabilities.canTest ? (
            <SourceConfigTestControl
              running={testing}
              disabled={anyActionPending}
              onTest={onTest}
              {...(testResult ? { result: testResult } : {})}
            />
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
