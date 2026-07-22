/**
 * `AgentExecutor` — the driver `RunLifecycle`'s own module doc names as the
 * missing piece: *"It does not spawn or signal a subprocess... A driver...
 * calls `emit()` for agent/stdout/stderr/error events, observes cancellation
 * via `onCancelRequested`, and calls `finish()` once it knows the real
 * outcome."* This module is that driver — it wires `@jini/agent-runtime`'s
 * registry/launch-resolution/stream-parsers (previously a complete but
 * disconnected library, zero callers anywhere outside its own package) into
 * a real `node:child_process` spawn, feeding both `RunLifecycle.emit()` and
 * this package's own `@jini/protocol` event envelope.
 *
 * ## v1 scope: 23 of 24 registered agent defs
 *
 * `@jini/agent-runtime`'s registry ships 24 built-in defs across four
 * `streamFormat` families. The JSON-stream-parser family — the four
 * `createXStreamHandler`-shaped parsers (`claude-stream-json`,
 * `json-event-stream`, `copilot-stream-json`, `qoder-stream-json`), covering
 * 9 defs (amp, codebuddy, claude, codex, cursor-agent, opencode, mimo,
 * copilot, qoder) — plus all 9 `acp-json-rpc` defs, plus the one `pi-rpc`
 * def (`pi`), are wired here. ACP and pi-rpc each own their own JSON-RPC
 * prompt-delivery protocol, so each takes its own lifecycle branch rather
 * than being treated as a stdout-tail parser; pi-rpc's events arrive through
 * the exact same `{type, ...}` vocabulary `translateAgentRuntimeEvent`
 * already handles for ACP/JSON-stream (confirmed by reading every
 * `mapPiRpcEvent` `send()` call site — no new translation code was needed),
 * so only the driver wiring (spawn → attach → cancel → finish) was new for it.
 *
 * 4 of the 5 `streamFormat: 'plain'` defs — grok-build, aider, deepseek,
 * qwen — are also driven, per
 * `ADS-memory/reports/proposals/PROP-plain-format-agent-driving-2026-07-21.md`'s
 * recommended "Option B": no structured stream parser at all. Every raw
 * `child.stdout` chunk is forwarded verbatim as a `text_delta` `'agent'`
 * event, live, as it arrives — never buffered until close (see
 * `wireChildLifecycle`'s `streamFormat === 'plain'` branch). Prompt delivery
 * across the 4 is not uniform: qwen already fit the pre-existing stdin-only
 * guard; grok-build stages the prompt to a temp file via
 * `preparePromptFileForAgent` (its path threaded into `buildArgs` through a
 * `RuntimeContext`, cleaned up after the child exits on every path,
 * including pre-spawn/spawn-failure ones); aider/deepseek carry the prompt
 * on argv and are guarded pre-spawn by `checkPromptArgvBudget` plus the two
 * Windows CreateProcess command-line-expansion guards
 * (`checkWindowsCmdShimCommandLineBudget`/`checkWindowsDirectExeCommandLineBudget`).
 *
 * The 5th plain def, **antigravity, is deliberately still rejected.** It
 * needs two concerns unrelated to `streamFormat: 'plain'` itself — buffering
 * stdout until close so a leaked OAuth URL can be suppressed before it
 * reaches the client, and a cross-run lock serializing writes to its shared
 * `settings.json` model-selection file — that the proposal doc explicitly
 * scoped out to its own follow-up (see that doc's §2c/§3). `run()` guards it
 * with its own `def.id === 'antigravity'` check, ahead of (and independent
 * of) the generic plain-format prompt-delivery/dispatch logic. `run()`
 * rejects cleanly (never a bare throw) with an `AgentExecutorError` for any
 * def outside the supported 23 — see `isSupportedStreamFormat`.
 *
 * ## Invariant
 *
 * `RunLifecycle.start()` already transitions a run to `'running'` before
 * `run()` is ever called. Every failure path in `run()` — unknown
 * `agentId`, an unsupported `streamFormat`/prompt-delivery shape, an
 * unresolvable binary, or a spawn error — calls `lifecycle.finish({status:
 * 'failed', resumable: false, code: null, signal: null})` itself before
 * rejecting, so a run can never get stuck `'running'` with no watchdog.
 * `resumable` is always `false` in v1: no `RunRetryFailureSignal` producer
 * exists anywhere in this codebase (OD's ~20-vendor-CLI text-matching
 * failure classifier was deliberately never ported — see
 * `run/core/failure-taxonomy.ts`'s own doc and `source-map.md`), so a
 * blanket "not retryable" default is the only honest answer available.
 */
import { spawn as nodeSpawn, type ChildProcess } from 'node:child_process';
import { redactSecrets } from '@jini/core';
import type { JournalEntry, RunAgentPayload, RunErrorPayload } from '@jini/protocol';
import {
  applyAgentLaunchEnv,
  createClaudeStreamHandler,
  createCopilotStreamHandler,
  createJsonEventStreamHandler,
  createQoderStreamHandler,
  getAgentDef,
  resolveAgentLaunch,
  attachAcpSession,
  attachPiRpcSession,
  checkPromptArgvBudget,
  checkWindowsCmdShimCommandLineBudget,
  checkWindowsDirectExeCommandLineBudget,
  preparePromptFileForAgent,
  type AcpPermissionHandler,
  type AcpSessionController,
  type AgentLaunchResolution,
  type PiRpcSession,
  type PreparedPromptFile,
  type RuntimeAgentDef,
  type RuntimeContext,
} from '@jini/agent-runtime';
import {
  collectProcessTreePids,
  createCommandInvocation,
  listProcessSnapshots,
  stopProcesses,
  type ProcessSnapshot,
  type StopProcessesResult,
} from '@jini/platform';
import { classifyRunCloseStatus } from './close-status.js';
import type { RunByteJournal } from './continuation/journal.js';
import type { RunLifecycle } from './run-lifecycle.js';

/**
 * A parsed, loosely-typed event as produced by one of `@jini/agent-runtime`'s
 * four stream-parser factories — each parser's `onEvent` callback receives
 * `Record<string, unknown>` with a `type` discriminant, not a typed union.
 */
type StreamHandler = { feed(chunk: string): void; flush(): void };

const SUPPORTED_STREAM_FORMATS = [
  'claude-stream-json',
  'json-event-stream',
  'copilot-stream-json',
  'qoder-stream-json',
  'acp-json-rpc',
  'pi-rpc',
  'plain',
] as const;

/** The families of the registry's stream-format this driver implements — see module doc. */
export type SupportedStreamFormat = (typeof SUPPORTED_STREAM_FORMATS)[number];

type JsonStreamFormat = Exclude<SupportedStreamFormat, 'acp-json-rpc' | 'pi-rpc' | 'plain'>;

/**
 * `streamFormat` values `wireChildLifecycle` drives directly off raw
 * `child.stdout` `'data'` events: the 4 JSON-stream-parser formats (fed
 * through a real `feed()`/`flush()` state machine via
 * {@link createStreamHandlerForDef}) plus `'plain'` (no parser at all —
 * each chunk is forwarded verbatim as a `text_delta`, see that function's
 * doc). Distinct from `'acp-json-rpc'`/`'pi-rpc'`, which own their own
 * JSON-RPC prompt/event protocol and get their own
 * `wireAcpLifecycle`/`wirePiRpcLifecycle` wiring instead.
 */
type ChildDrivenStreamFormat = JsonStreamFormat | 'plain';

/**
 * Narrows a `RuntimeAgentDef.streamFormat` string to the supported
 * families.
 * @param value - The def's raw `streamFormat` string.
 * @returns `true` when `value` is one of the JSON-stream-parser, ACP, pi-rpc, or plain formats this driver wires.
 * @complexity O(1) — fixed membership check.
 * @overallScore 100/100
 */
