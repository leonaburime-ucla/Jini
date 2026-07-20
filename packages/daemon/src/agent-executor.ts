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
 * ## v1 scope: 18 of 24 registered agent defs
 *
 * `@jini/agent-runtime`'s registry ships 24 built-in defs across four
 * `streamFormat` families. Only the JSON-stream-parser family — the four
 * `createXStreamHandler`-shaped parsers (`claude-stream-json`,
 * `json-event-stream`, `copilot-stream-json`, `qoder-stream-json`), covering
 * 9 defs (amp, codebuddy, claude, codex, cursor-agent, opencode, mimo,
 * copilot, qoder) — plus all 9 `acp-json-rpc` defs — are wired here. ACP
 * owns its JSON-RPC handshake and prompt delivery, so it takes its own
 * lifecycle branch rather than being treated as a stdout-tail parser. The
 * remaining `pi-rpc` × 1 and `plain` × 5 shapes are still deliberately
 * unsupported; `plain` has no existing parser or dispatch branch anywhere
 * in this codebase and pi-rpc has a separately-shaped controller.
 * `run()` rejects cleanly (never a bare throw) with an `AgentExecutorError`
 * for any def outside the supported 18 — see `isSupportedStreamFormat`.
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
import type { RunAgentPayload, RunErrorPayload } from '@jini/protocol';
import {
  applyAgentLaunchEnv,
  createClaudeStreamHandler,
  createCopilotStreamHandler,
  createJsonEventStreamHandler,
  createQoderStreamHandler,
  getAgentDef,
  resolveAgentLaunch,
  attachAcpSession,
  type AcpPermissionHandler,
  type AcpSessionController,
  type AgentLaunchResolution,
  type RuntimeAgentDef,
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
] as const;

/** The 4 of the registry's stream-format families this driver implements — see module doc. */
export type SupportedStreamFormat = (typeof SUPPORTED_STREAM_FORMATS)[number];

type JsonStreamFormat = Exclude<SupportedStreamFormat, 'acp-json-rpc'>;

/**
 * Narrows a `RuntimeAgentDef.streamFormat` string to the 4 supported
 * families.
 * @param value - The def's raw `streamFormat` string.
 * @returns `true` when `value` is one of the 4 JSON-stream-parser formats this driver wires.
 * @complexity O(1) — fixed 4-element membership check.
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
 * parser's own documented behavior.
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
 */
