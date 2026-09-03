import { useState, type ReactNode } from 'react';
import { useT } from '../../../i18n/index.js';
import { CUSTOM_MODEL_SENTINEL, DEFAULT_AGENT_DESCRIPTIONS } from '../../constants.js';
import {
  agentExecutableRepairState,
  agentMetaLabel,
  agentModelSummary,
  binPathEnvField,
  modelIdForReasoningLevel,
  reasoningModelGroupFor,
  reasoningModelGroups,
  selectedAgentModel,
  selectedAgentReasoning,
  shouldShowCustomModelInput,
  splitReasoningModelId,
} from '../../rules.js';
import type {
  AgentCliEnvFieldSpec,
  AgentTestState,
  DetectedAgent,
  LocalCliConfig,
} from '../../types.js';
import { AgentCliEnvFields } from './AgentCliEnvFields.js';
import { AgentDiagnosticRow } from './AgentDiagnosticRow.js';
import { SearchableModelSelect } from './SearchableModelSelect.js';

export interface LocalCliAgentCardProps {
  agent: DetectedAgent;
  config: LocalCliConfig;
  selected: boolean;
  onSelect: (agentId: string) => void;
  onModelChange: (agentId: string, model: string) => void;
  onReasoningChange: (agentId: string, reasoning: string) => void;
  onEnvChange: (agentId: string, envKey: string, value: string) => void;
  /** Shared CLI-env catalog, filtered to this agent by `AgentCliEnvFields`
   *  itself — see that component's doc. */
  cliEnvFields: readonly AgentCliEnvFieldSpec[];
  /** Rendered in the card's icon slot. A host passes its own vendor marks;
   *  without one the card falls back to a monogram rather than a gap. */
  renderIcon?: ((agent: DetectedAgent) => ReactNode) | undefined;
  onTest?: ((agent: DetectedAgent) => void) | undefined;
  agentTest: AgentTestState;
  /** Wired straight into `AgentDiagnosticRow`'s `{kind:'rescan'}` fix action —
   *  the same rescan the list's own header button triggers. Omitted hides
   *  that specific fix button (a diagnostic with no OTHER fix action then
   *  renders with no buttons at all, same as the origin). */
  onRescan?: (() => void) | undefined;
}

/**
 * One detected code-agent CLI, as a selectable card.
 *
 * Origin: `SettingsDialog.tsx`'s `agent-card` (~4260-4600) and the
 * `renderAgentModelConfig` block it expands into when active. Ported: the
 * icon, name + vendor tagline, auth/version meta line, badges, selection, the
 * per-agent model picker with its source badge, the Test button, agent
 * diagnostics with fix affordances, per-agent CLI env overrides, a reasoning
 * picker, custom-model free text entry, a searchable model list, and the
 * codex-style executable-path repair affordance. Deliberately left behind:
 * the origin's managed-runtime card — its wallet balance, plan badges,
 * sign-in pill, and upgrade coachmarks are bound to that product's hosted
 * service, not to the idea of "a CLI on a machine".
 */