export function isSupportedStreamFormat(value: string): value is SupportedStreamFormat {
  return (SUPPORTED_STREAM_FORMATS as readonly string[]).includes(value);
}

/**
 * Selects and constructs the real stream-parser handler for a supported
 * `streamFormat`. `json-event-stream` additionally dispatches on
 * `def.eventParser` (the parser's own internal `kind` switch — e.g.
 * `'codex'`, `'cursor-agent'`, `'opencode'`; `mimo` shares `'opencode'`'s
 * `kind`); an unrecognized/absent `eventParser` degrades to that parser's
 * own `{type:'raw', line}` fallback rather than throwing, matching the
 * parser's own documented behavior. Never called for `streamFormat:
 * 'plain'` — `wireChildLifecycle` handles that format inline with no
 * parser at all (see `ChildDrivenStreamFormat`'s doc).
 * @param def - The resolved agent def (only `.eventParser` is read beyond `streamFormat`).
 * @param streamFormat - `def.streamFormat`, already narrowed by {@link isSupportedStreamFormat}.
 * @param onEvent - Sink the parser calls once per parsed (or malformed-raw) event.
 * @returns A `{feed, flush}` handle for the chosen parser.
 * @complexity O(1) dispatch; the returned handler's own per-chunk cost is the parser's.
 * @overallScore 100/100
 */
function createStreamHandlerForDef(
  def: RuntimeAgentDef,
  streamFormat: JsonStreamFormat,
  onEvent: (event: Record<string, unknown>) => void,
): StreamHandler {
  switch (streamFormat) {
    case 'claude-stream-json':
      return createClaudeStreamHandler(onEvent);
    case 'copilot-stream-json':
      return createCopilotStreamHandler(onEvent);
    case 'qoder-stream-json':
      return createQoderStreamHandler(onEvent);
    case 'json-event-stream':
      return createJsonEventStreamHandler(def.eventParser ?? '', onEvent);
  }
}

/**
 * Result of translating one parsed stream event into this engine's
 * vocabulary. `'agent'` is the common case (forward as a `RunAgentPayload`
 * via the `'agent'` run event); `'error'` and `'turn-end'` are the two
 * type values `run()` handles specially rather than passing through (see
 * module doc); `'ignored'` covers anything the 4 parsers never actually
 * produce plus defensively malformed/non-record input.
 *
 * `'agent'`'s optional `sessionId` (gap 5, session resume — see
 * `RunEndPayload.sessionRef`'s doc in `@jini/protocol`) is a daemon-internal
 * side channel, not part of the `RunAgentPayload` wire payload itself:
 * OpenCode's `sessionID`/Codex's `thread_id`/Qoder's and Claude's
 * `session_id` all arrive on a `'status'` event alongside fields
 * `RunAgentPayload`'s `'status'` variant already models (`label`/`model`/
 * `ttftMs`/`detail`) but has no room for a session id itself — surfacing it
 * here lets a lifecycle-wiring function capture it into a local variable and
 * thread it into its own terminal `finish()` call, without widening the
 * public wire protocol just to carry a value that only this module reads.
 */
export type AgentRuntimeEventTranslation =
  | { readonly kind: 'agent'; readonly payload: RunAgentPayload; readonly sessionId?: string }
  | { readonly kind: 'error'; readonly payload: RunErrorPayload }
  | { readonly kind: 'turn-end' }
  | { readonly kind: 'ignored' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

/**
 * Narrows one parsed `usage` event's loosely-typed fields into
 * `RunAgentPayload`'s `usage` variant. The 4 source parsers attach extra
 * fields this narrow payload has no room for — `thought_tokens`,
 * `cached_read_tokens`/`cached_write_tokens` (opencode/gemini/codex),
 * `modelUsage`/`stopReason`/`isError` (qoder), a top-level `stopReason`
 * (claude/copilot) — all intentionally dropped here, not carried through.
 * @param rawEvent - The raw `{type:'usage', ...}` record from a stream parser.
 * @returns The narrowed `RunAgentPayload` `usage` variant.
 * @complexity O(1).
 * @overallScore 100/100
 */
function translateUsagePayload(rawEvent: Record<string, unknown>): RunAgentPayload {
  const rawUsage = isRecord(rawEvent.usage) ? rawEvent.usage : undefined;
  const inputTokens = rawUsage ? asOptionalNumber(rawUsage.input_tokens) : undefined;
  const outputTokens = rawUsage ? asOptionalNumber(rawUsage.output_tokens) : undefined;
  const usage =
    inputTokens !== undefined || outputTokens !== undefined
      ? {
          ...(inputTokens !== undefined ? { input_tokens: inputTokens } : {}),
          ...(outputTokens !== undefined ? { output_tokens: outputTokens } : {}),
        }
      : undefined;
  const costUsd = asOptionalNumber(rawEvent.costUsd);
  const durationMs = asOptionalNumber(rawEvent.durationMs);
  return {
    type: 'usage',
    ...(usage !== undefined ? { usage } : {}),
    ...(costUsd !== undefined ? { costUsd } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
  };
}

/**
 * Narrows one parser-emitted `{type, ...}` record into this engine's
 * `RunAgentPayload` union (or the `error`/`turn-end`/`ignored` routing
 * `run()` special-cases). Pure — no I/O, no closure state — so every
 * variant each of the 4 supported parsers can produce is directly
 * assertable in isolation.
 *
 * Defensive by construction: several real parser emissions carry fields
 * looser than `RunAgentPayload`'s types promise (e.g. copilot's
 * `tool.execution_start` emits `id: data.toolCallId ?? null` — a literal
 * `null`, not the `string` `RunAgentPayload['tool_use']['id']` demands).
 * Every field read here is defensively coerced (`asString`/
 * `asOptionalString`/`asOptionalNumber`) rather than trusted, so a
 * malformed or null field degrades to a safe default instead of
 * propagating `null`/`undefined` into a field typed as required, or
 * throwing.
 *
 * @param rawEvent - One event as delivered to a stream parser's `onEvent` callback.
 * @returns The routing + payload this event maps to.
 * @complexity O(1) — one discriminant switch, no iteration.
 * @overallScore 100/100
 */
export function translateAgentRuntimeEvent(rawEvent: unknown): AgentRuntimeEventTranslation {
  if (!isRecord(rawEvent) || typeof rawEvent.type !== 'string') {
    return { kind: 'ignored' };
  }

  switch (rawEvent.type) {
    case 'status': {
      const model = asOptionalString(rawEvent.model);
      const ttftMs = asOptionalNumber(rawEvent.ttftMs);
      const detail = asOptionalString(rawEvent.detail);
      const sessionId = asOptionalString(rawEvent.sessionId);
      return {
        kind: 'agent',
        payload: {
          type: 'status',
          label: asString(rawEvent.label, 'unknown'),
          ...(model !== undefined ? { model } : {}),
          ...(ttftMs !== undefined ? { ttftMs } : {}),
          ...(detail !== undefined ? { detail } : {}),
        },
        ...(sessionId !== undefined ? { sessionId } : {}),
      };
    }
    case 'text_delta':
      return { kind: 'agent', payload: { type: 'text_delta', delta: asString(rawEvent.delta) } };
    case 'thinking_start':
      return { kind: 'agent', payload: { type: 'thinking_start' } };
    case 'thinking_delta':
      return { kind: 'agent', payload: { type: 'thinking_delta', delta: asString(rawEvent.delta) } };
    case 'tool_use':
      return {
        kind: 'agent',
        payload: {
          type: 'tool_use',
          id: asString(rawEvent.id),
          name: asString(rawEvent.name),
          input: rawEvent.input ?? null,
        },
      };
    case 'tool_input_delta':
      return {
        kind: 'agent',
        payload: {
          type: 'tool_input_delta',
          id: asString(rawEvent.id),
          name: asString(rawEvent.name),
          delta: asString(rawEvent.delta),
        },
      };
    case 'tool_result': {
      const isError = typeof rawEvent.isError === 'boolean' ? rawEvent.isError : undefined;
      return {
        kind: 'agent',
        payload: {
          type: 'tool_result',
          toolUseId: asString(rawEvent.toolUseId),
          content: asString(rawEvent.content),
          ...(isError !== undefined ? { isError } : {}),
        },
      };
    }
    case 'usage':
      return { kind: 'agent', payload: translateUsagePayload(rawEvent) };
    case 'raw':
      return { kind: 'agent', payload: { type: 'raw', line: asString(rawEvent.line) } };
    case 'error': {
      const code = asOptionalString(rawEvent.code);
      const message = asString(rawEvent.message, 'Unknown agent error');
      return {
        kind: 'error',
        payload: { message, ...(code !== undefined ? { error: { code, message } } : {}) },
      };
    }
    case 'turn_end':
      // Claude-specific per-turn boundary. Not forwarded as an 'agent'
      // event (no RunAgentPayload variant represents it) — run() reacts to
      // it directly to close stdin. See module doc.
      return { kind: 'turn-end' };
    default:
      return { kind: 'ignored' };
  }
}

/** Machine-readable failure reasons `run()` can reject with — every one is preceded by a `lifecycle.finish({status:'failed'})` call (see module doc's Invariant section). */
export type AgentExecutorErrorCode =
  | 'AGENT_NOT_FOUND'
  | 'AGENT_RUNTIME_UNSUPPORTED'
  | 'AGENT_BINARY_NOT_RESOLVED'
  | 'AGENT_SPAWN_FAILED'
  | 'AGENT_PROMPT_TOO_LARGE';

/** Thrown by `AgentExecutor.run()` on every failure path — never a bare `Error`, so callers can branch on `.code` instead of parsing `.message`. */
export class AgentExecutorError extends Error {
  readonly code: AgentExecutorErrorCode;

  constructor(code: AgentExecutorErrorCode, message: string) {
    super(message);
    this.name = 'AgentExecutorError';
    this.code = code;
  }
}

export interface AgentExecutorRunInput {
  readonly runId: string;
  readonly agentId: string;
  readonly prompt: string;
  readonly cwd: string;
  readonly env?: NodeJS.ProcessEnv;
}

export interface AgentExecutor {
  /**
   * Spawns `agentId`'s CLI for `runId`, wires its stdout/stderr into
   * `lifecycle.emit()`, and resolves once the child process is confirmed
   * spawned (fire-and-forget from there — see module doc). Callers await
   * `lifecycle.waitForTerminal(runId)` separately for completion.
   * @throws {@link AgentExecutorError} on every failure path — the
   * underlying run is always already transitioned to `'failed'` via
   * `lifecycle.finish()` before this rejects (see module doc's Invariant).
   */
  run(input: AgentExecutorRunInput): Promise<void>;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Drops `undefined` values so `NodeJS.ProcessEnv` (whose values are
 * `string | undefined`) can feed `resolveAgentLaunch`'s
 * `Record<string, string>` parameter.
 * @param env - The source environment (typically `input.env ?? process.env`).
 * @returns A new object containing only the string-valued entries.
 * @complexity O(n) in the number of env entries.
 * @overallScore 100/100
 */
function toStringEnvRecord(env: NodeJS.ProcessEnv): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') result[key] = value;
  }
  return result;
}

/**
 * Resolves once `child` emits `'spawn'`, or rejects on `'error'`. Replicates
 * `@jini/platform`'s own internal (non-exported) `waitForChildSpawn` race
 * idiom inline — see that module's `spawnLoggedProcess`/`spawnBackgroundProcess`.
 * @param child - The just-spawned `ChildProcess` to race.
 * @returns A promise settling on the first of `'spawn'`/`'error'` to fire.
 * @complexity O(1) — two one-time listener registrations.
 * @overallScore 100/100
 */
function waitForSpawnOrError(child: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('spawn', resolve);
  });
}

