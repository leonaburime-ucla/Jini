/**
 * Regression coverage for the slow-run notice (the wall-clock "still working" signal), separate from
 * the pre-existing crash/inactivity watchdog covered in `run-lifecycle.test.ts`'s own "inactivity
 * watchdog" suite.
 *
 * ## Why this is a distinct file, and why it matters
 *
 * The reported symptom: the admin AI Assistant chat sometimes hangs forever with no error and no
 * recovery, reproduced under heavy concurrent system load. The existing crash watchdog
 * (`armWatchdogIfConfigured`/`handleInactivityTimeout`) only reacts to a spawned process actually
 * *exiting* — it never fires for a process that is alive but so severely scheduling-delayed under CPU
 * contention that it produces no output for a long stretch, because nothing before this change ever
 * measured "no activity" as its own condition independent of "did the child die." It is also, as of
 * this task, dead in production: `packages/http-kit/src/runs.ts`'s `runStartRoute` never forwards an
 * `inactivityTimeoutMs` (its `parseRunCreate` has no such field), so `armWatchdogIfConfigured` is
 * always called with `undefined` on every real HTTP-started run — armed only in tests.
 *
 * A test that kills/exits the child (or, at this layer, calls `finish()`) proves nothing about that
 * bug — see `run-lifecycle.test.ts`'s existing crash-watchdog suite for that different case. Every
 * test below instead simulates exactly "alive but silent": `start()` a run and then simply never call
 * `emit()`/`finish()` for it, the same "no emit() occurred" shape `run-lifecycle.test.ts` already uses
 * to simulate the crash watchdog's own trigger condition, just without ever finishing the run
 * afterward — because the whole point of this feature is that the run must NOT be finished.
 *
 * The emitted payload is `{type: 'slow_running', detail}` — its own `@jini-ai/protocol` `RunAgentPayload`
 * variant, not the pre-existing `'status'` one. See that variant's own doc (`events.ts`) for why: no
 * chat host in this codebase renders `'status'` events today, so reusing it would have shipped a fix
 * invisible to the operator.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunProtocolEvent } from '@jini-ai/protocol';
import { createInMemoryEventLog } from '../event-log.js';
import type { EventLog } from '../event-log.js';
import { createRunLifecycle, DEFAULT_SLOW_RUN_THRESHOLD_MS } from '../run-lifecycle.js';

function makeLifecycle(overrides?: Partial<Omit<Parameters<typeof createRunLifecycle>[0], 'eventLog'>>) {
  const eventLog = createInMemoryEventLog();
  return { eventLog, lifecycle: createRunLifecycle({ eventLog, ...overrides }) };
}

describe('RunLifecycle — slow-run notice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits a "slow_running" agent event after the configured threshold of silence, and leaves the run running', async () => {
    const { lifecycle } = makeLifecycle({ slowRunThresholdMs: 1_000 });
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    const delivered: RunProtocolEvent[] = [];
    await lifecycle.stream(run.id, (event) => delivered.push(event));

    await vi.advanceTimersByTimeAsync(1_000);

    // The critical assertion: the run is NOT terminated. A slow-but-working turn must stay `running`.
    const status = await lifecycle.get(run.id);
    expect(status?.state).toBe('running');
    expect(status).not.toHaveProperty('endedAt');

    // And the UI-visible signal actually went out.
    const agentEvents = delivered.filter((event) => event.kind === 'agent');
    expect(agentEvents).toHaveLength(1);
    expect(agentEvents[0]?.payload).toMatchObject({
      type: 'slow_running',
      detail: expect.stringContaining('taking longer than usual'),
    });
  });

  it('does not fire if activity (emit()) resets the window before the threshold elapses', async () => {
    const { lifecycle } = makeLifecycle({ slowRunThresholdMs: 1_000 });
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    const delivered: RunProtocolEvent[] = [];
    await lifecycle.stream(run.id, (event) => delivered.push(event));

    await vi.advanceTimersByTimeAsync(700);
    await lifecycle.emit(run.id, { event: 'agent', data: { type: 'text_delta', delta: 'still working...' } });
    await vi.advanceTimersByTimeAsync(700);

    // 1400ms of wall-clock time has passed but the window was reset at 700ms, so the 1000ms timer
    // has only been quiet for 700ms at this point — it must not have fired yet.
    const agentEvents = delivered.filter(
      (event) => event.kind === 'agent' && (event.payload as { type?: string }).type === 'slow_running',
    );
    expect(agentEvents).toHaveLength(0);
  });

  it('is disabled entirely when slowRunThresholdMs is explicitly null', async () => {
    const { lifecycle } = makeLifecycle({ slowRunThresholdMs: null });
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    const delivered: RunProtocolEvent[] = [];
    await lifecycle.stream(run.id, (event) => delivered.push(event));

    // Advance well past the default threshold to prove no notice fires with the feature disabled.
    await vi.advanceTimersByTimeAsync(DEFAULT_SLOW_RUN_THRESHOLD_MS * 2);

    const agentEvents = delivered.filter((event) => event.kind === 'agent');
    expect(agentEvents).toHaveLength(0);
    expect((await lifecycle.get(run.id))?.state).toBe('running');
  });

  it('is armed with the kernel-wide default threshold when the host supplies no override at all — the shape every real production caller uses today', async () => {
    // `createRunLifecycle({ eventLog })` with nothing else, exactly as
    // `packages/server/src/kernel-base.ts` calls it — proving this reaches production without any
    // caller change, unlike the crash watchdog's `inactivityTimeoutMs`, which every real caller omits.
    const { lifecycle } = makeLifecycle();
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    const delivered: RunProtocolEvent[] = [];
    await lifecycle.stream(run.id, (event) => delivered.push(event));

    await vi.advanceTimersByTimeAsync(DEFAULT_SLOW_RUN_THRESHOLD_MS);

    const agentEvents = delivered.filter((event) => event.kind === 'agent');
    expect(agentEvents).toHaveLength(1);
    expect(agentEvents[0]?.payload).toMatchObject({ type: 'slow_running' });
    expect((await lifecycle.get(run.id))?.state).toBe('running');
  });

  it('cancels the slow-run watchdog once the run finishes normally, so no stray notice fires afterward', async () => {
    const { lifecycle } = makeLifecycle({ slowRunThresholdMs: 1_000 });
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    const delivered: RunProtocolEvent[] = [];
    await lifecycle.stream(run.id, (event) => delivered.push(event));

    await vi.advanceTimersByTimeAsync(500);
    await lifecycle.finish({ runId: run.id, status: 'succeeded', code: 0, signal: null, resumable: false });

    // Advance well past where the 1000ms threshold would have fired had the watchdog survived.
    await vi.advanceTimersByTimeAsync(5_000);

    const agentEvents = delivered.filter((event) => event.kind === 'agent');
    expect(agentEvents).toHaveLength(0);
  });

  it('contains and reports a failure from the notice\'s own emit() rather than letting it escape as an unhandled rejection', async () => {
    const inner = createInMemoryEventLog();
    const appendError = new Error('event database is closed');
    const eventLog: EventLog = {
      ...inner,
      append: async (appendInput) => {
        const data = appendInput.data as { type?: string } | undefined;
        if (appendInput.event === 'agent' && data?.type === 'slow_running') throw appendError;
        return inner.append(appendInput);
      },
    };
    const onInternalError = vi.fn();
    const lifecycle = createRunLifecycle({ eventLog, onInternalError, slowRunThresholdMs: 1_000 });
    const { run } = await lifecycle.start({ contextRef: 'ctx-slow-notice-error' });

    await vi.advanceTimersByTimeAsync(1_000);

    expect(onInternalError).toHaveBeenCalledWith({
      source: 'slow-run-notice',
      runId: run.id,
      error: appendError,
    });
    // Contained, not fatal to the run: still running, exactly as before the failed notice attempt.
    expect((await lifecycle.get(run.id))?.state).toBe('running');
  });
});