export function LocalCliAgentCard({
  agent,
  config,
  selected,
  onSelect,
  onModelChange,
  onReasoningChange,
  onEnvChange,
  cliEnvFields,
  renderIcon,
  onTest,
  agentTest,
  onRescan,
}: LocalCliAgentCardProps) {
  const t = useT();

  // Whether the operator explicitly opened the free-text "Custom" entry via
  // the model picker's own "Custom…" option — distinct from "the saved model
  // simply isn't in the known list" (`shouldShowCustomModelInput` covers
  // both, but only THIS one needs to be remembered as a UI-local toggle,
  // since it is not itself persisted config: see `LocalCliConfig`, which has
  // nowhere for "the operator is mid-typing a custom id" to live). Scoped to
  // this card instance, so switching to a different agent and back does not
  // leak one agent's custom-mode toggle onto another.
  const [explicitCustomMode, setExplicitCustomMode] = useState(false);

  const description = agent.description ?? DEFAULT_AGENT_DESCRIPTIONS[agent.id];
  const meta = agentMetaLabel(agent, {
    authRequired: t('Authentication required'),
    authUnknown: t('Auth status unknown'),
    installed: t('Installed'),
    notInstalled: t('Not installed'),
  });
  const models = agent.models ?? [];
  const hasModels = models.length > 0;
  const resolvedModel = selectedAgentModel(config, agent);
  const rawModel = config.modelByAgentId?.[agent.id] ?? '';
  const summary = agentModelSummary(config, agent);

  // Two ways an agent can expose a reasoning-effort axis, and the card branches on the DECLARATION
  // rather than on the agent's id — adding a third runtime with either shape is a def change, not
  // an edit here.
  //
  //   `reasoningOptions`     — one flat vocabulary that travels to the CLI as its own flag
  //                            (`claude --effort high`, codex's `-c model_reasoning_effort=...`).
  //                            The choice is its own persisted value; `onReasoningChange` owns it.
  //   `reasoningInModelId`   — no effort flag exists; the level is a suffix on the model id itself
  //                            (antigravity's `gemini-3.1-pro-high`). The choice IS the model, so
  //                            it goes through `onModelChange`, and the available levels are
  //                            derived PER BASE MODEL from the agent's own catalog — they are not
  //                            uniform (`gemini-3.1-pro` has no `-medium`, and `agy --model`
  //                            rejects one), so a fixed dropdown would offer ids the CLI refuses.
  const suffixLevels = agent.reasoningInModelId?.levels ?? [];
  const suffixLevelIds = suffixLevels.map((level) => level.id);
  const modelGroups = suffixLevels.length > 0 ? reasoningModelGroups(models, suffixLevels) : null;
  const activeGroup = modelGroups ? reasoningModelGroupFor(modelGroups, resolvedModel, suffixLevelIds) : null;
  const activeLevel = modelGroups ? splitReasoningModelId(resolvedModel, suffixLevelIds).level : null;

  const flatReasoningOptions = agent.reasoningOptions ?? [];
  // Exactly one effort control, whichever shape declared it. `reasoningOptions` wins if a def ever
  // declares both, rather than rendering two controls that disagree about where the choice lands.
  const reasoningOptions = flatReasoningOptions.length > 0 ? flatReasoningOptions : (activeGroup?.levels ?? []);
  const hasReasoning = reasoningOptions.length > 0;
  const reasoningValue =
    flatReasoningOptions.length > 0 ? selectedAgentReasoning(config, agent) : (activeLevel ?? reasoningOptions[0]?.id ?? '');
  // A base model with exactly one variant has a real, fixed level worth showing — but nothing to
  // choose between, so the control is shown disabled rather than offering an illusion of choice.
  const reasoningDisabled = flatReasoningOptions.length === 0 && reasoningOptions.length < 2;

  // Adapters opt out via `supportsCustomModel: false` when their CLI has no
  // free-text model flag, or validates the id against a live catalog and
  // rejects unknown ones. `undefined` allows it, matching every adapter's
  // default before this field existed.
  const allowCustomModel = agent.supportsCustomModel !== false && modelGroups === null;
  const knownModelIds = models.map((model) => model.id);
  const customActive =
    allowCustomModel && hasModels && shouldShowCustomModelInput(resolvedModel, knownModelIds, explicitCustomMode);
  // A model-suffix agent picks a BASE model here; the effort control below supplies the rest of the
  // id. Everything else about the field — search, labels, provenance badge — is unchanged.
  const modelChoices = modelGroups
    ? modelGroups.map((group) => ({ id: group.baseId, label: group.label }))
    : models;
  const selectValue = customActive
    ? CUSTOM_MODEL_SENTINEL
    : modelGroups
      ? (activeGroup?.baseId ?? '')
      : resolvedModel;
  // While the custom box is open, the text field must show the operator's raw
  // typed text (which may not resolve to anything yet) rather than the
  // resolved-with-fallback value — otherwise every keystroke would show a
  // stale fallback model instead of what was actually typed.
  const customModelInputValue = explicitCustomMode ? rawModel : resolvedModel;

  // `modelsSource` is optional in the contract, so an absent value means the
  // host did not say where the list came from — NOT that it came from a
  // built-in fallback. Defaulting to 'fallback' rendered "Built-in list" over
  // a list that may well be live, and told the operator to Rescan to fix a
  // problem they do not have. Unknown provenance shows no badge and no claim.
  const source = agent.modelsSource;
  const sourceLabel = source === 'live' ? t('Live from CLI') : source === 'fallback' ? t('Built-in list') : '';
  const sourceHint =
    source === 'live'
      ? t("Model list comes from this CLI. Default uses the CLI's own config.")
      : source === 'fallback'
        ? t('Showing built-in defaults. Click Rescan to pull live models from the CLI.')
        : '';

  // The test result belongs to whichever agent was probed, so a stale verdict
  // from a previously-tested CLI never renders under this one.
  const testing = agentTest.status === 'testing' && agentTest.agentId === agent.id;
  const result =
    (agentTest.status === 'ok' || agentTest.status === 'error') && agentTest.agentId === agent.id
      ? agentTest
      : null;

  // The "use the binary that actually ran" / "clear the override" repair
  // affordance — only meaningful when a successful test silently fell back
  // off a configured override, AND this agent's catalog names which field
  // that override lives in. See `agentExecutableRepairState`'s doc.
  //
  // `AgentTestState`'s 'ok' variant spells success as `status: 'ok'`, not an
  // `ok: true` field — `agentExecutableRepairState` takes the latter (it
  // mirrors `ExecutionPort.testAgent`'s raw resolved shape, one layer below
  // this state union), so the two must be translated explicitly here rather
  // than passing `result` straight through.
  const repair =
    result?.status === 'ok'
      ? agentExecutableRepairState({
          ok: true,
          usedExecutableSource: result.usedExecutableSource,
          detectedExecutablePath: result.detectedExecutablePath,
        })
      : null;
  const repairField = repair ? binPathEnvField(cliEnvFields, agent.id) : null;

  const openUrl = (url: string | undefined) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  const diagnosticHandlers = {
    onRescan,
    onOpenInstall: agent.installUrl ? () => openUrl(agent.installUrl) : undefined,
    onOpenDocs: agent.docsUrl ? () => openUrl(agent.docsUrl) : undefined,
  };

  return (
    <div
      className={
        'jini-agent-card' +
        (selected ? ' is-selected' : '') +
        (agent.installed ? ' is-installed' : ' is-missing')
      }
      data-testid={`jini-agent-card-${agent.id}`}
    >
      <div className="jini-agent-card-main">
        <button
          type="button"
          className="jini-agent-card-select"
          data-testid={`jini-agent-select-${agent.id}`}
          aria-pressed={selected}
          disabled={!agent.installed}
          onClick={() => onSelect(agent.id)}
        >
          <span className="jini-agent-card-icon" aria-hidden="true">
            {renderIcon ? renderIcon(agent) : agent.label.slice(0, 1).toUpperCase()}
          </span>
          <span className="jini-agent-card-body">
            <span className="jini-agent-card-name">
              <span className="jini-agent-card-title">{agent.label}</span>
              {description ? (
                <>
                  <span className="jini-agent-card-name-divider" aria-hidden="true">
                    ·
                  </span>
                  <span className="jini-agent-card-tagline">{description}</span>
                </>
              ) : null}
            </span>
            {agent.badges?.length ? (
              <span className="jini-agent-card-badges">
                {agent.badges.map((badge) => (
                  <span key={badge} className="jini-agent-card-badge">
                    {badge}
                  </span>
                ))}
              </span>
            ) : null}
            {/* Pre-existing (not part of this pass's six gaps): `agentMetaLabel`
                (this feature's own `rules.ts`) always returns a non-empty
                `text` for every branch of its own contract, so this ternary's
                `false` side is
                provably unreachable through the rule as written today — kept
                defensive rather than asserted-non-null in case that contract
                ever changes. */}
            {meta.text ? (
              <span className="jini-agent-card-meta">
                <span title={meta.title || undefined}>{meta.text}</span>
              </span>
            ) : null}
            {!selected && summary ? (
              <span className="jini-agent-card-model-summary">
                <span>{t('Model')}</span>
                <strong>{summary}</strong>
              </span>
            ) : null}
          </span>
        </button>

        {selected && onTest ? (
          <button
            type="button"
            className={'jini-btn jini-agent-card-test' + (testing ? ' is-loading' : '')}
            data-testid={`jini-agent-test-${agent.id}`}
            disabled={testing}
            onClick={() => onTest(agent)}
          >
            {testing ? t('Testing…') : t('Test')}
          </button>
        ) : null}
      </div>

      {/* Why is this CLI unavailable, or only partially usable? Shown on
          BOTH an installed-but-troubled card and a not-installed one — a
          diagnostic is a property of detection, not of selection. */}
      {(agent.diagnostics ?? []).map((diagnostic, index) => (
        <AgentDiagnosticRow key={`${diagnostic.reason}-${index}`} diagnostic={diagnostic} handlers={diagnosticHandlers} />
      ))}

      {selected && (hasModels || hasReasoning) ? (
        <div className="jini-agent-card-config">
          {hasModels ? (
            <>
              <label className="jini-field">
                <span className="jini-field-label">
                  {t('Model')}
                  {sourceLabel ? (
                    <span className={`jini-agent-model-source ${source}`}>{sourceLabel}</span>
                  ) : null}
                </span>
                <SearchableModelSelect
                  className="jini-input jini-agent-model-select"
                  ariaLabel={t('Model')}
                  searchPlaceholder={t('Search models')}
                  testId={`jini-agent-model-${agent.id}`}
                  searchInputTestId={`jini-agent-model-search-${agent.id}`}
                  value={selectValue}
                  models={modelChoices}
                  additionalOptions={allowCustomModel ? [{ value: CUSTOM_MODEL_SENTINEL, label: t('Custom…') }] : undefined}
                  onChange={(nextValue) => {
                    if (nextValue === CUSTOM_MODEL_SENTINEL) {
                      setExplicitCustomMode(true);
                      onModelChange(agent.id, '');
                      return;
                    }
                    setExplicitCustomMode(false);
                    if (!modelGroups) {
                      onModelChange(agent.id, nextValue);
                      return;
                    }
                    // Switching base carries the current effort level over when the new base
                    // really has it, and lands on one it does have otherwise — never composes a
                    // slug (see `modelIdForReasoningLevel`), so `gemini-3.1-pro-medium` cannot be
                    // produced from a `medium` carried off `gemini-3.8-flash`.
                    const nextGroup = modelGroups.find((group) => group.baseId === nextValue);
                    onModelChange(agent.id, nextGroup ? modelIdForReasoningLevel(nextGroup, activeLevel) : nextValue);
                  }}
                />
              </label>
              {sourceHint ? <p className="jini-field-hint">{sourceHint}</p> : null}
            </>
          ) : null}

          {customActive ? (
            <label className="jini-field">
              <span className="jini-field-label">{t('Custom model id')}</span>
              <input
                className="jini-input"
                type="text"
                data-testid={`jini-agent-model-custom-${agent.id}`}
                value={customModelInputValue}
                placeholder={t('e.g. my-fine-tuned-model')}
                spellCheck={false}
                onChange={(event) => onModelChange(agent.id, event.target.value.trim())}
              />
            </label>
          ) : null}

          {hasReasoning ? (
            <label className="jini-field">
              <span className="jini-field-label">{t('Reasoning effort')}</span>
              <select
                className="jini-input"
                data-testid={`jini-agent-reasoning-${agent.id}`}
                value={reasoningValue}
                disabled={reasoningDisabled}
                onChange={(event) => {
                  // A model-suffix agent has no reasoning value of its own to record: the choice
                  // is which model id runs, so it goes back out through `onModelChange`.
                  if (activeGroup) {
                    onModelChange(agent.id, modelIdForReasoningLevel(activeGroup, event.target.value));
                    return;
                  }
                  onReasoningChange(agent.id, event.target.value);
                }}
              >
                {reasoningOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      {selected ? (
        <AgentCliEnvFields agentId={agent.id} fields={cliEnvFields} config={config} onChange={onEnvChange} />
      ) : null}

      {result ? (
        <p
          className={'jini-agent-card-test-result is-' + result.status}
          role={result.status === 'error' ? 'alert' : 'status'}
        >
          {result.message ?? (result.status === 'ok' ? t('Agent is ready.') : t('Agent check failed'))}
        </p>
      ) : null}

      {repair && repairField ? (
        <div className="jini-agent-card-path-repair">
          <span className="jini-field-hint">
            {t('A custom path override did not work, so this used the automatically detected binary instead.')}
          </span>
          <div className="jini-agent-card-path-repair-actions">
            {/* `agentExecutableRepairState` (this feature's own `rules.ts`)
                always sets `canUseDetected: true` on every non-null result it produces
                today — the field exists for a FUTURE detection outcome that
                finds a fallback path but cannot vouch for it (see that
                field's doc). The `false` branch is therefore provably
                unreachable through this card's real data flow right now;
                kept rather than dropped so the card stays correct the day
                that future outcome exists, without another shape change. */}
            {repair.canUseDetected ? (
              <button
                type="button"
                className="jini-btn"
                data-testid={`jini-agent-path-repair-use-${agent.id}`}
                onClick={() => onEnvChange(agent.id, repairField.envKey, repair.detectedPath)}
              >
                {t('Use detected path')}
              </button>
            ) : null}
            <button
              type="button"
              className="jini-btn jini-btn-ghost"
              data-testid={`jini-agent-path-repair-clear-${agent.id}`}
              onClick={() => onEnvChange(agent.id, repairField.envKey, '')}
            >
              {t('Clear custom path')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
