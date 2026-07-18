/**
 * @module registry
 *
 * The provider/model/agent vocabulary that any Jini consumer picking "which
 * model" or "which coding agent" to run needs, plus the handful of pure
 * helpers (credential-status resolution, model-list merging, a stable cache
 * key, model-choice normalization against a live catalogue) those pickers
 * all independently re-derive today.
 *
 * Ported and generified from Open Design's `apps/web/src/state/config.ts`
 * (`KnownProvider`/`KNOWN_PROVIDERS`), `packages/contracts/src/api/registry.ts`
 * (`AgentInfo`/`AgentDiagnostic`/`AgentFixIntent`/`AgentModelOption`),
 * `packages/contracts/src/api/providerModels.ts` (`ProviderModelOption`),
 * `packages/contracts/src/api/app-config.ts` (`AgentModelPrefs`),
 * `apps/web/src/components/providerModelsCache.ts`, and
 * `apps/web/src/components/agentModelSelection.ts` — see
 * `packages/agent-runtime/source-map.md` for the full per-symbol mapping.
 * No OD product-identity strings or OD-specific gating (e.g. the original's
 * hardcoded `agent.id === 'amr'` carve-out) survived the port.
 */

/**
 * Where a provider stands relative to a consumer's stored credentials.
 * `available` covers providers that don't need a credential at all (a local
 * or already-authenticated integration); `configured` and `unconfigured`
 * both require one, differing only in whether it's present.
 */
export type CredentialStatus = 'configured' | 'available' | 'unconfigured';

export interface ModelProvider {
  id: string;
  label: string;
  hint?: string;
  /** False for providers that need no user-supplied credential (e.g. a local integration). */
  credentialsRequired?: boolean;
  docsUrl?: string;
}

export interface ModelOption {
  id: string;
  label: string;
  hint?: string;
  providerId: string;
  /** Marks the recommended/default-checked option within its provider group. */
  default?: boolean;
  caps?: string[];
}

/**
 * A typed "what should the UI do to fix this" intent attached to an
 * {@link AgentDiagnostic}, so a picker can render the right fix affordance
 * without re-deriving copy/wiring per surface.
 */
export type AgentFixIntent =
  | { kind: 'openDocs' }
  | { kind: 'openInstall' }
  | { kind: 'rescan' }
  | { kind: 'setEnv'; envKey: string }
  | { kind: 'clearEnv'; envKey: string };

export type AgentDiagnosticSeverity = 'error' | 'warning' | 'info';

export interface AgentDiagnostic {
  reason: string;
  severity: AgentDiagnosticSeverity;
  message: string;
  detail?: string;
  fixActions?: AgentFixIntent[];
}

export interface AgentDefinition {
  id: string;
  name: string;
  available: boolean;
  version?: string | null;
  models?: ModelOption[];
  reasoningOptions?: ModelOption[];
  diagnostics?: AgentDiagnostic[];
  installUrl?: string;
  docsUrl?: string;
  /** False hides free-text/custom model entry for agents whose CLI can't accept one. */
  supportsCustomModel?: boolean;
}

export interface AgentModelChoice {
  model?: string;
  reasoning?: string;
}

/**
 * Resolves a provider's credential status for display. A provider that
 * doesn't require credentials is always `available`; otherwise the status
 * depends on whether a credential has actually been stored.
 */
export function resolveCredentialStatus(
  provider: Pick<ModelProvider, 'credentialsRequired'>,
  hasStoredCredential: boolean,
): CredentialStatus {
  if (provider.credentialsRequired === false) return 'available';
  return hasStoredCredential ? 'configured' : 'unconfigured';
}

/**
 * Merges a live-fetched model list with a static suggestion list, keeping
 * fetched entries first and deduping by id (first write wins). Blank ids are
 * dropped; blank labels fall back to the id.
 */
export function mergeModelOptions(
  fetchedModels: readonly ModelOption[],
  suggestedModels: readonly ModelOption[],
): ModelOption[] {
  const seen = new Set<string>();
  const merged: ModelOption[] = [];
  const add = (model: ModelOption) => {
    const id = model.id.trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    merged.push({ ...model, id, label: model.label.trim() || id });
  };
  for (const model of fetchedModels) add(model);
  for (const model of suggestedModels) add(model);
  return merged;
}

/** Deterministic, non-reversible fingerprint — never persist or transmit the raw credential. */
export function fingerprintCredential(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${value.length}:${(hash >>> 0).toString(36)}`;
}

/**
 * A stable key for caching a fetched model catalogue, scoped to the
 * provider, endpoint, and credential in use — so switching any one of them
 * misses the cache instead of silently reusing another provider's list.
 * `variant` covers protocols that key on more than credential + endpoint
 * (e.g. an API version).
 */
export function modelCatalogCacheKey(
  providerId: string,
  baseUrl: string,
  credential: string,
  variant = '',
): string {
  return [
    providerId,
    baseUrl.trim().replace(/\/+$/, ''),
    fingerprintCredential(credential.trim()),
    variant.trim(),
  ].join('\n');
}

/**
 * If `choice` names a model no longer in the agent's current catalogue,
 * falls back to the agent's first available model. Returns `null` when no
 * normalization is needed (nothing to change) or possible (no configured
 * model, or the agent has no models to fall back to).
 */
export function normalizeAgentModelChoice(
  agent: Pick<AgentDefinition, 'models'> | null | undefined,
  choice: AgentModelChoice | undefined,
): AgentModelChoice | null {
  const configuredModel = typeof choice?.model === 'string' && choice.model ? choice.model : null;
  if (!configuredModel) return null;

  const modelIds = agent?.models?.map((model) => model.id) ?? [];
  if (modelIds.length === 0 || modelIds.includes(configuredModel)) return null;

  // modelIds.length === 0 already returned above, so index 0 always exists;
  // the `| undefined` in its type is only `noUncheckedIndexedAccess` noise.
  return { ...choice, model: modelIds[0]! };
}

/** `normalizeAgentModelChoice`'s result if normalization applied, else the original choice. */
export function effectiveAgentModelChoice(
  agent: Pick<AgentDefinition, 'models'> | null | undefined,
  choice: AgentModelChoice | undefined,
): AgentModelChoice | undefined {
  return normalizeAgentModelChoice(agent, choice) ?? choice;
}
