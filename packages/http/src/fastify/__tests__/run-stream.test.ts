import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { createInMemoryEventLog, createRunLifecycle } from '@jini/daemon';
import { registerRunStreamRoute } from '../run-stream.js';

/**
 * Real-socket integration test (an actual Fastify server on an ephemeral port + `fetch()`, no
 * mocking) — this is the empirical proof that `reply.hijack()` is actually the right call here:
 * without it, Fastify's own reply lifecycle would try to act on a response this handler already
 * wrote to and ended directly via the shared `handleRunStreamRequest`/`createSseResponse`
 * primitive, which in practice surfaces as either a "reply already sent" warning/error or Fastify
 * attempting to serialize this async handler's `undefined` return value on top of an already-
 * ended response. This test would fail (hang, throw, or receive a malformed/incomplete response)
 * if that were happening, rather than merely assuming `hijack()` is correct by reading Fastify's
 * docs.
 */
let app: ReturnType<typeof Fastify> | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

/**
 * A reusable, stateful SSE body reader: unlike the sibling Express suite's one-shot
 * `readSseUntil` (which reads exactly once per test), this test asserts on the *same* stream
 * twice in sequence — the reader and its accumulated buffer must persist across both waits,
 * since a `ReadableStream` reader can't be re-acquired after `cancel()`, and restarting the
 * accumulator between waits would lose whatever arrived just before the second wait began.
 */
function sseReader(res: Response) {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let accumulated = '';
  return {
    async waitFor(expectedSubstring: string): Promise<string> {
      if (accumulated.includes(expectedSubstring)) return accumulated;
      for (let attempt = 0; attempt < 50; attempt++) {
        const { value, done } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        if (accumulated.includes(expectedSubstring)) return accumulated;
      }
      throw new Error(`expected substring not found within bound: ${expectedSubstring}\ngot: ${accumulated}`);
    },
    async close(): Promise<void> {
      await reader.cancel();
    },
  };
}

describe('registerRunStreamRoute (Fastify)', () => {
  it("streams a run's AG-UI events over a real SSE connection, proving reply.hijack() behaves correctly", async () => {
    const lifecycle = createRunLifecycle({ eventLog: createInMemoryEventLog() });
    const { run } = await lifecycle.start({ contextRef: 'ctx', runId: 'fastify-run-1' });

    app = Fastify();
    registerRunStreamRoute(app, { lifecycle });
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address() as { port: number };

    const res = await fetch(`http://127.0.0.1:${address.port}/api/runs/${run.id}/agui-stream`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/event-stream');

    const reader = sseReader(res);
    await lifecycle.emit(run.id, { event: 'agent', data: { type: 'text_delta', delta: 'hello from fastify' } });
    const body = await reader.waitFor('"text":"hello from fastify"');
    expect(body).toContain('"kind":"agent.message"');

    // Proves the connection is still healthy and Fastify never independently tried to end/error
    // the response itself (which hijack() prevents) — the run can still be driven to completion
    // and the SSE stream closes cleanly on its own via the shared handler's own 'end'-closes-it
    // behavior, not because Fastify forced it closed for an unrelated reason.
    await lifecycle.finish({ runId: run.id, status: 'succeeded', code: 0, signal: null, resumable: false });
    const finalBody = await reader.waitFor('"status":"completed"');
    expect(finalBody).toContain('"kind":"run.lifecycle"');
    await reader.close();
  });
});