interface TerminateChildTreeDeps {
  readonly listProcessSnapshots: () => Promise<ProcessSnapshot[]>;
  readonly collectProcessTreePids: typeof collectProcessTreePids;
  readonly stopProcesses: (pids: Array<number | null | undefined>) => Promise<StopProcessesResult>;
}

/**
 * Enumerates `child`'s full descendant process tree and stops it (SIGTERM →
 * SIGKILL escalation, via the injected `stopProcesses` port).
 * @param deps - The process-snapshot/tree-collection/stop ports (real `@jini/platform` implementations by default — see {@link CreateAgentExecutorOptions}).
 * @param child - The child whose descendant tree should be terminated.
 * @returns Resolves once escalation completes (or immediately, as a no-op, if `child.pid` was never assigned — spawn never actually started).
 * @complexity O(p) in the number of live OS processes (`listProcessSnapshots`'s own cost) plus O(1) escalation rounds.
 * @overallScore 100/100
 */
async function terminateChildTree(deps: TerminateChildTreeDeps, child: ChildProcess): Promise<void> {
  if (child.pid == null) return;
  const processes = await deps.listProcessSnapshots();
  const pids = deps.collectProcessTreePids(processes, [child.pid]);
  await deps.stopProcesses(pids);
}

/** Which caller invoked {@link terminateChildTreeBestEffort} — carried through to `onCleanupFailure` (SEC-007) for diagnosis. */
export type AgentCleanupFailurePhase = 'cancel' | 'acp-attach-failure' | 'pi-rpc-attach-failure';

export interface AgentCleanupFailureContext {
  readonly runId: string;
  readonly phase: AgentCleanupFailurePhase;
  readonly pid: number;
  readonly error: unknown;
}

/** Default sink when a host does not supply `onCleanupFailure`: still observable, never silent. Redacted per SEC-007 (a spawn/permission error can embed paths/host detail). */
function defaultCleanupFailureSink(context: AgentCleanupFailureContext): void {
  // eslint-disable-next-line no-console
  console.error(
    `[@jini/daemon] agent-executor: process-tree cleanup failed for run "${context.runId}" (${context.phase}, pid=${context.pid})`,
    redactSecrets(errorMessage(context.error)),
  );
}

/**
 * Fire-and-forget-safe wrapper around {@link terminateChildTree} for the cancellation paths
 * (a synchronous `onCancelRequested` listener, an ACP attach-failure catch) that observed this
 * promise with a bare `void` — silently swallowing any `listProcessSnapshots`/`stopProcesses`
 * rejection (e.g. EPERM — see `packages/platform/src/__tests__/process.test.ts`) and letting it
 * become an unhandled rejection, with descendants possibly still running and no diagnostic at
 * all (SEC-007). This never rejects: a tree-stop failure is reported through `onCleanupFailure`
 * (redacted) and followed by a best-effort direct kill of `child` itself, since the immediate
 * child is still worth trying even when tree enumeration/escalation failed.
 */
function terminateChildTreeBestEffort(
  deps: TerminateChildTreeDeps,
  child: ChildProcess,
  runId: string,
  phase: AgentCleanupFailurePhase,
  onCleanupFailure: (context: AgentCleanupFailureContext) => void,
): Promise<void> {
  return terminateChildTree(deps, child).catch((error: unknown) => {
    // `terminateChildTree` only reaches a rejecting call (rather than its own early return) once
    // its own `child.pid == null` guard has already passed, and a real ChildProcess's `pid` is
    // never unset after being assigned — so `child.pid` is provably a number here. The non-null
    // assertion documents that invariant instead of a `?? null` fallback that could never
    // actually be exercised (same pattern as `pi-rpc/session.ts`'s `resolveSessionPathChangedSince`).
    onCleanupFailure({ runId, phase, pid: child.pid!, error });
    try {
      if (child.pid != null && !child.killed) child.kill('SIGKILL');
    } catch {
      // Best-effort only — nothing further can be done from here.
    }
  });
}

