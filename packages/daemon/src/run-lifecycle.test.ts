import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunProtocolEvent } from '@jini/protocol';
import { createInMemoryEventLog } from './event-log.js';
import { createRunLifecycle } from './run-lifecycle.js';

function makeLifecycle(maxEntriesPerRun?: number) {
  const eventLog = createInMemoryEventLog(maxEntriesPerRun !== undefined ? { maxEntriesPerRun } : {});
  return { eventLog, lifecycle: createRunLifecycle({ eventLog }) };
}

describe('RunLifecycle — start', () => {
  it('starts a run in the running state and emits a single start event first', async () => {
    const { lifecycle } = makeLifecycle();
    const { run, started } = await lifecycle.start({ contextRef: 'ctx-1', agentId: 'agent-a' });

    expect(started).toBe(true);
    expect(run.state).toBe('running');

    let delivered: RunProtocolEvent[] = [];
    const result = await lifecycle.stream(run.id, (event) => delivered.push(event));
    expect(result.kind).toBe('ok');
    expect(delivered).toHaveLength(1);
    expect(delivered[0]).toMatchObject({ event: 'start', data: { runId: run.id, agentId: 'agent-a' } });
  });

  it('never keys a run on a product-scoped record identifier — only an opaque contextRef', async () => {
    const { lifecycle } = makeLifecycle();
    const { run } = await lifecycle.start({ contextRef: 'opaque-ref-xyz' });
    const listed = await lifecycle.list('opaque-ref-xyz');
    expect(listed.map((r) => r.id)).toContain(run.id);
  });

  it('a duplicate start with the same idempotencyKey replays the existing run instead of creating a second one', async () => {
    const { lifecycle } = makeLifecycle();
    const first = await lifecycle.start({ contextRef: 'ctx-1', idempotencyKey: 'dup-1' });
    const second = await lifecycle.start({ contextRef: 'ctx-1', idempotencyKey: 'dup-1' });

    expect(second.started).toBe(false);
    expect(second.run.id).toBe(first.run.id);

    const all = await lifecycle.list('ctx-1');
    expect(all).toHaveLength(1);
  });

  it('starts with distinct idempotencyKeys (or none) as separate runs', async () => {
    const { lifecycle } = makeLifecycle();
    const a = await lifecycle.start({ contextRef: 'ctx-1', idempotencyKey: 'k1' });
    const b = await lifecycle.start({ contextRef: 'ctx-1', idempotencyKey: 'k2' });
    expect(a.run.id).not.toBe(b.run.id);
  });
});

describe('RunLifecycle — emit', () => {
  it('appends driver events in call order and fans them out live', async () => {
    const { lifecycle } = makeLifecycle();
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    const delivered: RunProtocolEvent[] = [];
    await lifecycle.stream(run.id, (event) => delivered.push(event));

    await lifecycle.emit(run.id, { event: 'agent', data: { type: 'status', label: 'Thinking' } });
    await lifecycle.emit(run.id, { event: 'agent', data: { type: 'text_delta', delta: 'Hello' } });

    expect(delivered.map((e) => e.event)).toEqual(['start', 'agent', 'agent']);
  });

  it('throws on an unknown runId', async () => {
    const { lifecycle } = makeLifecycle();
    await expect(lifecycle.emit('no-such-run', { event: 'agent', data: { type: 'status', label: 'x' } })).rejects.toThrow(
      /unknown run/,
    );
  });

  it('throws when emitting on an already-terminal run', async () => {
    const { lifecycle } = makeLifecycle();
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });
    await lifecycle.finish({ runId: run.id, status: 'succeeded', code: 0, signal: null, resumable: false });

    await expect(lifecycle.emit(run.id, { event: 'agent', data: { type: 'status', label: 'x' } })).rejects.toThrow(/terminal/);
  });
});

describe('RunLifecycle — finish', () => {
  it('transitions to the terminal state and emits exactly one end event with the mapped status', async () => {
    const { lifecycle, eventLog } = makeLifecycle();
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    const finished = await lifecycle.finish({ runId: run.id, status: 'cancelled', code: null, signal: 'SIGTERM', resumable: false });
    expect(finished.state).toBe('cancelled');

    const replay = await eventLog.replay(run.id, null);
    expect(replay.kind).toBe('ok');
    if (replay.kind === 'ok') {
      const endEntries = replay.entries.filter((e) => e.event === 'end');
      expect(endEntries).toHaveLength(1);
      // RunState uses 'cancelled' (2 L); RunEndPayload.status uses 'canceled'
      // (1 L) — the vocabulary-firewall canary cited in extraction-plan §12
      // C5. Assert the bridge maps correctly rather than silently mismatching.
      expect(endEntries[0]!.data).toMatchObject({ status: 'canceled' });
    }
  });

  it('is idempotent — a second finish() call while already terminal is a no-op, no duplicate end event', async () => {
    const { lifecycle, eventLog } = makeLifecycle();
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    await lifecycle.finish({ runId: run.id, status: 'failed', code: 1, signal: null, resumable: true });
    const secondCallResult = await lifecycle.finish({ runId: run.id, status: 'succeeded', code: 0, signal: null, resumable: false });

    // The second call's *requested* status ('succeeded') must NOT overwrite the first's ('failed').
    expect(secondCallResult.state).toBe('failed');

    const replay = await eventLog.replay(run.id, null);
    expect(replay.kind).toBe('ok');
    if (replay.kind === 'ok') {
      expect(replay.entries.filter((e) => e.event === 'end')).toHaveLength(1);
    }
  });

  it('resolves waitForTerminal()', async () => {
    const { lifecycle } = makeLifecycle();
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    const waiter = lifecycle.waitForTerminal(run.id);
    await lifecycle.finish({ runId: run.id, status: 'succeeded', code: 0, signal: null, resumable: false });
    const status = await waiter;
    expect(status.state).toBe('succeeded');
  });

  it('waitForTerminal() resolves immediately for an already-terminal run', async () => {
    const { lifecycle } = makeLifecycle();
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });
    await lifecycle.finish({ runId: run.id, status: 'succeeded', code: 0, signal: null, resumable: false });
    const status = await lifecycle.waitForTerminal(run.id);
    expect(status.state).toBe('succeeded');
  });
});

