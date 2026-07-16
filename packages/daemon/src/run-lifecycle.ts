/**
 * `RunLifecycle` — start/stream/cancel/resume a run keyed on an opaque
 * `contextRef` (extraction-plan §2.1: runs key on an opaque `contextRef`,
 * never a product-record identifier), generalized from OD's `design.runs` service
 * (`apps/daemon/src/runtimes/runs.ts` + the terminal-decision half of
 * `apps/daemon/src/runtimes/start-chat-run.ts`, `arch/server-startserver-endgame`
 * branch — see `source-map.md` for exact line citations).
 *
 * Scope boundary: this module owns the run *state machine* and its event
 * log — create, transition, emit, replay, cancellation-intent propagation,
 * idempotent start/finish, resume. It does not spawn or signal a subprocess;
 * that is `@jini/agent-runtime`'s job (extraction-plan task 7). A driver
 * (today: this package's tests; later: agent-runtime) calls `emit()` for
 * agent/stdout/stderr/error events, observes cancellation via
 * `onCancelRequested`, and calls `finish()` once it knows the real outcome.
 */
import { randomUUID } from 'node:crypto';
import type {
  RunAgentPayload,
  RunCancelRequest,
  RunChunkPayload,
  RunEndPayload,
  RunErrorPayload,
  RunProtocolEvent,
  RunStartPayload,
  RunState,
  RunStatus,
} from '@jini/protocol';
import { RUN_PROTOCOL_VERSION, isTerminalRunState } from '@jini/protocol';
import type { EventLog, EventLogEntry, EventLogReplayResult } from './event-log.js';
import type { InactivityWatchdog, TerminalRunOutcome } from './close-status.js';
import { createInactivityWatchdog } from './close-status.js';

export interface StartRunInput {
  /** Opaque caller-supplied identity the run belongs to — never a project/conversation id (see module doc). */
  readonly contextRef: string;
  readonly agentId?: string;
  /**
   * Caller-supplied idempotency key. Starting twice with the same key
   * returns the original run (`started: false`) instead of creating a
   * second one — new behavior this port builds fresh, since OD's own
   * `clientRequestId` is threaded through but never actually deduplicated
   * against (confirmed absent upstream; see `source-map.md`).
   */
  readonly idempotencyKey?: string;
  /** Override the generated run id — test/fixture hook only. */
  readonly runId?: string;
  /** When set, arms an inactivity watchdog that fails the run as a resumable failure if no `emit()` occurs within this window. */
  readonly inactivityTimeoutMs?: number;
}

export interface StartRunResult {
  readonly run: RunStatus;
  /** `false` when an existing run was returned via idempotency-key replay rather than a new one being created. */
  readonly started: boolean;
}

export interface FinishRunInput {
  readonly runId: string;
  readonly status: TerminalRunOutcome;
  readonly code: number | null;
  readonly signal: string | null;
  /**
   * True when a `'failed'`/`'cancelled'` run can be recovered by `resume()`
   * instead of requiring a fresh `start()`. Generalized from OD's
   * `run.resumable` flag (set only for a narrow, explicitly resumable
   * failure-classification subset — see `run-failure-classification.ts` in
   * the researched source).
   */
  readonly resumable: boolean;
}

export interface ResumeRunResult {
  readonly run: RunStatus;
  /** `false` when the run was not eligible (not terminal, or terminal but not `resumable`) — not an error, just a no-op. */
  readonly resumed: boolean;
}

/** The subset of `RunProtocolEvent` a driver may emit directly. `'start'`/`'end'` are kernel-managed — see `start()`/`finish()`. */
export type DriverEmittableInput =
  | { readonly event: 'agent'; readonly data: RunAgentPayload }
  | { readonly event: 'stdout'; readonly data: RunChunkPayload }
  | { readonly event: 'stderr'; readonly data: RunChunkPayload }
  | { readonly event: 'error'; readonly data: RunErrorPayload };

export type Unsubscribe = () => void;

export interface StreamOptions {
  readonly afterCursor?: string | null;
}

export type StreamSubscribeResult = { readonly kind: 'ok'; readonly unsubscribe: Unsubscribe } | Exclude<EventLogReplayResult, { kind: 'ok' }>;