/** A small handle `writePromptToStdin` uses to close stdin exactly once, shared with the `turn_end`-triggered close inside {@link wireChildLifecycle}. */
interface StdinCloseHandle {
  closeStdinOnce(): void;
  /** Journals a sent-to-stdin byte chunk, queued through the same FIFO {@link wireChildLifecycle} already uses for emitted events. No-op when no journal was configured (see `CreateAgentExecutorOptions.journal`). */
  recordSentBytes(content: string): void;
}

/**
 * Gap 1's byte-journal record for bytes the host sent to the child's stdin — always `trust:
 * 'trusted'`, since these are bytes this driver itself composed and wrote, not agent output. See
 * `packages/daemon/src/continuation/journal.ts`'s module doc.
 */
function sentJournalEntry(content: string): JournalEntry {
  return { content, provenance: { source: 'host', channel: 'stdin' }, trust: 'trusted' };
}

/**
 * Gap 1's byte-journal record for bytes a child agent process produced on `channel` — always
 * `trust: 'untrusted'`, since this is attacker-influenceable agent output the kernel does not
 * control (see `@jini/protocol`'s `JournalEntry` doc on why `trust` exists).
 */
function receivedJournalEntry(channel: 'stdout' | 'stderr', content: string): JournalEntry {
  return { content, provenance: { source: 'agent', channel }, trust: 'untrusted' };
}

interface WireChildLifecycleContext extends TerminateChildTreeDeps {
  readonly runId: string;
  readonly def: RuntimeAgentDef;
  readonly streamFormat: ChildDrivenStreamFormat;
  readonly child: ChildProcess;
  readonly lifecycle: RunLifecycle;
  readonly onCleanupFailure: (context: AgentCleanupFailureContext) => void;
  /** Removes a `promptViaFile`-staged temp file (grok-build) after the child exits. A no-op default when no prompt file was staged for this run — see `run()`'s `preparePromptFileForAgent` call site. */
  readonly cleanupPromptFile: () => Promise<void>;
  /** Gap 1's byte-journal (see `continuation/journal.ts`). `undefined` when a caller configured none — every journal call site below is then a no-op. */
  readonly journal: RunByteJournal | undefined;
}

/**
 * Wires one spawned child's full observable lifecycle: raw stdout/stderr
 * forwarding, structured stream-parser dispatch (translated via
 * {@link translateAgentRuntimeEvent}), cancellation (subscribes
 * `lifecycle.onCancelRequested` and escalates via `stopProcesses` on the
 * child's full descendant tree), and the terminal `close` → `finish()`
 * transition. Registered *before* the caller awaits spawn confirmation so
 * no early `'error'`/`'close'` event is ever missed.
 *
 * Every `lifecycle.emit()` call is funneled through a per-run FIFO queue
 * (`enqueueEmit`) rather than fired independently: a single stdout `data`
 * chunk can synchronously produce several parsed events (a JSON line's
 * `feed()` call may invoke `onEvent` more than once), and successive
 * `data` events must not have their derived `emit()` calls race each
 * other out of order. The queue also absorbs an individual `emit()`
 * rejection (e.g. a race against an already-terminal run) without losing
 * subsequently queued events, and the `close` handler awaits it fully
 * drained before computing the terminal outcome — so `finish()`'s `'end'`
 * event is always durably last, never interleaved with a still-in-flight
 * `'agent'`/`'stdout'`/`'stderr'` append.
 *
 * `streamFormat: 'plain'` gets no `createStreamHandlerForDef` parser at
 * all (Option B — see module doc and
 * `ADS-memory/reports/proposals/PROP-plain-format-agent-driving-2026-07-21.md`
 * §3): every raw stdout chunk is forwarded live, verbatim, as its own
 * `text_delta` `'agent'` event, through the same `enqueueEmit` FIFO queue
 * every other emit already goes through — no buffering until close, no new
 * parser state machine. **Deliberately un-hygiened for v1**: no ANSI/
 * terminal-control-sequence stripping is applied (there is no Jini
 * equivalent of OD's `TerminalControlSequenceStripper` yet) — a documented
 * decision, not an oversight; see `packages/daemon/source-map.md`'s
 * 2026-07-21 addition for the reasoning.
 *
 * @param ctx - Run/def/child/lifecycle plus the cancellation-escalation ports.
 * @returns A handle exposing `closeStdinOnce` for the initial prompt write to share.
 * @complexity Registration is O(1); steady-state per-chunk cost is the
 * chosen stream parser's own `feed()` cost plus O(1) queue bookkeeping.
 * @overallScore 100/100
 */
function wireChildLifecycle(ctx: WireChildLifecycleContext): StdinCloseHandle {
  const { runId, def, streamFormat, child, lifecycle, journal } = ctx;
  let stdinClosed = false;
  let cancelRequested = false;
  let emitQueue: Promise<void> = Promise.resolve();
  // Gap 5 (session resume) — the last session/thread id a 'status' event reported, threaded into
  // finish()'s sessionRef below. `streamFormat === 'plain'` defs have no structured parser and
  // therefore never populate this — an honest scope limit, not an oversight.
  let capturedSessionId: string | undefined;

  function enqueueEmit(task: () => Promise<unknown>): void {
    emitQueue = emitQueue.then(async () => {
      try {
        await task();
      } catch {
        // A single emit failing (e.g. a race against an already-terminal
        // run) must not block delivery of subsequently queued events —
        // see this function's own doc.
      }
    });
  }

  function closeStdinOnce(): void {
    if (stdinClosed) return;
    stdinClosed = true;
    child.stdin?.end();
  }

  const streamHandler: StreamHandler | null =
    streamFormat === 'plain'
      ? null
      : createStreamHandlerForDef(def, streamFormat, (rawEvent) => {
          const translation = translateAgentRuntimeEvent(rawEvent);
          if (translation.kind === 'agent') {
            if (translation.sessionId !== undefined) capturedSessionId = translation.sessionId;
            enqueueEmit(() => lifecycle.emit(runId, { event: 'agent', data: translation.payload }));
          } else if (translation.kind === 'error') {
            enqueueEmit(() => lifecycle.emit(runId, { event: 'error', data: translation.payload }));
          } else if (translation.kind === 'turn-end') {
            closeStdinOnce();
          }
        });

  child.stdout?.on('data', (chunk: Buffer | string) => {
    const text = chunk.toString('utf8');
    if (journal) enqueueEmit(() => journal.record(runId, receivedJournalEntry('stdout', text)));
    enqueueEmit(() => lifecycle.emit(runId, { event: 'stdout', data: { chunk: text } }));
    if (streamFormat === 'plain') {
      enqueueEmit(() => lifecycle.emit(runId, { event: 'agent', data: { type: 'text_delta', delta: text } }));
    } else {
      // Non-null: `streamHandler` is only ever null when `streamFormat === 'plain'` (see its
      // construction above), the branch this `else` provably excludes.
      streamHandler!.feed(text);
    }
  });

  child.stderr?.on('data', (chunk: Buffer | string) => {
    const text = chunk.toString('utf8');
    if (journal) enqueueEmit(() => journal.record(runId, receivedJournalEntry('stderr', text)));
    enqueueEmit(() => lifecycle.emit(runId, { event: 'stderr', data: { chunk: text } }));
  });

  // EPIPE-tolerant: a fast-exiting child that closes its stdin read end
  // before every queued write lands must not crash the host process with
  // an unhandled stream error — the real failure (if any) surfaces through
  // the 'close' handler below regardless.
  child.stdin?.on('error', () => {});
  // Safety net for any child-level 'error' event that fires after the
  // spawn-confirmation race (see waitForSpawnOrError) has already settled —
  // EventEmitter throws on an unheard 'error' otherwise. The real outcome
  // is still decided by 'close' below.
  child.on('error', () => {});

  const unsubscribeCancel = lifecycle.onCancelRequested(runId, () => {
    cancelRequested = true;
    void terminateChildTreeBestEffort(ctx, child, runId, 'cancel', ctx.onCleanupFailure);
  });

  child.on('close', (code, signal) => {
    void (async () => {
      // Not wrapped in try/catch: all 4 supported parser factories'
      // flush() implementations already internally guard their own
      // JSON.parse/dispatch and degrade a malformed trailing buffered
      // line to a `{type:'raw'}` event rather than throwing (confirmed by
      // reading each of the 4 modules in full — see module doc). A guard
      // here would be dead code for the fixed, closed set of parsers this
      // driver dispatches to. `streamHandler` is null for `'plain'` (no
      // parser, hence nothing to flush) — `?.` skips it cleanly.
      streamHandler?.flush();
      await emitQueue;
      unsubscribeCancel();
      await ctx.cleanupPromptFile();
      const status = classifyRunCloseStatus({ cancelRequested, code, signal });
      await lifecycle.finish({
        runId,
        status,
        code,
        signal: signal ?? null,
        resumable: false,
        ...(capturedSessionId !== undefined ? { sessionRef: capturedSessionId } : {}),
      });
    })();
  });

  return {
    closeStdinOnce,
    recordSentBytes(content: string): void {
      if (journal) enqueueEmit(() => journal.record(runId, sentJournalEntry(content)));
    },
  };
}