describe('RunLifecycle — cancel', () => {
  it('is idempotent — cancelling an already-terminal run is a no-op, not an error', async () => {
    const { lifecycle } = makeLifecycle();
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });
    await lifecycle.finish({ runId: run.id, status: 'succeeded', code: 0, signal: null, resumable: false });

    const status = await lifecycle.cancel({ runId: run.id });
    expect(status.state).toBe('succeeded');
  });

  it('notifies onCancelRequested listeners without itself forcing a terminal transition', async () => {
    const { lifecycle } = makeLifecycle();
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    const listener = vi.fn();
    lifecycle.onCancelRequested(run.id, listener);
    const status = await lifecycle.cancel({ runId: run.id, reason: 'user requested' });

    expect(listener).toHaveBeenCalledWith({ runId: run.id, reason: 'user requested' });
    // The kernel does not own subprocess signaling (extraction-plan task 7,
    // @jini/agent-runtime); it is the driver's job to observe the signal and
    // call finish() once it knows the real outcome.
    expect(status.state).toBe('running');

    const finished = await lifecycle.finish({ runId: run.id, status: 'cancelled', code: null, signal: 'SIGTERM', resumable: false });
    expect(finished.state).toBe('cancelled');
  });

  it('unsubscribe stops further cancel notifications', async () => {
    const { lifecycle } = makeLifecycle();
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    const listener = vi.fn();
    const unsubscribe = lifecycle.onCancelRequested(run.id, listener);
    unsubscribe();
    await lifecycle.cancel({ runId: run.id });

    expect(listener).not.toHaveBeenCalled();
  });

  it('a listener that subscribes AFTER cancel() was already called still learns about it immediately (no missed-cancellation race)', async () => {
    const { lifecycle } = makeLifecycle();
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });

    await lifecycle.cancel({ runId: run.id, reason: 'already gone' });

    const lateListener = vi.fn();
    lifecycle.onCancelRequested(run.id, lateListener);

    expect(lateListener).toHaveBeenCalledWith({ runId: run.id, reason: 'already gone' });
  });
});

describe('RunLifecycle — resume', () => {
  it('is a no-op when the run is not terminal', async () => {
    const { lifecycle } = makeLifecycle();
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });
    const result = await lifecycle.resume(run.id);
    expect(result).toEqual({ run: expect.objectContaining({ state: 'running' }), resumed: false });
  });

  it('is a no-op when the run is terminal but not resumable', async () => {
    const { lifecycle } = makeLifecycle();
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });
    await lifecycle.finish({ runId: run.id, status: 'failed', code: 1, signal: null, resumable: false });

    const result = await lifecycle.resume(run.id);
    expect(result.resumed).toBe(false);
    expect(result.run.state).toBe('failed');
  });

  it('transitions a resumable terminal run back to running without emitting a new protocol event, and the event log cursor sequence continues unbroken', async () => {
    const { lifecycle, eventLog } = makeLifecycle();
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });
    await lifecycle.emit(run.id, { event: 'agent', data: { type: 'status', label: 'working' } });
    await lifecycle.finish({ runId: run.id, status: 'failed', code: 1, signal: null, resumable: true });

    const beforeResumeReplay = await eventLog.replay(run.id, null);
    expect(beforeResumeReplay.kind).toBe('ok');
    const countBefore = beforeResumeReplay.kind === 'ok' ? beforeResumeReplay.entries.length : -1;

    const result = await lifecycle.resume(run.id);
    expect(result.resumed).toBe(true);
    expect(result.run.state).toBe('running');

    const afterResumeReplay = await eventLog.replay(run.id, null);
    expect(afterResumeReplay.kind).toBe('ok');
    if (afterResumeReplay.kind === 'ok') {
      // resume() itself emits nothing — same entry count as before resume.
      expect(afterResumeReplay.entries).toHaveLength(countBefore);
    }

    // Continuing to drive the resumed run appends onto the SAME cursor sequence.
    await lifecycle.emit(run.id, { event: 'agent', data: { type: 'status', label: 'retrying' } });
    const finished = await lifecycle.finish({ runId: run.id, status: 'succeeded', code: 0, signal: null, resumable: false });
    expect(finished.state).toBe('succeeded');

    const finalReplay = await eventLog.replay(run.id, null);
    expect(finalReplay.kind).toBe('ok');
    if (finalReplay.kind === 'ok') {
      const ids = finalReplay.entries.map((e) => Number(e.id));
      expect(ids).toEqual([...ids].sort((a, b) => a - b));
      expect(finalReplay.entries.filter((e) => e.event === 'end')).toHaveLength(2);
    }
  });

  it('waitForTerminal() opens a fresh wait window after resume()', async () => {
    const { lifecycle } = makeLifecycle();
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });
    await lifecycle.finish({ runId: run.id, status: 'failed', code: 1, signal: null, resumable: true });
    await lifecycle.resume(run.id);

    const waiter = lifecycle.waitForTerminal(run.id);
    let resolved = false;
    void waiter.then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(resolved).toBe(false);

    await lifecycle.finish({ runId: run.id, status: 'succeeded', code: 0, signal: null, resumable: false });
    await waiter;
    expect(resolved).toBe(true);
  });
});

