// Pluggable-hooks panel — the toggles that wire the two-loop memory hooks to
// the config port's PATCH. The master `enabled` switch (owned by a host's
// section header) kills everything; these toggle the individual hooks while
// memory stays on:
//   - chatExtractionEnabled — sediment new facts from chat turns.
//   - profileEnabled        — inject the structured profile into the prompt.
//   - rewriteEnabled        — PRE: expand a short query into a task-brief card.
//   - verifyEnabled         — POST: self-verify against rules + emit scorecard.
//
// State lives in a host's config hook so optimistic-set + rollback can share
// the reload()/SSE wiring; this panel is presentational and calls the passed
// toggle callbacks. Folded into this slice from OD's separate
// `components/MemoryHooksPanel.tsx` (single consumer, `MemoryHowPanel`) — see
// `packages/ui/source-map.md`.
import { Icon, type IconName } from '../../../../react/components/Icon.js';
import { useT } from '../../../i18n/index.js';

export type MemoryHookKey = 'profileEnabled' | 'rewriteEnabled' | 'verifyEnabled' | 'chatExtractionEnabled';

interface HookDef {
  key: MemoryHookKey;
  icon: IconName;
  label: string;
  description: string;
}

const HOOKS: ReadonlyArray<HookDef> = [
  {
    key: 'profileEnabled',
    icon: 'home',
    label: 'Profile injection',
    description: 'Include your saved profile in the prompt.',
  },
  {
    key: 'rewriteEnabled',
    icon: 'sparkles',
    label: 'Query rewrite',
    description: 'Expand short requests into a fuller task brief first.',
  },
  {
    key: 'verifyEnabled',
    icon: 'check',
    label: 'Self-verify',
    description: 'Check responses against saved rules and report a scorecard.',
  },
  {
    key: 'chatExtractionEnabled',
    icon: 'history',
    label: 'Chat extraction',
    description: 'Learn new facts and preferences from chat turns.',
  },
];

export function MemoryHooksPanel({
  enabled,
  flags,
  onToggle,
}: {
  /** Master memory switch — when off, every hook toggle is disabled. */
  enabled: boolean;
  flags: Record<MemoryHookKey, boolean>;
  onToggle: (key: MemoryHookKey, next: boolean) => void;
}) {
  const t = useT();
  return (
    <div className="memory-hooks-panel" data-testid="memory-hooks-panel">
      <div className="memory-hooks-panel-head">
        <span className="memory-hooks-panel-head-icon" aria-hidden="true">
          <Icon name="sliders" size={15} />
        </span>
        <div>
          <h4 className="memory-hooks-panel-title">{t('Memory hooks')}</h4>
          <p className="memory-hooks-panel-hint">
            {t('Fine-tune how memory is captured and used, without turning it off entirely.')}
          </p>
        </div>
      </div>
      <ul className="memory-hooks-panel-list">
        {HOOKS.map((hook) => (
          <li key={hook.key} className="memory-hooks-panel-row">
            <span className="memory-hooks-panel-row-icon" aria-hidden="true">
              <Icon name={hook.icon} size={14} />
            </span>
            <span className="memory-hooks-panel-row-copy">
              <span className="memory-hooks-panel-row-label">{t(hook.label)}</span>
              <small className="memory-hooks-panel-row-desc">{t(hook.description)}</small>
            </span>
            <label className="memory-hooks-panel-toggle" title={t(hook.label)}>
              <span className="toggle-switch toggle-switch-sm">
                <input
                  type="checkbox"
                  // aria-label belongs on the input itself — the visible label
                  // text is just the slider spans, so without this the checkbox
                  // has no accessible name for screen readers / role queries.
                  aria-label={t(hook.label)}
                  checked={flags[hook.key]}
                  disabled={!enabled}
                  onChange={(e) => onToggle(hook.key, e.target.checked)}
                />
                <span className="toggle-slider" />
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