interface WireAcpLifecycleContext extends TerminateChildTreeDeps {
  readonly runId: string;
  readonly child: ChildProcess;
  readonly lifecycle: RunLifecycle;
  readonly prompt: string;
  readonly cwd: string;
  readonly envFormat: 'array' | 'map' | undefined;
  readonly onPermissionRequest: AcpPermissionHandler | undefined;
  readonly attachAcpSession: typeof attachAcpSession;
  readonly onCleanupFailure: (context: AgentCleanupFailureContext) => void;
  /** Same seam as `WireChildLifecycleContext.cleanupPromptFile` — no current ACP def declares `promptViaFile`, so this is always the no-op default in practice today, threaded through for consistency rather than special-cased away. */
  readonly cleanupPromptFile: () => Promise<void>;
  /** Gap 1's byte-journal (see `continuation/journal.ts`). Covers this wrapper's own raw stdout/stderr forwarding only — the actual ACP prompt delivery happens inside `attachAcpSession`'s own transport, out of this module's direct view, so sent bytes are not journaled on this path (an honestly-scoped v1 gap, not an oversight). */
  readonly journal: RunByteJournal | undefined;
}

/**
 * Maps an ACP session's transport error into the canonical run-error shape.
 * ACP adapters may add a structured `error` member, but a daemon driver must
 * never make one vendor's error shape part of the run protocol.
 */
function translateAcpError(payload: unknown): RunErrorPayload {
  if (!isRecord(payload)) return { message: asString(payload, 'ACP agent failed') };
  const message = asString(payload.message, 'ACP agent failed');
  const error = isRecord(payload.error) ? payload.error : null;
  const code = error ? asOptionalString(error.code) : undefined;
  const retryable = error && typeof error.retryable === 'boolean' ? error.retryable : undefined;
  return {
    message,
    ...(code !== undefined
      ? {
          error: {
            code,
            message: asString(error?.message, message),
            ...(retryable !== undefined ? { retryable } : {}),
          },
        }
      : {}),
  };
}

/**
 * Wires an ACP child to a run. Unlike the JSON-stream path, ACP owns the
 * prompt protocol and reports its parsed events through `attachAcpSession`'s
 * callback. This wrapper retains raw stdout/stderr for diagnostics, preserves
 * event order through the same FIFO discipline, forwards cancellation both as
 * ACP `session/cancel` and an OS process-tree stop, and uses the controller's
 * clean-prompt signal rather than SIGTERM (expected ACP cleanup) to determine
 * success.
 */
function wireAcpLifecycle(ctx: WireAcpLifecycleContext): AcpSessionController {
  const { runId, child, lifecycle, journal } = ctx;
  let cancelRequested = false;
  let emitQueue: Promise<void> = Promise.resolve();
  // Gap 5 (session resume) — see wireChildLifecycle's identical local for the full rationale.
  let capturedSessionId: string | undefined;

  function enqueueEmit(task: () => Promise<unknown>): void {
    emitQueue = emitQueue.then(async () => {
      try {
        await task();
      } catch {
        // A late event racing a terminal lifecycle is intentionally dropped;
        // it must not prevent subsequent queued cleanup from running.
      }
    });
  }

  child.stdout?.on('data', (chunk: Buffer | string) => {
    const text = chunk.toString('utf8');
    if (journal) enqueueEmit(() => journal.record(runId, receivedJournalEntry('stdout', text)));
    enqueueEmit(() => lifecycle.emit(runId, { event: 'stdout', data: { chunk: text } }));
  });
  child.stderr?.on('data', (chunk: Buffer | string) => {
    const text = chunk.toString('utf8');
    if (journal) enqueueEmit(() => journal.record(runId, receivedJournalEntry('stderr', text)));
    enqueueEmit(() => lifecycle.emit(runId, { event: 'stderr', data: { chunk: text } }));
  });
  child.stdin?.on('error', () => {});
  child.on('error', () => {});

  let controller: AcpSessionController | null = null;
  const unsubscribeCancel = lifecycle.onCancelRequested(runId, () => {
    cancelRequested = true;
    controller?.abort();
    void terminateChildTreeBestEffort(ctx, child, runId, 'cancel', ctx.onCleanupFailure);
  });

  child.on('close', (code, signal) => {
    void (async () => {
      await emitQueue;
      unsubscribeCancel();
      await ctx.cleanupPromptFile();
      const status = cancelRequested ? 'cancelled' : controller?.completedSuccessfully() ? 'succeeded' : 'failed';
      await lifecycle.finish({
        runId,
        status,
        code,
        signal: signal ?? null,
        resumable: false,
        ...(capturedSessionId !== undefined ? { sessionRef: capturedSessionId } : {}),
      });
    })();
  });

  controller = ctx.attachAcpSession({
    child,
    prompt: ctx.prompt,
    cwd: ctx.cwd,
    ...(ctx.envFormat !== undefined ? { envFormat: ctx.envFormat } : {}),
    ...(ctx.onPermissionRequest !== undefined ? { onPermissionRequest: ctx.onPermissionRequest } : {}),
    send(event, payload) {
      if (event === 'agent') {
        const translation = translateAgentRuntimeEvent(payload);
        if (translation.kind === 'agent') {
          if (translation.sessionId !== undefined) capturedSessionId = translation.sessionId;
          enqueueEmit(() => lifecycle.emit(runId, { event: 'agent', data: translation.payload }));
        } else if (translation.kind === 'error') {
          enqueueEmit(() => lifecycle.emit(runId, { event: 'error', data: translation.payload }));
        }
        return;
      }
      if (event === 'error') {
        enqueueEmit(() => lifecycle.emit(runId, { event: 'error', data: translateAcpError(payload) }));
      }
    },
  });
  return controller;
}

