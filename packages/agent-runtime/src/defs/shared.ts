/**
 * @module defs/shared
 *
 * Small helpers shared across the per-CLI def literals: re-exports of
 * `execAgentFile`/`DEFAULT_MODEL_OPTION` for convenience, the injected
 * `detectAcpModels`/`parsePiModels` (see `../acp-model-probe.ts` /
 * `../pi-models.ts` for why these are ports, not direct lifts), and two
 * small generic parsers (`clampCodexReasoning`, `parseLineSeparatedModels`).
 *
 * Ported from OD's `apps/daemon/src/runtimes/defs/shared.ts` — the origin
 * imported `detectAcpModels` from `../../acp.js` and `parsePiModels` from
 * `../../pi-rpc.js` directly; here they come from this package's own
 * port/vendor modules instead. See `source-map.md`.
 */
import { detectAcpModels } from '../acp-model-probe.js';
import { parsePiModels } from '../pi-models.js';
import { execAgentFile } from '../invocation.js';
import { DEFAULT_MODEL_OPTION } from '../models.js';
import type { RuntimeModelOption } from '../types.js';

export { detectAcpModels, parsePiModels, execAgentFile, DEFAULT_MODEL_OPTION };

export function clampCodexReasoning(modelId: string | null | undefined, effort: string | null | undefined) {
  if (!effort) return effort;
  const raw = String(modelId ?? '').trim();
  const id = raw.includes('/') ? raw.split('/').pop() : raw;
  const isGpt5LateFamily =
    !id ||
    id === 'default' ||
    id.startsWith('gpt-5.2') ||
    id.startsWith('gpt-5.3') ||
    id.startsWith('gpt-5.4') ||
    id.startsWith('gpt-5.5');
  if (isGpt5LateFamily && effort === 'minimal') return 'low';
  if (id === 'gpt-5.1' && effort === 'xhigh') return 'high';
  if (id === 'gpt-5.1-codex-mini') {
    return effort === 'high' || effort === 'xhigh' ? 'high' : 'medium';
  }
  return effort;
}

// Parse one-id-per-line stdout from `<cli> models` and prepend the synthetic
// default option. Used by opencode / cursor-agent.
export function parseLineSeparatedModels(stdout: string): RuntimeModelOption[] {
  const ids = String(stdout || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
  // De-dupe while preserving order — some CLIs print near-duplicates.
  const seen = new Set<string>();
  const out: RuntimeModelOption[] = [DEFAULT_MODEL_OPTION];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, label: id });
  }
  return out;
}
