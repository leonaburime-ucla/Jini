import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInMemoryEventLog, createRunLifecycle, type RunLifecycle } from '@jini/daemon';
import { isLocalSameOrigin } from '../../origin-validation.js';
import { runCancelRoute, runListRoute, runStartRoute, runStatusRoute, type RunHttpDeps } from '../../runs.js';
import { registerRunEventStream, registerRunRoutes } from '../runs.js';

vi.mock('../../origin-validation.js', () => ({
  isLocalSameOrigin: vi.fn(() => true),
}));

beforeEach(() => {
  vi.mocked(isLocalSameOrigin).mockReturnValue(true);
});

interface RouteCall {
  method: string;
  url: string;
  handler: (req: any, reply: any) => Promise<void> | void;
}

function makeApp() {
  const handlers: Record<string, RouteCall['handler']> = {};
  const app = {
    route: (opts: RouteCall) => {
      handlers[`${opts.method} ${opts.url}`] = opts.handler;
    },
  };
  return { app, handlers };
}

function makeReply() {
  return { code: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };
}

const adapter = { resolvedPortRef: { current: 7456 } };

function makeLifecycle(): RunLifecycle {
  return createRunLifecycle({ eventLog: createInMemoryEventLog() });
}

function makeDeps(overrides: Partial<RunHttpDeps> = {}): RunHttpDeps {
  return { lifecycle: makeLifecycle(), ...overrides };
}

describe('fastify runs re-exports', () => {
  it('mounts the exact same run*Route spec objects as the express module (no duplicated route logic)', () => {
    const { app, handlers } = makeApp();
    registerRunRoutes(app as any, makeDeps(), adapter);
    expect(Object.keys(handlers).sort()).toEqual(
      [
        `${runStartRoute.method.toUpperCase()} ${runStartRoute.path}`,
        `${runListRoute.method.toUpperCase()} ${runListRoute.path}`,
        `${runStatusRoute.method.toUpperCase()} ${runStatusRoute.path}`,
        `${runCancelRoute.method.toUpperCase()} ${runCancelRoute.path}`,
        'GET /api/runs/:runId/events',
      ].sort(),
    );
  });
});

describe('registerRunRoutes (fastify) — JSON routes', () => {
  it('serves POST /api/runs, durably starting a real run through the mounted Fastify handler', async () => {
    const { app, handlers } = makeApp();
    const deps = makeDeps();
    registerRunRoutes(app as any, deps, adapter);
    const reply = makeReply();
    await handlers['POST /api/runs']!({ body: { contextRef: 'ctx-1' }, query: {}, params: {} }, reply);
    expect(reply.code).toHaveBeenCalledWith(201);
    const [body] = reply.send.mock.calls[0]!;
    expect(body.run.state).toBe('running');
    expect(body.started).toBe(true);
  });

  it('serves GET /api/runs, listing the run just started through the mounted Fastify handler', async () => {
    const { app, handlers } = makeApp();
    const deps = makeDeps();
    registerRunRoutes(app as any, deps, adapter);
    await deps.lifecycle.start({ contextRef: 'ctx-1' });
    const reply = makeReply();
    await handlers['GET /api/runs']!({ body: {}, query: {}, params: {} }, reply);
    expect(reply.code).toHaveBeenCalledWith(200);
    const [body] = reply.send.mock.calls[0]!;
    expect(body.runs).toHaveLength(1);
  });

  it('serves GET /api/runs/:runId through the mounted Fastify handler', async () => {
    const { app, handlers } = makeApp();
    const deps = makeDeps();
    registerRunRoutes(app as any, deps, adapter);
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    const reply = makeReply();
    await handlers['GET /api/runs/:runId']!({ body: {}, query: {}, params: { runId: run.id } }, reply);
    expect(reply.code).toHaveBeenCalledWith(200);
    const [body] = reply.send.mock.calls[0]!;
    expect(body.run.id).toBe(run.id);
  });

  it('serves POST /api/runs/:runId/cancel through the mounted Fastify handler, actually reaching the lifecycle', async () => {
    const { app, handlers } = makeApp();
    const deps = makeDeps();
    registerRunRoutes(app as any, deps, adapter);
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    const reply = makeReply();
    await handlers['POST /api/runs/:runId/cancel']!({ body: {}, query: {}, params: { runId: run.id } }, reply);
    expect(reply.code).toHaveBeenCalledWith(200);
    const [body] = reply.send.mock.calls[0]!;
    expect(body.run.id).toBe(run.id);
    // cancel() only records intent (state stays non-terminal until a driver observes it) — the
    // real proof this reached the lifecycle is the cancellation callback firing.
    let observed = false;
    deps.lifecycle.onCancelRequested(run.id, () => {
      observed = true;
    });
    expect(observed).toBe(true);
  });
});

