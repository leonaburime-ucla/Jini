/**
 * @module registry
 *
 * The static `BASE_AGENT_DEFS` catalog (the 24 built-in CLI adapters), a
 * dup-id guard, and `getAgentDef(id)` lookup.
 *
 * Ported from OD's `apps/daemon/src/runtimes/registry/registry.ts`. Per the
 * task's explicit scope ("`registry.ts` → `BASE_AGENT_DEFS` array + dup-id
 * guard + `getAgentDef(id)`"), the origin's `readLocalAgentProfileDefs`
 * local-profile-file loader is deliberately NOT ported here — it reads a
 * product-prefixed config-path override env var, falls back to a
 * product-branded default path under the user's home dir, reads a
 * product-prefixed data-dir env var, and depends on OD's daemon-level
 * sandbox-runtime-config subsystem (out of this package's charter
 * entirely; see `source-map.md` for the exact original names). `AGENT_DEFS`
 * here is exactly `BASE_AGENT_DEFS` (no local-profile merge). A future task
 * can reintroduce a de-branded, sandbox-free local-profile loader as an
 * injected port if a consumer needs it. See `source-map.md`.
 */
import {
  aiderAgentDef,
  ampAgentDef,
  amrAgentDef,
  antigravityAgentDef,
  claudeAgentDef,
  codebuddyAgentDef,
  codexAgentDef,
  copilotAgentDef,
  cursorAgentDef,
  deepseekAgentDef,
  devinAgentDef,
  grokBuildAgentDef,
  hermesAgentDef,
  kiloAgentDef,
  kimiAgentDef,
  kiroAgentDef,
  mimoAgentDef,
  opencodeAgentDef,
  piAgentDef,
  qoderAgentDef,
  qwenAgentDef,
  reasonixAgentDef,
  traeCliAgentDef,
  vibeAgentDef,
} from './defs/index.js';
import type { RuntimeAgentDef } from './types.js';

export const BASE_AGENT_DEFS: RuntimeAgentDef[] = [
  amrAgentDef,
  claudeAgentDef,
  codexAgentDef,
  devinAgentDef,
  opencodeAgentDef,
  hermesAgentDef,
  traeCliAgentDef,
  grokBuildAgentDef,
  kimiAgentDef,
  cursorAgentDef,
  qwenAgentDef,
  qoderAgentDef,
  copilotAgentDef,
  ampAgentDef,
  piAgentDef,
  kiroAgentDef,
  kiloAgentDef,
  vibeAgentDef,
  deepseekAgentDef,
  aiderAgentDef,
  antigravityAgentDef,
  reasonixAgentDef,
  codebuddyAgentDef,
  mimoAgentDef,
];

export const AGENT_DEFS: RuntimeAgentDef[] = [...BASE_AGENT_DEFS];

const ids = new Set<string>();
for (const def of AGENT_DEFS) {
  if (ids.has(def.id)) {
    throw new Error(`Duplicate agent definition id: ${def.id}`);
  }
  ids.add(def.id);
}

export function getAgentDef(id: string): RuntimeAgentDef | null {
  return AGENT_DEFS.find((a) => a.id === id) || null;
}