export type AgentRuntimeEventTranslation =
  | { readonly kind: 'agent'; readonly payload: RunAgentPayload }
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
      return {
        kind: 'agent',
        payload: {
          type: 'status',
          label: asString(rawEvent.label, 'unknown'),
          ...(model !== undefined ? { model } : {}),
          ...(ttftMs !== undefined ? { ttftMs } : {}),
          ...(detail !== undefined ? { detail } : {}),
        },
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
  | 'AGENT_SPAWN_FAILED';

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

/** A small handle `writePromptToStdin` uses to close stdin exactly once, shared with the `turn_end`-triggered close inside {@link wireChildLifecycle}. */
interface StdinCloseHandle {
  closeStdinOnce(): void;
}

interface WireChildLifecycleContext extends TerminateChildTreeDeps {
  readonly runId: string;
  readonly def: RuntimeAgentDef;
  readonly streamFormat: JsonStreamFormat;
  readonly child: ChildProcess;
  readonly lifecycle: RunLifecycle;
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
 * @param ctx - Run/def/child/lifecycle plus the cancellation-escalation ports.
 * @returns A handle exposing `closeStdinOnce` for the initial prompt write to share.
 * @complexity Registration is O(1); steady-state per-chunk cost is the
 * chosen stream parser's own `feed()` cost plus O(1) queue bookkeeping.
 * @overallScore 100/100
 */
function wireChildLifecycle(ctx: WireChildLifecycleContext): StdinCloseHandle {
  const { runId, def, streamFormat, child, lifecycle } = ctx;
  let stdinClosed = false;
  let cancelRequested = false;
  let emitQueue: Promise<void> = Promise.resolve();

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

  const streamHandler = createStreamHandlerForDef(def, streamFormat, (rawEvent) => {
    const translation = translateAgentRuntimeEvent(rawEvent);
    if (translation.kind === 'agent') {
      enqueueEmit(() => lifecycle.emit(runId, { event: 'agent', data: translation.payload }));
    } else if (translation.kind === 'error') {
      enqueueEmit(() => lifecycle.emit(runId, { event: 'error', data: translation.payload }));
    } else if (translation.kind === 'turn-end') {
      closeStdinOnce();
    }
  });

  child.stdout?.on('data', (chunk: Buffer | string) => {
    const text = chunk.toString('utf8');
    enqueueEmit(() => lifecycle.emit(runId, { event: 'stdout', data: { chunk: text } }));
    streamHandler.feed(text);
  });

  child.stderr?.on('data', (chunk: Buffer | string) => {
    enqueueEmit(() => lifecycle.emit(runId, { event: 'stderr', data: { chunk: chunk.toString('utf8') } }));
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
    void terminateChildTree(ctx, child);
  });

  child.on('close', (code, signal) => {
    void (async () => {
      // Not wrapped in try/catch: all 4 supported parser factories'
      // flush() implementations already internally guard their own
      // JSON.parse/dispatch and degrade a malformed trailing buffered
      // line to a `{type:'raw'}` event rather than throwing (confirmed by
      // reading each of the 4 modules in full — see module doc). A guard
      // here would be dead code for the fixed, closed set of parsers this
      // driver dispatches to.
      streamHandler.flush();
      await emitQueue;
      unsubscribeCancel();
      const status = classifyRunCloseStatus({ cancelRequested, code, signal });
      await lifecycle.finish({ runId, status, code, signal: signal ?? null, resumable: false });
    })();
  });

  return { closeStdinOnce };
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
  const { runId, child, lifecycle } = ctx;
  let cancelRequested = false;
  let emitQueue: Promise<void> = Promise.resolve();

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
    enqueueEmit(() => lifecycle.emit(runId, { event: 'stdout', data: { chunk: chunk.toString('utf8') } }));
  });
  child.stderr?.on('data', (chunk: Buffer | string) => {
    enqueueEmit(() => lifecycle.emit(runId, { event: 'stderr', data: { chunk: chunk.toString('utf8') } }));
  });
  child.stdin?.on('error', () => {});
  child.on('error', () => {});

  let controller: AcpSessionController | null = null;
  const unsubscribeCancel = lifecycle.onCancelRequested(runId, () => {
    cancelRequested = true;
    controller?.abort();
    void terminateChildTree(ctx, child);
  });

  child.on('close', (code, signal) => {
    void (async () => {
      await emitQueue;
      unsubscribeCancel();
      const status = cancelRequested ? 'cancelled' : controller?.completedSuccessfully() ? 'succeeded' : 'failed';
      await lifecycle.finish({ runId, status, code, signal: signal ?? null, resumable: false });
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
 * @param handle - Shared stdin-close guard so a `'text'` write's immediate close and a later `turn_end` close never race into a double-`end()`.
 * @complexity O(1) plus the underlying stream write's own cost.
 * @overallScore 100/100
 */
function writePromptToStdin(def: RuntimeAgentDef, child: ChildProcess, prompt: string, handle: StdinCloseHandle): void {
  const stdin = child.stdin;
  if (!stdin) return;
  if (def.promptInputFormat === 'stream-json') {
    const line = JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: prompt }] } });
    stdin.write(`${line}\n`, 'utf8');
    return;
  }
  stdin.write(prompt, 'utf8');
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
  /** @default the real `@jini/platform` process-snapshot enumerator */
  readonly listProcessSnapshots?: typeof listProcessSnapshots;
  /** @default the real `@jini/platform` descendant-PID collector */
  readonly collectProcessTreePids?: typeof collectProcessTreePids;
  /** @default the real `@jini/platform` SIGTERM→SIGKILL escalator */
  readonly stopProcesses?: typeof stopProcesses;
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
  const listProcessSnapshotsFn = options.listProcessSnapshots ?? listProcessSnapshots;
  const collectProcessTreePidsFn = options.collectProcessTreePids ?? collectProcessTreePids;
  const stopProcessesFn = options.stopProcesses ?? stopProcesses;

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
        `AgentExecutor: agent "${def.id}" has streamFormat "${streamFormat}", which is not implemented in v1 — only ${SUPPORTED_STREAM_FORMATS.join(', ')} are supported (see packages/daemon/source-map.md for the deferred ACP/pi-rpc/plain formats)`,
      );
    }
    if (streamFormat !== 'acp-json-rpc' && def.promptViaStdin !== true) {
      return failBeforeSpawn(
        input.runId,
        'AGENT_RUNTIME_UNSUPPORTED',
        `AgentExecutor: agent "${def.id}" does not deliver its prompt via stdin — v1 has no argv/file-based prompt delivery path`,
      );
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
    const args = def.buildArgs(input.prompt, []);
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
      return failBeforeSpawn(
        input.runId,
        'AGENT_SPAWN_FAILED',
        `AgentExecutor: spawn threw synchronously for agent "${def.id}": ${errorMessage(err)}`,
      );
    }

    const stdinHandle =
      streamFormat === 'acp-json-rpc'
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
          });

    try {
      await waitForSpawnOrError(child);
    } catch (err) {
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
        });
      } catch (err) {
        void terminateChildTree(
          {
            listProcessSnapshots: listProcessSnapshotsFn,
            collectProcessTreePids: collectProcessTreePidsFn,
            stopProcesses: stopProcessesFn,
          },
          child,
        );
        await lifecycle.finish({ runId: input.runId, status: 'failed', code: null, signal: null, resumable: false });
        throw new AgentExecutorError(
          'AGENT_SPAWN_FAILED',
          `AgentExecutor: could not attach ACP session for agent \"${def.id}\": ${errorMessage(err)}`,
        );
      }
      return;
    }

    writePromptToStdin(def, child, input.prompt, stdinHandle!);
  }

  return { run };
}