/** A minimal fake of `reply.hijack()` + `reply.raw` (a raw `ServerResponse`-shaped object), for exercising `registerRunEventStream`'s own internal header/param-extraction branches directly rather than through a real socket — the transport-level hijack behavior itself is already proven separately by the real-socket tests below. */
function makeHijackedReply() {
  const closeListeners: Array<() => void> = [];
  const raw = {
    write: vi.fn((_chunk: string) => true),
    statusCode: 0,
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    end: vi.fn(),
    headersSent: false,
    writableEnded: false,
    on: vi.fn((event: string, listener: () => void) => {
      if (event === 'close') closeListeners.push(listener);
    }),
  };
  return { hijack: vi.fn(), raw };
}

describe('registerRunEventStream (fastify) — internal header/param extraction branches', () => {
  it('reads a Last-Event-ID header delivered as an array (a real, if unusual, shape for a raw Node request) by taking its first value', async () => {
    const { app, handlers } = makeApp();
    const deps = makeDeps();
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    registerRunEventStream(app as any, deps);
    const reply = makeHijackedReply();
    await handlers['GET /api/runs/:runId/events']!(
      { headers: { 'last-event-id': ['not-a-real-cursor', 'second-value'] }, query: {}, params: { runId: run.id } },
      reply,
    );
    // An invalid cursor error proves the array's first element was actually read and passed to
    // RunLifecycle.stream's afterCursor option, not silently ignored.
    expect(reply.raw.statusCode).toBe(400);
    const [written] = reply.raw.end.mock.calls[0]!;
    expect(JSON.parse(written).error.message).toBe('invalid replay cursor "not-a-real-cursor"');
  });

  it('falls back to an empty runId (never null/undefined) when the Fastify router somehow provides no runId param, and the shared core rejects it with a real 400', async () => {
    const { app, handlers } = makeApp();
    const deps = makeDeps();
    const streamSpy = vi.spyOn(deps.lifecycle, 'stream');
    registerRunEventStream(app as any, deps);
    const reply = makeHijackedReply();
    await handlers['GET /api/runs/:runId/events']!({ headers: {}, query: {}, params: {} }, reply);
    expect(reply.raw.statusCode).toBe(400);
    expect(streamSpy).not.toHaveBeenCalled();
  });
});

/**
 * Real-socket integration tests for the SSE event stream — mirrors `run-stream.test.ts`'s own
 * hijack-proof rationale: `reply.hijack()` behavior (does the raw response actually reach the
 * client intact, does an error path write a real, well-formed HTTP response rather than hanging
 * or double-writing) can only be trusted by observing a real connection, not a mocked reply.
 */
describe('registerRunEventStream (fastify) — real socket', () => {
  let app: ReturnType<typeof Fastify> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('streams real run events over SSE and closes on the terminal end event', async () => {
    const deps = makeDeps();
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });

    app = Fastify();
    registerRunEventStream(app, deps);
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address() as { port: number };

    const res = await fetch(`http://127.0.0.1:${address.port}/api/runs/${run.id}/events`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';
    const waitFor = async (needle: string) => {
      for (let attempt = 0; attempt < 50; attempt++) {
        if (accumulated.includes(needle)) return;
        const { value, done } = await reader.read();
        if (done) return;
        accumulated += decoder.decode(value, { stream: true });
      }
      throw new Error(`expected substring not found: ${needle}\ngot: ${accumulated}`);
    };

    await waitFor('event: start');
    await deps.lifecycle.finish({ runId: run.id, status: 'succeeded', code: 0, signal: null, resumable: false });
    await waitFor('event: end');
    await reader.cancel();
  });

  it('resolves the Last-Event-ID header through the real Fastify request (proven via the invalid-cursor error path, which only fires if the header value actually reached RunLifecycle.stream)', async () => {
    const deps = makeDeps();
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });

    app = Fastify();
    registerRunEventStream(app, deps);
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address() as { port: number };

    const res = await fetch(`http://127.0.0.1:${address.port}/api/runs/${run.id}/events`, {
      headers: { 'last-event-id': 'not-a-real-cursor' },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: { code: 'BAD_REQUEST', message: 'invalid replay cursor "not-a-real-cursor"' } });
  });

  it('falls back to the afterCursor query parameter when there is no Last-Event-ID header, through the real Fastify request', async () => {
    const deps = makeDeps();
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });

    app = Fastify();
    registerRunEventStream(app, deps);
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address() as { port: number };

    const res = await fetch(`http://127.0.0.1:${address.port}/api/runs/${run.id}/events?afterCursor=also-not-real`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: { code: 'BAD_REQUEST', message: 'invalid replay cursor "also-not-real"' } });
  });

  it('reports an unknown run as a real 404 JSON response over the hijacked raw response, not a hang or malformed reply', async () => {
    const deps = makeDeps();

    app = Fastify();
    registerRunEventStream(app, deps);
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address() as { port: number };

    const res = await fetch(`http://127.0.0.1:${address.port}/api/runs/never-started/events`);
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = await res.json();
    expect(body).toEqual({ error: { code: 'NOT_FOUND', message: 'run was not found' } });
  });
});