interface WirePiRpcLifecycleContext extends TerminateChildTreeDeps {
  readonly runId: string;
  readonly child: ChildProcess;
  readonly lifecycle: RunLifecycle;
  readonly prompt: string;
  readonly cwd: string;
  readonly attachPiRpcSession: typeof attachPiRpcSession;
  readonly onCleanupFailure: (context: AgentCleanupFailureContext) => void;
  /** Same seam as `WireChildLifecycleContext.cleanupPromptFile` — no current pi-rpc def declares `promptViaFile`, so this is always the no-op default in practice today, threaded through for consistency rather than special-cased away. */
  readonly cleanupPromptFile: () => Promise<void>;
  /** Gap 1's byte-journal (see `continuation/journal.ts`). Same scope boundary as `WireAcpLifecycleContext.journal`: covers this wrapper's own raw stdout/stderr forwarding only, not the prompt bytes `attachPiRpcSession` sends through its own transport. */
  readonly journal: RunByteJournal | undefined;
}

/**
 * Wires a pi-rpc child to a run. Like ACP, pi owns its own prompt-delivery
 * protocol (`prompt`/`new_session`/`abort` RPC commands over stdin) and
 * reports parsed events through `attachPiRpcSession`'s `send` callback —
 * unlike ACP's callback, pi-rpc's `send` always uses the `'agent'` channel
 * (confirmed by reading every `mapPiRpcEvent` call site: error-ness is
 * signaled via the payload's own `type: 'error'` field, never a separate
 * channel), so this wrapper runs every payload through the same
 * `translateAgentRuntimeEvent` pipeline ACP/JSON-stream already use, with no
 * channel branch needed. Raw stdout/stderr are still forwarded for
 * diagnostics (same as ACP) even though `attachPiRpcSession` also consumes
 * `child.stdout` itself for its own JSON-RPC parsing — Node multicasts
 * `'data'` events to every listener, so both coexist safely.
 *
 * v1 omits `model`/`imagePaths`/`uploadRoot`/`parentSession` — none of
 * `AgentExecutorRunInput`'s fields carry them yet (matching this module's
 * established "explicitly out of scope" discipline for other follow-ups:
 * multi-turn tool continuation, resumable session ids, etc.).
 */
function wirePiRpcLifecycle(ctx: WirePiRpcLifecycleContext): PiRpcSession {
  const { runId, child, lifecycle, journal } = ctx;
  let cancelRequested = false;
  let emitQueue: Promise<void> = Promise.resolve();
  // Gap 5 (session resume) — see wireChildLifecycle's identical local for the full rationale.
  let capturedSessionId: string | undefined;

  function enqueueEmit(task: () => Promise<unknown>): void {
    emitQueue = emitQueue.then(async () => {
      try {
        await task();
      } catch {
        // A late event racing a terminal lifecycle is intentionally dropped;
        // it must not prevent subsequent queued cleanup from running.
      }
    });
  }

  child.stdout?.on('data', (chunk: Buffer | string) => {
    const text = chunk.toString('utf8');
    if (journal) enqueueEmit(() => journal.record(runId, receivedJournalEntry('stdout', text)));
    enqueueEmit(() => lifecycle.emit(runId, { event: 'stdout', data: { chunk: text } }));
  });
  child.stderr?.on('data', (chunk: Buffer | string) => {
    const text = chunk.toString('utf8');
    if (journal) enqueueEmit(() => journal.record(runId, receivedJournalEntry('stderr', text)));
    enqueueEmit(() => lifecycle.emit(runId, { event: 'stderr', data: { chunk: text } }));
  });
  child.stdin?.on('error', () => {});
  child.on('error', () => {});

  let session: PiRpcSession | null = null;
  const unsubscribeCancel = lifecycle.onCancelRequested(runId, () => {
    cancelRequested = true;
    session?.abort();
    void terminateChildTreeBestEffort(ctx, child, runId, 'cancel', ctx.onCleanupFailure);
  });

  child.on('close', (code, signal) => {
    void (async () => {
      await emitQueue;
      unsubscribeCancel();
      await ctx.cleanupPromptFile();
      const status = cancelRequested ? 'cancelled' : session?.hasFatalError() ? 'failed' : 'succeeded';
      await lifecycle.finish({
        runId,
        status,
        code,
        signal: signal ?? null,
        resumable: false,
        ...(capturedSessionId !== undefined ? { sessionRef: capturedSessionId } : {}),
      });
    })();
  });

  session = ctx.attachPiRpcSession({
    child: ctx.child,
    prompt: ctx.prompt,
    cwd: ctx.cwd,
    send(_channel, payload) {
      const translation = translateAgentRuntimeEvent(payload);
      if (translation.kind === 'agent') {
        if (translation.sessionId !== undefined) capturedSessionId = translation.sessionId;
        enqueueEmit(() => lifecycle.emit(runId, { event: 'agent', data: translation.payload }));
      } else if (translation.kind === 'error') {
        enqueueEmit(() => lifecycle.emit(runId, { event: 'error', data: translation.payload }));
      }
    },
  });
  return session;
}

/**
 * Writes the initial user turn to the child's stdin per `def.promptInputFormat`
 * (both branches only run for `promptViaStdin: true` defs — the only shape
 * `run()` supports in v1, see module doc):
 * - `'text'` (default): the raw prompt buffer, then stdin is closed —
 *   matches `RuntimeAgentDef.promptInputFormat`'s own doc.
 * - `'stream-json'`: one JSONL line wrapping the prompt as an Anthropic
 *   user message; stdin is deliberately left open (a real multi-turn
 *   caller would inject further messages) — v1 has no such caller, so
 *   {@link wireChildLifecycle}'s `turn_end` handling closes it once the
 *   agent's own stream reports the turn ended.
 * @param def - The resolved agent def (only `.promptInputFormat` is read).
 * @param child - The spawned child (no-ops if `.stdin` is unexpectedly absent).
 * @param prompt - The composed user turn.
 * @param handle - Shared stdin-close guard so a `'text'` write's immediate close and a later `turn_end` close never race into a double-`end()`; also carries gap 1's byte-journal recorder (see `StdinCloseHandle.recordSentBytes`).
 * @complexity O(1) plus the underlying stream write's own cost.
 * @overallScore 100/100
 */
function writePromptToStdin(def: RuntimeAgentDef, child: ChildProcess, prompt: string, handle: StdinCloseHandle): void {
  const stdin = child.stdin;
  if (!stdin) return;
  if (def.promptInputFormat === 'stream-json') {
    const line = JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: prompt }] } });
    stdin.write(`${line}\n`, 'utf8');
    handle.recordSentBytes(prompt);
    return;
  }
  stdin.write(prompt, 'utf8');
  handle.recordSentBytes(prompt);
  handle.closeStdinOnce();
}