describe('RunLifecycle — stream (reconnect)', () => {
  it('replays buffered history then subscribes for live events; unsubscribe stops delivery', async () => {
    const { lifecycle } = makeLifecycle();
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });
    await lifecycle.emit(run.id, { event: 'agent', data: { type: 'status', label: 'a' } });

    const delivered: RunProtocolEvent[] = [];
    const result = await lifecycle.stream(run.id, (e) => delivered.push(e));
    expect(result.kind).toBe('ok');
    expect(delivered.map((e) => e.event)).toEqual(['start', 'agent']);

    await lifecycle.emit(run.id, { event: 'agent', data: { type: 'status', label: 'b' } });
    expect(delivered.map((e) => e.event)).toEqual(['start', 'agent', 'agent']);

    if (result.kind === 'ok') {
      result.unsubscribe();
    }
    await lifecycle.emit(run.id, { event: 'agent', data: { type: 'status', label: 'c' } });
    expect(delivered).toHaveLength(3);
  });

  it('propagates replay-gap from the underlying EventLog', async () => {
    const { lifecycle } = makeLifecycle(2);
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });
    for (let i = 0; i < 5; i += 1) {
      await lifecycle.emit(run.id, { event: 'agent', data: { type: 'status', label: String(i) } });
    }
    const result = await lifecycle.stream(run.id, () => {}, { afterCursor: '1' });
    expect(result.kind).toBe('replay-gap');
  });

  it('returns unknown-run for a runId the lifecycle has never seen', async () => {
    const { lifecycle } = makeLifecycle();
    const result = await lifecycle.stream('never-started', () => {});
    expect(result).toEqual({ kind: 'unknown-run' });
  });

  it('OD-parity: a reconnecting client already caught up on a terminal run still receives one more delivery of the end event', async () => {
    const { lifecycle } = makeLifecycle();
    const { run } = await lifecycle.start({ contextRef: 'ctx-1' });
    await lifecycle.finish({ runId: run.id, status: 'succeeded', code: 0, signal: null, resumable: false });

    const fullReplayDelivered: RunProtocolEvent[] = [];
    await lifecycle.stream(run.id, (e) => fullReplayDelivered.push(e));
    const lastCursor = fullReplayDelivered[fullReplayDelivered.length - 1]!.id;

    // Reconnect with a cursor already at the very last (end) event.
    const delivered: RunProtocolEvent[] = [];
    const result = await lifecycle.stream(run.id, (e) => delivered.push(e), { afterCursor: lastCursor });
    expect(result.kind).toBe('ok');
    expect(delivered).toHaveLength(1);
    expect(delivered[0]).toMatchObject({ event: 'end' });
  });
});

describe('RunLifecycle — inactivity watchdog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('finishes a run as a resumable failure if no emit() occurs within the inactivity timeout', async () => {
    const { lifecycle } = makeLifecycle();
    const { run } = await lifecycle.start({ contextRef: 'ctx-1', inactivityTimeoutMs: 1_000 });

    await vi.advanceTimersByTimeAsync(1_000);

    const status = await lifecycle.get(run.id);
    expect(status?.state).toBe('failed');
    const resumeResult = await lifecycle.resume(run.id);
    expect(resumeResult.resumed).toBe(true);
  });

  it('emit() resets the inactivity window', async () => {
    const { lifecycle } = makeLifecycle();
    const { run } = await lifecycle.start({ contextRef: 'ctx-1', inactivityTimeoutMs: 1_000 });

    await vi.advanceTimersByTimeAsync(700);
    await lifecycle.emit(run.id, { event: 'agent', data: { type: 'status', label: 'still going' } });
    await vi.advanceTimersByTimeAsync(700);

    const status = await lifecycle.get(run.id);
    expect(status?.state).toBe('running');
  });
});