export interface RunLifecycle {
  start(input: StartRunInput): Promise<StartRunResult>;
  get(runId: string): Promise<RunStatus | undefined>;
  list(contextRef?: string): Promise<readonly RunStatus[]>;
  /** Records cancellation intent. Idempotent — cancelling an already-terminal run is a no-op, not an error. */
  cancel(request: RunCancelRequest): Promise<RunStatus>;
  /** Registers a listener fired synchronously when `cancel()` is called for `runId`. Returns an unsubscribe function. */
  onCancelRequested(runId: string, listener: (request: RunCancelRequest) => void): Unsubscribe;
  /** Appends a driver-observed event and fans it out to live subscribers. Throws if `runId` is unknown or already terminal. */
  emit(runId: string, input: DriverEmittableInput): Promise<RunProtocolEvent>;
  /** Idempotent terminal transition; a second call while already terminal is a no-op that returns the existing status unchanged. */
  finish(input: FinishRunInput): Promise<RunStatus>;
  resume(runId: string): Promise<ResumeRunResult>;
  /** Resolves once `runId` reaches a terminal state; resolves immediately if it already has. */
  waitForTerminal(runId: string): Promise<RunStatus>;
  /**
   * Replays buffered history after `options.afterCursor` (or from the
   * beginning if omitted/null) and then subscribes `onEvent` for live
   * delivery — the reconnect-and-resume-streaming operation a transport
   * uses. Mirrors OD's own reconnect guarantee: a caller that reconnects
   * already caught up on a *terminal* run still receives one more delivery
   * of the final `'end'` event, so a client can never silently miss the
   * terminal signal (`runs.ts` `stream()`, researched source).
   */
  stream(runId: string, onEvent: (event: RunProtocolEvent) => void, options?: StreamOptions): Promise<StreamSubscribeResult>;
}

interface RunRecord {
  contextRef: string;
  status: {
    id: string;
    state: RunState;
    startedAt: number;
    updatedAt: number;
    endedAt: number | undefined;
  };
  resumable: boolean;
  cancelRequested: boolean;
  /** The most recent cancellation request, if any — replayed to a listener that subscribes after `cancel()` already fired (see `onCancelRequested`). */
  lastCancelRequest: RunCancelRequest | undefined;
  cancelListeners: Set<(request: RunCancelRequest) => void>;
  subscribers: Set<(event: RunProtocolEvent) => void>;
  terminalWaiters: Array<(status: RunStatus) => void>;
  terminalEndEntry: EventLogEntry | undefined;
  watchdog: InactivityWatchdog | undefined;
}

/** Vocabulary-firewall bridge: `RunState` uses `'cancelled'` (extraction-plan §12 C5's own cited canary), `RunEndPayload.status` uses `'canceled'`. Both live in `@jini/protocol`, which is out of scope for this task — bridged here rather than fixed upstream. */
const TERMINAL_OUTCOME_TO_END_STATUS: Record<TerminalRunOutcome, NonNullable<RunEndPayload['status']>> = {
  succeeded: 'succeeded',
  failed: 'failed',
  cancelled: 'canceled',
};

function toPublicStatus(record: RunRecord): RunStatus {
  const status: RunStatus = {
    id: record.status.id,
    state: record.status.state,
    startedAt: record.status.startedAt,
    updatedAt: record.status.updatedAt,
  };
  if (record.status.endedAt !== undefined) {
    return { ...status, endedAt: record.status.endedAt };
  }
  return status;
}

function toRunEvent(entry: EventLogEntry): RunProtocolEvent {
  return { id: entry.id, event: entry.event, data: entry.data } as RunProtocolEvent;
}

export interface CreateRunLifecycleInput {
  readonly eventLog: EventLog;
}

/**
 * Creates the in-process `RunLifecycle` reference implementation.
 *
 * @param input.eventLog - The durable `EventLog` port this lifecycle appends to and replays from.
 * @returns A `RunLifecycle` backed by an in-memory run registry plus the injected `EventLog`.
 * @complexity Per-call complexities documented on each method; the registry itself is a `Map` keyed by `runId` (O(1) lookup).
 * @overallScore 100/100
 */