export interface CreateAgentExecutorOptions {
  readonly lifecycle: RunLifecycle;
  /** @default the real `@jini/agent-runtime` registry lookup */
  readonly getAgentDef?: typeof getAgentDef;
  /** @default the real `@jini/agent-runtime` launch resolver */
  readonly resolveAgentLaunch?: typeof resolveAgentLaunch;
  /** @default the real `@jini/agent-runtime` PATH-env composer */
  readonly applyAgentLaunchEnv?: typeof applyAgentLaunchEnv;
  /** @default the real `@jini/platform` cross-platform invocation builder */
  readonly createCommandInvocation?: typeof createCommandInvocation;
  /** @default `node:child_process`'s `spawn` */
  readonly spawn?: typeof nodeSpawn;
  /** @default the real `@jini/agent-runtime` ACP session transport */
  readonly attachAcpSession?: typeof attachAcpSession;
  /**
   * Host-owned policy for ACP agents' native tool calls. The ACP agent still
   * executes its own selected option; Jini-registered tool execution belongs
   * to `createDelegatedToolBridge`, not this permission callback.
   */
  readonly acpPermissionHandler?: AcpPermissionHandler;
  /** @default the real `@jini/agent-runtime` pi-rpc session transport */
  readonly attachPiRpcSession?: typeof attachPiRpcSession;
  /**
   * Stages a `promptViaFile` def's (grok-build) composed prompt to a temp
   * file before `buildArgs` runs. Touches the real filesystem by default
   * (`fs.mkdtemp`/`fs.writeFile`/`fs.rm`) — injectable so tests can drive
   * it without real disk I/O, matching this factory's "no real subprocess,
   * filesystem, or PATH lookup by default in tests" convention.
   * @default the real `@jini/agent-runtime` prompt-file stager
   */
  readonly preparePromptFileForAgent?: typeof preparePromptFileForAgent;
  /** @default the real `@jini/platform` process-snapshot enumerator */
  readonly listProcessSnapshots?: typeof listProcessSnapshots;
  /** @default the real `@jini/platform` descendant-PID collector */
  readonly collectProcessTreePids?: typeof collectProcessTreePids;
  /** @default the real `@jini/platform` SIGTERM→SIGKILL escalator */
  readonly stopProcesses?: typeof stopProcesses;
  /** Host-owned sink for a process-tree cleanup failure (SEC-007) — e.g. EPERM stopping descendants. @default logs a redacted diagnostic via `console.error` */
  readonly onCleanupFailure?: (context: AgentCleanupFailureContext) => void;
  /**
   * Gap 1's byte-journal (`packages/daemon/src/continuation/journal.ts`) — records every byte
   * this driver sends to or receives from a child agent process, independent of and prior to any
   * parsed/translated event. Covers `writePromptToStdin` (sent) and every `child.stdout`/
   * `child.stderr` `'data'` handler this driver owns (received); does not cover ACP/pi-rpc's own
   * prompt delivery, which happens inside their respective attach functions' own transport, out
   * of this driver's direct view — see `WireAcpLifecycleContext.journal`'s doc.
   * @default no journal — recording is entirely opt-in, unlike every other seam on this
   * interface (which default to a real implementation): there is no generic "real" journal
   * storage this package can default to without a caller-supplied `EventLog` instance.
   */
  readonly journal?: RunByteJournal;
}

/**
 * Creates the `AgentExecutor` reference implementation: an in-process
 * `RunLifecycle` driver over real (by default) `@jini/agent-runtime`
 * registry lookup, launch resolution, and stream parsing, plus a real
 * `node:child_process.spawn`. Every collaborator is an injectable seam
 * (matching this package's established convention — see
 * `tool-executor.ts`/`run-lifecycle.ts`) so tests can drive a fake child
 * process and a fake registry without touching the filesystem or spawning
 * a real subprocess.
 *
 * @param options.lifecycle - The `RunLifecycle` this executor drives — its `start()` must already have been called for any `runId` passed to `run()`.
 * @returns An `AgentExecutor` whose `run()` never bare-throws (see module doc's Invariant).
 * @complexity `run()`'s own setup is O(1); steady-state cost is the chosen stream parser's.
 * @overallScore 100/100
 */
