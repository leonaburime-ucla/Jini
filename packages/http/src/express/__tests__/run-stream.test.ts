import express from 'express';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createInMemoryEventLog, createRunLifecycle } from '@jini/daemon';
import { registerRunStreamRoute } from '../run-stream.js';

/**
 * Real-socket integration test (an actual Express server on an ephemeral port + `fetch()`, no
 * mocking) proving `registerRunStreamRoute`'s thin glue — resolving `req.params.runId` and handing
 * `req`/`res` straight through to the shared `handleRunStreamRequest` — actually produces a working
 * SSE stream over a real HTTP connection, not just against fake req/res objects (see the sibling
 * `src/__tests__/run-stream.test.ts` suite for the fake-req/res-level coverage of the shared
 * handler itself).
 */
let server: Server | undefined;

afterEach(() => {
  server?.close();
  server = undefined;
});

/** Reads from `res`'s SSE body stream until `expectedSubstring` appears (bounded — fails the test via a thrown error rather than hanging forever if it never shows up), then cancels the reader. Guards against the connection's already-replayed 'start' event and the target event landing in separate `read()` calls / chunks. */
async function readSseUntil(res: Response, expectedSubstring: string): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let accumulated = '';
  for (let attempt = 0; attempt < 50; attempt++) {
    const { value, done } = await reader.read();
    if (done) break;
    accumulated += decoder.decode(value, { stream: true });
    if (accumulated.includes(expectedSubstring)) {
      await reader.cancel();
      return accumulated;
    }
  }
  await reader.cancel();
  throw new Error(`expected substring not found within bound: ${expectedSubstring}\ngot: ${accumulated}`);
}

describe('registerRunStreamRoute (Express)', () => {
  it('streams a run\'s AG-UI events over a real SSE connection', async () => {
    const lifecycle = createRunLifecycle({ eventLog: createInMemoryEventLog() });
    const { run } = await lifecycle.start({ contextRef: 'ctx', runId: 'express-run-1' });

    const app = express();
    registerRunStreamRoute(app, { lifecycle });
    server = app.listen(0);
    const port = (server.address() as { port: number }).port;

    const res = await fetch(`http://127.0.0.1:${port}/api/runs/${run.id}/agui-stream`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/event-stream');

    await lifecycle.emit(run.id, { event: 'agent', data: { type: 'text_delta', delta: 'hello from express' } });
    const body = await readSseUntil(res, '"text":"hello from express"');
    expect(body).toContain('"kind":"agent.message"');
  });
});
