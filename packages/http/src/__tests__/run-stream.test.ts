import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { createInMemoryEventLog, createRunLifecycle, type RunLifecycle, type StreamSubscribeResult } from '@jini/daemon';
import { handleRunStreamRequest } from '../run-stream.js';

function makeReqRes() {
  const req = new EventEmitter();
  const res = { writeHead: vi.fn(), write: vi.fn(), end: vi.fn() };
  return { req, res };
}

function writtenEvents(res: { write: ReturnType<typeof vi.fn> }): unknown[] {
  return res.write.mock.calls
    .map((call: unknown[]) => call[0] as string)
    .filter((chunk: string) => chunk.startsWith('data: '))
    .map((chunk: string) => JSON.parse(chunk.slice('data: '.length, chunk.length - 2)));
}

async function makeRealLifecycle() {
  return createRunLifecycle({ eventLog: createInMemoryEventLog() });
}

describe('handleRunStreamRequest — real RunLifecycle integration', () => {
  it('forwards a text_delta agent event as an encoded agent.message SSE event', async () => {
    const lifecycle = await makeRealLifecycle();
    const { run } = await lifecycle.start({ contextRef: 'ctx-1', runId: 'run-1' });
    const { req, res } = makeReqRes();

    // `handleRunStreamRequest` resolves once subscribed (it does not wait for the run to finish)
    // — awaiting it fully before emitting further events guarantees the subscription is live
    // before this test drives them, rather than racing the two independent async chains.
    await handleRunStreamRequest(req as any, res as any, run.id, { lifecycle });
    await lifecycle.emit(run.id, { event: 'agent', data: { type: 'text_delta', delta: 'hi' } });
    await lifecycle.finish({ runId: run.id, status: 'succeeded', code: 0, signal: null, resumable: false });

    const events = writtenEvents(res);
    expect(events).toContainEqual(expect.objectContaining({ kind: 'agent.message', text: 'hi' }));
  });

  it('closes the SSE connection once the run reaches its terminal end event', async () => {
    const lifecycle = await makeRealLifecycle();
    const { run } = await lifecycle.start({ contextRef: 'ctx-1', runId: 'run-2' });
    const { req, res } = makeReqRes();

    await handleRunStreamRequest(req as any, res as any, run.id, { lifecycle });
    await lifecycle.finish({ runId: run.id, status: 'succeeded', code: 0, signal: null, resumable: false });

    expect(res.end).toHaveBeenCalledTimes(1);
  });

  it('replays a run that was already terminal before the SSE request arrived, then closes', async () => {
    const lifecycle = await makeRealLifecycle();
    const { run } = await lifecycle.start({ contextRef: 'ctx-1', runId: 'run-3' });
    await lifecycle.emit(run.id, { event: 'agent', data: { type: 'text_delta', delta: 'already done' } });
    await lifecycle.finish({ runId: run.id, status: 'succeeded', code: 0, signal: null, resumable: false });

    const { req, res } = makeReqRes();
    await handleRunStreamRequest(req as any, res as any, run.id, { lifecycle });

    const events = writtenEvents(res);
    expect(events).toContainEqual(expect.objectContaining({ kind: 'agent.message', text: 'already done' }));
    expect(events).toContainEqual(expect.objectContaining({ kind: 'run.lifecycle', status: 'completed' }));
    expect(res.end).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes from the run when the client disconnects before the run ends', async () => {
    const lifecycle = await makeRealLifecycle();
    const { run } = await lifecycle.start({ contextRef: 'ctx-1', runId: 'run-4' });
    const { req, res } = makeReqRes();

    await handleRunStreamRequest(req as any, res as any, run.id, { lifecycle });
    (req as EventEmitter).emit('close');

    // If unsubscribe genuinely ran, a subsequent emit() on the same run must not reach `res.write`
    // for a *new* SSE data event, since this connection no longer has an active subscriber.
    const writeCallsBeforeEmit = res.write.mock.calls.length;
    await lifecycle.emit(run.id, { event: 'agent', data: { type: 'text_delta', delta: 'after disconnect' } });
    expect(res.write.mock.calls.length).toBe(writeCallsBeforeEmit);
  });

  it('sends an {error} SSE event and closes when the run is unknown', async () => {
    const lifecycle = await makeRealLifecycle();
    const { req, res } = makeReqRes();

    await handleRunStreamRequest(req as any, res as any, 'nonexistent-run', { lifecycle });

    const events = writtenEvents(res);
    expect(events).toContainEqual({ error: 'unknown-run' });
    expect(res.end).toHaveBeenCalledTimes(1);
  });
});

describe('handleRunStreamRequest — non-ok StreamSubscribeResult kinds', () => {
  it('reports a replay-gap result and closes', async () => {
    const fakeLifecycle = {
      stream: vi.fn(
        async (): Promise<StreamSubscribeResult> => ({ kind: 'replay-gap', requestedCursor: '5', oldestAvailableCursor: '10' }),
      ),
    } as unknown as RunLifecycle;
    const { req, res } = makeReqRes();

    await handleRunStreamRequest(req as any, res as any, 'run-x', { lifecycle: fakeLifecycle });

    expect(writtenEvents(res)).toContainEqual({ error: 'replay-gap' });
    expect(res.end).toHaveBeenCalledTimes(1);
  });

  it('reports an invalid-cursor result and closes', async () => {
    const fakeLifecycle = {
      stream: vi.fn(async (): Promise<StreamSubscribeResult> => ({ kind: 'invalid-cursor', requestedCursor: 'bogus' })),
    } as unknown as RunLifecycle;
    const { req, res } = makeReqRes();

    await handleRunStreamRequest(req as any, res as any, 'run-x', { lifecycle: fakeLifecycle });

    expect(writtenEvents(res)).toContainEqual({ error: 'invalid-cursor' });
    expect(res.end).toHaveBeenCalledTimes(1);
  });
});