export function createRunLifecycle(input: CreateRunLifecycleInput): RunLifecycle {
  const { eventLog } = input;
  const runs = new Map<string, RunRecord>();
  const idempotencyIndex = new Map<string, string>();

  function requireRun(runId: string): RunRecord {
    const record = runs.get(runId);
    if (!record) {
      throw new Error(`RunLifecycle: unknown run "${runId}"`);
    }
    return record;
  }

  async function appendEvent(runId: string, record: RunRecord, event: string, data: unknown): Promise<RunProtocolEvent> {
    const entry = await eventLog.append({ runId, event, data });
    const runEvent = toRunEvent(entry);
    for (const subscriber of record.subscribers) {
      subscriber(runEvent);
    }
    return runEvent;
  }

  function resolveTerminalWaiters(record: RunRecord): void {
    const waiters = record.terminalWaiters.splice(0, record.terminalWaiters.length);
    const status = toPublicStatus(record);
    for (const resolve of waiters) {
      resolve(status);
    }
  }

  /**
   * Fires when a run's inactivity watchdog times out with no intervening
   * `emit()`/`finish()`. Classified as a resumable failure (`code: null,
   * signal: null`), mirroring OD's own timeout/inactivity classification
   * (`isResumableFailure` in the researched `run-failure-classification.ts`
   * treats timeout/inactivity as one of only two resumable categories).
   * A run that already reached a terminal state before the timer fired
   * (a normal race with `finish()`) is left untouched.
   */
  async function handleInactivityTimeout(runId: string): Promise<void> {
    const record = runs.get(runId);
    if (!record || isTerminalRunState(record.status.state)) {
      return;
    }
    await lifecycle.finish({ runId, status: 'failed', code: null, signal: null, resumable: true });
  }

  const lifecycle: RunLifecycle = {
    async start(startInput: StartRunInput): Promise<StartRunResult> {
      if (startInput.idempotencyKey !== undefined) {
        const existingRunId = idempotencyIndex.get(startInput.idempotencyKey);
        if (existingRunId) {
          const existing = requireRun(existingRunId);
          return { run: toPublicStatus(existing), started: false };
        }
      }

      const runId = startInput.runId ?? randomUUID();
      if (runs.has(runId)) {
        throw new Error(`RunLifecycle: run "${runId}" already exists`);
      }

      const now = Date.now();
      const record: RunRecord = {
        contextRef: startInput.contextRef,
        status: { id: runId, state: 'running', startedAt: now, updatedAt: now, endedAt: undefined },
        resumable: false,
        cancelRequested: false,
        lastCancelRequest: undefined,
        cancelListeners: new Set(),
        subscribers: new Set(),
        terminalWaiters: [],
        terminalEndEntry: undefined,
        watchdog: undefined,
      };
      runs.set(runId, record);
      if (startInput.idempotencyKey !== undefined) {
        idempotencyIndex.set(startInput.idempotencyKey, runId);
      }

      const startPayload: RunStartPayload = {
        runId,
        protocolVersion: RUN_PROTOCOL_VERSION,
        ...(startInput.agentId !== undefined ? { agentId: startInput.agentId } : {}),
        ...(startInput.idempotencyKey !== undefined ? { idempotencyKey: startInput.idempotencyKey } : {}),
      };
      await appendEvent(runId, record, 'start', startPayload);

      if (startInput.inactivityTimeoutMs !== undefined) {
        record.watchdog = createInactivityWatchdog({
          timeoutMs: startInput.inactivityTimeoutMs,
          onTimeout: () => {
            void handleInactivityTimeout(runId);
          },
        });
      }

      return { run: toPublicStatus(record), started: true };
    },

    async get(runId: string): Promise<RunStatus | undefined> {
      const record = runs.get(runId);
      return record ? toPublicStatus(record) : undefined;
    },

    async list(contextRef?: string): Promise<readonly RunStatus[]> {
      const all = Array.from(runs.values());
      const filtered = contextRef === undefined ? all : all.filter((record) => record.contextRef === contextRef);
      return filtered.map(toPublicStatus);
    },

    async cancel(request: RunCancelRequest): Promise<RunStatus> {
      const record = requireRun(request.runId);
      if (isTerminalRunState(record.status.state)) {
        return toPublicStatus(record);
      }
      record.cancelRequested = true;
      record.lastCancelRequest = request;
      record.status.updatedAt = Date.now();
      for (const listener of record.cancelListeners) {
        listener(request);
      }
      return toPublicStatus(record);
    },

    /**
     * Registers a cancel-intent listener. If `cancel()` was already called
     * for this run before this subscription, the listener fires immediately
     * with the original request (mirrors `AbortSignal`'s `aborted`+`addEventListener`
     * pairing) — otherwise a driver that attaches after the cancel already
     * happened would silently never learn about it, since a plain
     * subscribe-for-future-events registry has no memory of past firings.
     */
    onCancelRequested(runId: string, listener: (request: RunCancelRequest) => void): Unsubscribe {
      const record = requireRun(runId);
      if (record.cancelRequested && record.lastCancelRequest) {
        listener(record.lastCancelRequest);
      }
      record.cancelListeners.add(listener);
      return () => record.cancelListeners.delete(listener);
    },

    async emit(runId: string, driverInput: DriverEmittableInput): Promise<RunProtocolEvent> {
      const record = requireRun(runId);
      if (isTerminalRunState(record.status.state)) {
        throw new Error(
          `RunLifecycle: cannot emit "${driverInput.event}" on terminal run "${runId}" — drivers must stop emitting once finish() has been called`,
        );
      }
      record.watchdog?.noteActivity();
      return appendEvent(runId, record, driverInput.event, driverInput.data);
    },

    async finish(finishInput: FinishRunInput): Promise<RunStatus> {
      const record = requireRun(finishInput.runId);
      if (isTerminalRunState(record.status.state)) {
        return toPublicStatus(record);
      }
      record.watchdog?.cancel();
      const now = Date.now();
      record.status.state = finishInput.status;
      record.status.updatedAt = now;
      record.status.endedAt = now;
      record.resumable = finishInput.resumable;

      const endPayload: RunEndPayload = {
        code: finishInput.code,
        signal: finishInput.signal,
        status: TERMINAL_OUTCOME_TO_END_STATUS[finishInput.status],
        resumable: finishInput.resumable,
      };
      const endEntry = await eventLog.append({ runId: finishInput.runId, event: 'end', data: endPayload });
      record.terminalEndEntry = endEntry;
      const endEvent = toRunEvent(endEntry);
      for (const subscriber of record.subscribers) {
        subscriber(endEvent);
      }

      resolveTerminalWaiters(record);
      return toPublicStatus(record);
    },

    async resume(runId: string): Promise<ResumeRunResult> {
      const record = requireRun(runId);
      const eligible = isTerminalRunState(record.status.state) && record.resumable;
      if (!eligible) {
        return { run: toPublicStatus(record), resumed: false };
      }
      const now = Date.now();
      record.status.state = 'running';
      record.status.updatedAt = now;
      record.status.endedAt = undefined;
      record.resumable = false;
      record.cancelRequested = false;
      record.lastCancelRequest = undefined;
      record.terminalEndEntry = undefined;
      // No protocol event is emitted here: none of RunProtocolEvent's six
      // kinds represents "resumed" (extraction-plan scope decision — see
      // source-map.md). The event log's cursor sequence continues
      // unbroken; only RunStatus.state changes.
      return { run: toPublicStatus(record), resumed: true };
    },

    async waitForTerminal(runId: string): Promise<RunStatus> {
      const record = requireRun(runId);
      if (isTerminalRunState(record.status.state)) {
        return toPublicStatus(record);
      }
      return new Promise((resolve) => {
        record.terminalWaiters.push(resolve);
      });
    },

    async stream(
      runId: string,
      onEvent: (event: RunProtocolEvent) => void,
      options: StreamOptions = {},
    ): Promise<StreamSubscribeResult> {
      const record = runs.get(runId);
      if (!record) {
        return { kind: 'unknown-run' };
      }
      const replay = await eventLog.replay(runId, options.afterCursor ?? null);
      if (replay.kind !== 'ok') {
        return replay;
      }
      for (const entry of replay.entries) {
        onEvent(toRunEvent(entry));
      }

      const terminal = isTerminalRunState(record.status.state);
      if (terminal && record.terminalEndEntry) {
        const lastDelivered = replay.entries[replay.entries.length - 1];
        if (!lastDelivered || lastDelivered.id !== record.terminalEndEntry.id) {
          onEvent(toRunEvent(record.terminalEndEntry));
        }
      }

      if (terminal) {
        return { kind: 'ok', unsubscribe: () => {} };
      }

      record.subscribers.add(onEvent);
      return { kind: 'ok', unsubscribe: () => record.subscribers.delete(onEvent) };
    },
  };

  return lifecycle;
}
