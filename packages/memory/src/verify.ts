/**
 * @module verify
 *
 * Deterministic, programmatic enforcement of a "self-verify scorecard"
 * contract: after a turn that produced output and has active checkable
 * rules, evaluate whether the output's scorecard actually covers every
 * active rule and whether every row passed. Pure — no I/O, no clock, no
 * model call — `enforceVerify` is fully unit-testable.
 *
 * The scorecard's on-the-wire shape (how it's embedded in the output text)
 * is host-specific, so it is never parsed here: the host supplies
 * `extractScorecard`, a function from raw output text to a
 * {@link VerifyScorecard} or `null` when none is present. Everything else —
 * rule-to-row coverage matching, pass/fail/missing verdicts, the bounded
 * record log — is generic.
 */
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';

export interface ActiveRuleForVerify {
  name: string;
  /** The rule's checkable rubric line, if any. */
  check?: string;
}

export interface VerifyScorecardRow {
  /** The row's own text — restates (in the model's words) which rule it addresses. */
  rule: string;
  status: 'pass' | 'fail' | string;
}

export interface VerifyScorecard {
  status?: string;
  rows: VerifyScorecardRow[];
}

export interface EnforceVerifyInput {
  /** The full turn output to scan for a scorecard. */
  assistantOutput: string;
  /** Active checkable rules at enforcement time. */
  activeRules: ActiveRuleForVerify[];
  /** Whether the turn produced the kind of output enforcement scopes to. */
  hadArtifact: boolean;
  /** Master enable switch — when false, enforcement is skipped outright. */
  verifyEnabled: boolean;
  /** Host-supplied extraction of a scorecard from `assistantOutput`, or `null` if absent. */
  extractScorecard: (output: string) => VerifyScorecard | null;
}

export type VerifyStatus = 'skipped' | 'missing' | 'fail' | 'pass';

export interface VerifyResult {
  status: VerifyStatus;
  skipReason?: 'verify-disabled' | 'no-rules' | 'no-artifact';
  rulesActive: number;
  rulesCovered: number;
  uncoveredRules: string[];
  scorecardStatus?: string;
  rowsTotal: number;
  rowsFailed: number;
  hadArtifact: boolean;
}

export interface VerifyRecord extends VerifyResult {
  id: string;
  at: number;
  runId?: string;
  contextId?: string | null;
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'must', 'should', 'have',
  'from', 'into', 'when', 'then', 'than', 'your', 'over', 'every',
  'check', 'verify', 'rule', 'future', 'artifacts', 'satisfy', 'ensure',
]);

function significantWords(value: string): Set<string> {
  const words = value
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  return new Set(words);
}

/**
 * A scorecard row covers a rule when the row shares enough signal with the
 * rule's name or check: a direct substring containment, or at least two
 * shared significant words (lenient on purpose — models paraphrase).
 * @internal
 */
function rowCoversRule(rowText: string, rule: ActiveRuleForVerify): boolean {
  const row = rowText.toLowerCase().trim();
  if (!row) return false;
  const name = rule.name.toLowerCase().trim();
  const check = (rule.check ?? '').toLowerCase().trim();
  if (name.length >= 5 && (row.includes(name) || name.includes(row))) return true;
  if (check.length >= 8 && (row.includes(check) || check.includes(row))) return true;
  const rowWords = significantWords(rowText);
  const ruleWords = significantWords(`${rule.name} ${rule.check ?? ''}`);
  let shared = 0;
  for (const w of rowWords) {
    if (ruleWords.has(w)) shared += 1;
    if (shared >= 2) return true;
  }
  return false;
}

/**
 * Deterministically evaluate the self-verify contract for one turn.
 *
 * @param input - The turn output, active rules, artifact/enable flags, and
 *   the host's scorecard extractor.
 * @returns The verify verdict.
 */
export function enforceVerify(input: EnforceVerifyInput): VerifyResult {
  const activeRules = input.activeRules;
  const base: VerifyResult = {
    status: 'skipped',
    rulesActive: activeRules.length,
    rulesCovered: 0,
    uncoveredRules: [],
    rowsTotal: 0,
    rowsFailed: 0,
    hadArtifact: input.hadArtifact,
  };

  if (!input.verifyEnabled) return { ...base, status: 'skipped', skipReason: 'verify-disabled' };
  if (activeRules.length === 0) return { ...base, status: 'skipped', skipReason: 'no-rules' };
  if (!input.hadArtifact) return { ...base, status: 'skipped', skipReason: 'no-artifact' };

  const scorecard = input.extractScorecard(input.assistantOutput);
  if (!scorecard) {
    return { ...base, status: 'missing', uncoveredRules: activeRules.map((r) => r.name) };
  }

  const rows = scorecard.rows;
  const rowsFailed = rows.filter((r) => r.status === 'fail').length;
  const uncoveredRules = activeRules.filter((rule) => !rows.some((row) => rowCoversRule(row.rule, rule))).map((rule) => rule.name);
  const rulesCovered = activeRules.length - uncoveredRules.length;
  const status: VerifyStatus = rowsFailed > 0 || uncoveredRules.length > 0 ? 'fail' : 'pass';

  return {
    status,
    rulesActive: activeRules.length,
    rulesCovered,
    uncoveredRules,
    ...(scorecard.status !== undefined ? { scorecardStatus: scorecard.status } : {}),
    rowsTotal: rows.length,
    rowsFailed,
    hadArtifact: true,
  };
}

export interface VerifyLog {
  readonly events: EventEmitter;
  record(result: VerifyResult, meta?: { runId?: string; contextId?: string | null }): VerifyRecord | null;
  list(): VerifyRecord[];
  remove(id: string): number;
  clear(): number;
}

const MAX_RECORDS = 20;

/**
 * Construct a bounded verify-outcome log with its own event emitter.
 * `skipped` outcomes are never persisted — this is a UX surface for
 * enforcement that had something to check, not a per-turn audit log.
 *
 * @returns A fresh, independent `VerifyLog`.
 */
export function createVerifyLog(): VerifyLog {
  const records: VerifyRecord[] = [];
  const events = new EventEmitter();
  events.setMaxListeners(64);

  function emit(record: VerifyRecord | { id: string; status: string; at: number }): void {
    setImmediate(() => {
      try {
        events.emit('verify', { ...record });
      } catch {
        // A listener throwing is not this module's problem.
      }
    });
  }

  function record(result: VerifyResult, meta: { runId?: string; contextId?: string | null } = {}): VerifyRecord | null {
    if (result.status === 'skipped') return null;
    const rec: VerifyRecord = {
      ...result,
      id: randomUUID(),
      at: Date.now(),
      ...(meta.runId ? { runId: meta.runId } : {}),
      ...(meta.contextId !== undefined ? { contextId: meta.contextId } : {}),
    };
    records.unshift(rec);
    if (records.length > MAX_RECORDS) records.length = MAX_RECORDS;
    emit(rec);
    return rec;
  }

  function list(): VerifyRecord[] {
    return records.map((r) => ({ ...r }));
  }

  function remove(id: string): number {
    const idx = records.findIndex((r) => r.id === id);
    if (idx < 0) return 0;
    records.splice(idx, 1);
    emit({ id, status: 'deleted', at: Date.now() });
    return 1;
  }

  function clear(): number {
    const removed = records.length;
    records.length = 0;
    if (removed > 0) emit({ id: 'all', status: 'cleared', at: Date.now() });
    return removed;
  }

  return { events, record, list, remove, clear };
}