export function createAgentExecutor(options: CreateAgentExecutorOptions): AgentExecutor {
  const lifecycle = options.lifecycle;
  const getAgentDefFn = options.getAgentDef ?? getAgentDef;
  const resolveAgentLaunchFn = options.resolveAgentLaunch ?? resolveAgentLaunch;
  const applyAgentLaunchEnvFn = options.applyAgentLaunchEnv ?? applyAgentLaunchEnv;
  const createCommandInvocationFn = options.createCommandInvocation ?? createCommandInvocation;
  const spawnFn = options.spawn ?? nodeSpawn;
  const attachAcpSessionFn = options.attachAcpSession ?? attachAcpSession;
  const attachPiRpcSessionFn = options.attachPiRpcSession ?? attachPiRpcSession;
  const preparePromptFileForAgentFn = options.preparePromptFileForAgent ?? preparePromptFileForAgent;
  const listProcessSnapshotsFn = options.listProcessSnapshots ?? listProcessSnapshots;
  const collectProcessTreePidsFn = options.collectProcessTreePids ?? collectProcessTreePids;
  const stopProcessesFn = options.stopProcesses ?? stopProcesses;
  const onCleanupFailureFn = options.onCleanupFailure ?? defaultCleanupFailureSink;
  const journal = options.journal;

  /**
   * Transitions `runId` to `'failed'` (idempotent, never resumable — no
   * classifier exists, see module doc) then rejects with a typed
   * {@link AgentExecutorError}. Every pre-spawn guard in `run()` returns
   * this call directly.
   * @param runId - The run to transition.
   * @param code - The machine-readable failure reason.
   * @param message - The human-readable rejection message.
   * @throws Always — this function never returns normally.
   * @complexity O(1) plus `lifecycle.finish()`'s own cost.
   * @overallScore 100/100
   */
  async function failBeforeSpawn(runId: string, code: AgentExecutorErrorCode, message: string): Promise<never> {
    await lifecycle.finish({ runId, status: 'failed', code: null, signal: null, resumable: false });
    throw new AgentExecutorError(code, message);
  }

  /**
   * `AgentExecutor.run()` — see that interface method's own doc for the
   * public contract. Implementation note on shape: every guard below
   * returns `failBeforeSpawn(...)` directly (a `Promise<never>`, valid
   * wherever `Promise<void>` is expected) rather than `await`-then-`return`,
   * so each failure path reads as a single, obviously-terminal statement.
   * @param input - `{runId, agentId, prompt, cwd, env?}` — `runId` must already be `lifecycle.start()`-ed.
   * @throws {@link AgentExecutorError} — see module doc's Invariant; never a bare `Error`.
   * @complexity O(1) setup (registry lookup, launch resolution, one spawn call); steady-state cost thereafter belongs to {@link wireChildLifecycle}.
   * @overallScore 100/100
   */
  async function run(input: AgentExecutorRunInput): Promise<void> {
    const def = getAgentDefFn(input.agentId);
    if (!def) {
      return failBeforeSpawn(input.runId, 'AGENT_NOT_FOUND', `AgentExecutor: unknown agentId "${input.agentId}"`);
    }

    const streamFormat = def.streamFormat;
    if (!isSupportedStreamFormat(streamFormat)) {
      return failBeforeSpawn(
        input.runId,
        'AGENT_RUNTIME_UNSUPPORTED',
        `AgentExecutor: agent "${def.id}" has streamFormat "${streamFormat}", which is not implemented in v1 — only ${SUPPORTED_STREAM_FORMATS.join(', ')} are supported (see packages/daemon/source-map.md for the deferred antigravity guard)`,
      );
    }
    // Antigravity is the one plain def NOT driven — see module doc. This
    // guard is deliberately independent of (and ahead of) the generic
    // prompt-delivery/dispatch logic below: even though antigravity's def
    // declares promptViaStdin: true and would otherwise clear every guard
    // that follows, it needs auth-URL-leak buffering and a cross-run
    // model-selection lock this driver has no seam for yet.
    if (streamFormat === 'plain' && def.id === 'antigravity') {
      return failBeforeSpawn(
        input.runId,
        'AGENT_RUNTIME_UNSUPPORTED',
        `AgentExecutor: agent "${def.id}" needs auth-URL-leak buffering and a cross-run model-selection lock that generic streamFormat 'plain' driving does not provide — deliberately deferred, see ADS-memory/reports/proposals/PROP-plain-format-agent-driving-2026-07-21.md`,
      );
    }
    if (
      streamFormat !== 'acp-json-rpc' &&
      def.promptViaStdin !== true &&
      def.promptViaFile !== true &&
      typeof def.maxPromptArgBytes !== 'number'
    ) {
      return failBeforeSpawn(
        input.runId,
        'AGENT_RUNTIME_UNSUPPORTED',
        `AgentExecutor: agent "${def.id}" does not deliver its prompt via stdin, a staged prompt file, or a byte-budgeted argv — v1 has no other prompt delivery path`,
      );
    }

    // Argv-bound defs (aider, deepseek) — reject an oversized prompt before
    // ever resolving a binary or touching the filesystem. A no-op for every
    // def without `maxPromptArgBytes` (checkPromptArgvBudget's own guard).
    const argvBudgetError = checkPromptArgvBudget(def, input.prompt);
    if (argvBudgetError) {
      return failBeforeSpawn(input.runId, 'AGENT_PROMPT_TOO_LARGE', argvBudgetError.message);
    }

    const configuredEnv = toStringEnvRecord(input.env ?? process.env);
    const launch: AgentLaunchResolution = resolveAgentLaunchFn(def, configuredEnv);
    if (!launch.launchPath) {
      return failBeforeSpawn(
        input.runId,
        'AGENT_BINARY_NOT_RESOLVED',
        `AgentExecutor: could not resolve an executable for agent "${def.id}" (bin "${def.bin}")`,
      );
    }

    const spawnEnv = applyAgentLaunchEnvFn({ ...(input.env ?? process.env) }, launch);

    // Stage a promptViaFile def's (grok-build) prompt to a temp file before
    // buildArgs runs — its buildArgs throws without
    // runtimeContext.promptFilePath. A no-op (returns null) for every def
    // without promptViaFile: true (preparePromptFileForAgent's own guard).
    let preparedPromptFile: PreparedPromptFile | null;
    try {
      preparedPromptFile = await preparePromptFileForAgentFn(def, input.prompt, input.runId);
    } catch (err) {
      return failBeforeSpawn(
        input.runId,
        'AGENT_SPAWN_FAILED',
        `AgentExecutor: could not stage a prompt file for agent "${def.id}": ${errorMessage(err)}`,
      );
    }
    // Cleaned up after the child exits (wireChildLifecycle/wireAcpLifecycle/wirePiRpcLifecycle's
    // close handlers) and on every pre-spawn/spawn-failure path below — a leaked temp file
    // containing the full prompt is a confidentiality gap, not just a disk leak.
    const cleanupPromptFile: () => Promise<void> = preparedPromptFile
      ? preparedPromptFile.cleanup
      : async () => {};
    const runtimeContext: RuntimeContext | undefined = preparedPromptFile
      ? { promptFilePath: preparedPromptFile.path }
      : undefined;

    const args = def.buildArgs(input.prompt, [], undefined, undefined, runtimeContext);

    // Post-buildArgs guard for argv-bound defs whose resolved binary is a
    // Windows .cmd/.bat shim or a direct .exe: a prompt under the raw byte
    // budget can still expand past CreateProcess's command-line cap once
    // quote-escaped. Both are no-ops off-Windows / for non-argv-bound defs.
    const windowsBudgetError =
      checkWindowsCmdShimCommandLineBudget(def, launch.launchPath, args) ??
      checkWindowsDirectExeCommandLineBudget(def, launch.launchPath, args);
    if (windowsBudgetError) {
      await cleanupPromptFile();
      return failBeforeSpawn(input.runId, 'AGENT_PROMPT_TOO_LARGE', windowsBudgetError.message);
    }

    const invocation = createCommandInvocationFn({ command: launch.launchPath, args, env: spawnEnv });

    let child: ChildProcess;
    try {
      child = spawnFn(invocation.command, invocation.args, {
        cwd: input.cwd,
        env: spawnEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsVerbatimArguments: invocation.windowsVerbatimArguments,
      });
    } catch (err) {
      await cleanupPromptFile();
      return failBeforeSpawn(
        input.runId,
        'AGENT_SPAWN_FAILED',
        `AgentExecutor: spawn threw synchronously for agent "${def.id}": ${errorMessage(err)}`,
      );
    }

    const stdinHandle =
      streamFormat === 'acp-json-rpc' || streamFormat === 'pi-rpc'
        ? null
        : wireChildLifecycle({
            runId: input.runId,
            def,
            streamFormat,
            child,
            lifecycle,
            listProcessSnapshots: listProcessSnapshotsFn,
            collectProcessTreePids: collectProcessTreePidsFn,
            stopProcesses: stopProcessesFn,
            onCleanupFailure: onCleanupFailureFn,
            cleanupPromptFile,
            journal,
          });

    try {
      await waitForSpawnOrError(child);
    } catch (err) {
      await cleanupPromptFile();
      await lifecycle.finish({ runId: input.runId, status: 'failed', code: null, signal: null, resumable: false });
      throw new AgentExecutorError(
        'AGENT_SPAWN_FAILED',
        `AgentExecutor: failed to spawn agent "${def.id}": ${errorMessage(err)}`,
      );
    }

    if (streamFormat === 'acp-json-rpc') {
      try {
        wireAcpLifecycle({
          runId: input.runId,
          child,
          lifecycle,
          prompt: input.prompt,
          cwd: input.cwd,
          envFormat: def.acpMcpEnvFormat,
          onPermissionRequest: options.acpPermissionHandler,
          attachAcpSession: attachAcpSessionFn,
          listProcessSnapshots: listProcessSnapshotsFn,
          collectProcessTreePids: collectProcessTreePidsFn,
          stopProcesses: stopProcessesFn,
          onCleanupFailure: onCleanupFailureFn,
          cleanupPromptFile,
          journal,
        });
      } catch (err) {
        // Unlike the cancellation-listener call sites, we are already in an async function
        // about to call finish() and throw — nothing else races this, so cleanup is awaited
        // here rather than fired-and-forgotten (SEC-007: "await where lifecycle ordering allows it").
        await terminateChildTreeBestEffort(
          {
            listProcessSnapshots: listProcessSnapshotsFn,
            collectProcessTreePids: collectProcessTreePidsFn,
            stopProcesses: stopProcessesFn,
          },
          child,
          input.runId,
          'acp-attach-failure',
          onCleanupFailureFn,
        );
        await cleanupPromptFile();
        await lifecycle.finish({ runId: input.runId, status: 'failed', code: null, signal: null, resumable: false });
        throw new AgentExecutorError(
          'AGENT_SPAWN_FAILED',
          `AgentExecutor: could not attach ACP session for agent \"${def.id}\": ${errorMessage(err)}`,
        );
      }
      return;
    }

    if (streamFormat === 'pi-rpc') {
      try {
        wirePiRpcLifecycle({
          runId: input.runId,
          child,
          lifecycle,
          prompt: input.prompt,
          cwd: input.cwd,
          attachPiRpcSession: attachPiRpcSessionFn,
          listProcessSnapshots: listProcessSnapshotsFn,
          collectProcessTreePids: collectProcessTreePidsFn,
          stopProcesses: stopProcessesFn,
          onCleanupFailure: onCleanupFailureFn,
          cleanupPromptFile,
          journal,
        });
      } catch (err) {
        // Same discipline as the ACP attach-failure path directly above: await cleanup here
        // rather than fire-and-forget (SEC-007).
        await terminateChildTreeBestEffort(
          {
            listProcessSnapshots: listProcessSnapshotsFn,
            collectProcessTreePids: collectProcessTreePidsFn,
            stopProcesses: stopProcessesFn,
          },
          child,
          input.runId,
          'pi-rpc-attach-failure',
          onCleanupFailureFn,
        );
        await cleanupPromptFile();
        await lifecycle.finish({ runId: input.runId, status: 'failed', code: null, signal: null, resumable: false });
        throw new AgentExecutorError(
          'AGENT_SPAWN_FAILED',
          `AgentExecutor: could not attach pi-rpc session for agent \"${def.id}\": ${errorMessage(err)}`,
        );
      }
      return;
    }

    writePromptToStdin(def, child, input.prompt, stdinHandle!);
  }

  return { run };
}
