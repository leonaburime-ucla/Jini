import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInMemoryEventLog, createRunLifecycle, type RunLifecycle } from '@jini/daemon';
import { isLocalSameOrigin } from '../origin-validation.js';
import {
  registerRunEventStream,
  registerRunRoutes,
  runCancelRoute,
  runStartRoute,
  runStatusRoute,
  type RunHttpDeps,
  type RunStartContext,
} from '../runs.js';

vi.mock('../origin-validation.js', () => ({
  isLocalSameOrigin: vi.fn(() => true),
}));

interface MockApp {
  get: (path: string, handler: any) => void;
  post: (path: string, handler: any) => void;
  put: (path: string, handler: any) => void;
  delete: (path: string, handler: any) => void;
  patch: (path: string, handler: any) => void;
  handlers: Record<string, (req: any, res: any) => Promise<void> | void>;
}

function makeApp(): MockApp {
  const handlers: MockApp['handlers'] = {};
  const make = (method: string) => (path: string, handler: any) => {
    handlers[`${method.toUpperCase()} ${path}`] = handler;
  };
  return { get: make('get'), post: make('post'), put: make('put'), delete: make('delete'), patch: make('patch'), handlers };
}

function makeJsonRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

/** Minimal fake of the raw Express req/res surface `registerRunEventStream` uses directly (no Adapter in between). */
function makeSseReq(overrides: { runId?: string; headers?: Record<string, string>; query?: Record<string, unknown> } = {}) {
  const headers = overrides.headers ?? {};
  return {
    params: { runId: overrides.runId ?? 'run-1' },
    query: overrides.query ?? {},
    get: (name: string) => headers[name.toLowerCase()],
  };
}

function makeSseRes() {
  const closeListeners: Array<() => void> = [];
  return {
    write: vi.fn(),
    status: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    end: vi.fn(),
    json: vi.fn().mockReturnThis(),
    headersSent: false,
    on: vi.fn((event: string, listener: () => void) => {
      if (event === 'close') closeListeners.push(listener);
    }),
    emitClose: () => closeListeners.forEach((listener) => listener()),
  };
}

const adapter = { resolvedPortRef: { current: 7456 } };

function makeLifecycle(): RunLifecycle {
  return createRunLifecycle({ eventLog: createInMemoryEventLog() });
}

function makeDeps(overrides: Partial<RunHttpDeps> = {}): RunHttpDeps {
  return { lifecycle: makeLifecycle(), ...overrides };
}

beforeEach(() => {
  vi.mocked(isLocalSameOrigin).mockReturnValue(true);
});

describe('runStartRoute.parse (parseRunCreate)', () => {
  it('rejects a non-object body', () => {
    const result = runStartRoute.parse({ body: 'nope', query: {}, params: {} });
    expect(result).toEqual({ ok: false, error: { code: 'BAD_REQUEST', message: 'body must be a JSON object' } });
  });

  it('rejects a missing contextRef with a structured validation issue', () => {
    const result = runStartRoute.parse({ body: {}, query: {}, params: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.details).toEqual({
        kind: 'validation',
        issues: [{ path: 'contextRef', message: 'required non-empty string' }],
      });
    }
  });

  it('rejects a whitespace-only contextRef the same as a missing one', () => {
    const result = runStartRoute.parse({ body: { contextRef: '   ' }, query: {}, params: {} });
    expect(result.ok).toBe(false);
  });

  it('rejects a non-string contextRef', () => {
    const result = runStartRoute.parse({ body: { contextRef: 42 }, query: {}, params: {} });
    expect(result.ok).toBe(false);
  });

  it('accepts a bare contextRef, omitting agentId/idempotencyKey entirely rather than as undefined', () => {
    const result = runStartRoute.parse({ body: { contextRef: 'ctx-1' }, query: {}, params: {} });
    expect(result).toEqual({ ok: true, value: { contextRef: 'ctx-1' } });
    if (result.ok) {
      expect('agentId' in result.value).toBe(false);
      expect('idempotencyKey' in result.value).toBe(false);
    }
  });

  it('accepts contextRef plus agentId and idempotencyKey when all are provided', () => {
    const result = runStartRoute.parse({
      body: { contextRef: 'ctx-1', agentId: 'agent-a', idempotencyKey: 'key-1' },
      query: {},
      params: {},
    });
    expect(result).toEqual({
      ok: true,
      value: { contextRef: 'ctx-1', agentId: 'agent-a', idempotencyKey: 'key-1' },
    });
  });

  it('rejects an empty-string agentId even though contextRef is valid', () => {
    const result = runStartRoute.parse({ body: { contextRef: 'ctx-1', agentId: '' }, query: {}, params: {} });
    expect(result).toEqual({
      ok: false,
      error: { code: 'BAD_REQUEST', message: 'optional string fields must be non-empty when provided' },
    });
  });

  it('rejects an empty-string idempotencyKey even though contextRef is valid', () => {
    const result = runStartRoute.parse({
      body: { contextRef: 'ctx-1', idempotencyKey: '  ' },
      query: {},
      params: {},
    });
    expect(result.ok).toBe(false);
  });
});

describe('runStatusRoute.parse (parseRunId)', () => {
  it('accepts a non-empty runId path parameter', () => {
    expect(runStatusRoute.parse({ body: {}, query: {}, params: { runId: 'run-1' } })).toEqual({
      ok: true,
      value: 'run-1',
    });
  });

  it('rejects a missing runId path parameter', () => {
    const result = runStatusRoute.parse({ body: {}, query: {}, params: {} });
    expect(result).toEqual({
      ok: false,
      error: { code: 'BAD_REQUEST', message: 'runId must be a non-empty path parameter' },
    });
  });

  it('rejects an empty-string runId path parameter', () => {
    const result = runStatusRoute.parse({ body: {}, query: {}, params: { runId: '' } });
    expect(result.ok).toBe(false);
  });
});

describe('runCancelRoute.parse (parseRunCancel)', () => {
  it('rejects when runId itself is missing (delegates to parseRunId)', () => {
    const result = runCancelRoute.parse({ body: {}, query: {}, params: {} });
    expect(result).toEqual({
      ok: false,
      error: { code: 'BAD_REQUEST', message: 'runId must be a non-empty path parameter' },
    });
  });

  it('accepts a runId with no body at all (undefined)', () => {
    const result = runCancelRoute.parse({ body: undefined, query: {}, params: { runId: 'run-1' } });
    expect(result).toEqual({ ok: true, value: { runId: 'run-1' } });
  });

  it('accepts a runId with an explicit null body', () => {
    const result = runCancelRoute.parse({ body: null, query: {}, params: { runId: 'run-1' } });
    expect(result).toEqual({ ok: true, value: { runId: 'run-1' } });
  });

  it('rejects a non-object body once it is present (not undefined/null)', () => {
    const result = runCancelRoute.parse({ body: 'nope', query: {}, params: { runId: 'run-1' } });
    expect(result).toEqual({
      ok: false,
      error: { code: 'BAD_REQUEST', message: 'body must be a JSON object when provided' },
    });
  });

  it('accepts a runId with a present-but-empty body object, omitting reason entirely rather than as undefined', () => {
    const result = runCancelRoute.parse({ body: {}, query: {}, params: { runId: 'run-1' } });
    expect(result).toEqual({ ok: true, value: { runId: 'run-1' } });
    if (result.ok) expect('reason' in result.value).toBe(false);
  });

  it('rejects an empty-string reason', () => {
    const result = runCancelRoute.parse({ body: { reason: '' }, query: {}, params: { runId: 'run-1' } });
    expect(result).toEqual({
      ok: false,
      error: { code: 'BAD_REQUEST', message: 'reason must be a non-empty string when provided' },
    });
  });

  it('accepts a runId plus a non-empty reason', () => {
    const result = runCancelRoute.parse({
      body: { reason: 'user requested' },
      query: {},
      params: { runId: 'run-1' },
    });
    expect(result).toEqual({ ok: true, value: { runId: 'run-1', reason: 'user requested' } });
  });
});

describe('runStartRoute.handle', () => {
  it('starts a run and returns it with started: true when there is no onStarted driver', async () => {
    const deps = makeDeps();
    const result = await runStartRoute.handle({ contextRef: 'ctx-1' }, deps);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.started).toBe(true);
      expect(result.value.run.state).toBe('running');
    }
  });

  it('falls back to the just-started snapshot when lifecycle.get() unexpectedly returns nothing (defensive ?? fallback)', async () => {
    // Under the real, in-process `RunLifecycle`, `get()` right after `start()` always finds the
    // run — this exercises the `?? started.run` fallback for a `RunLifecycle` implementation
    // (an interface any host may implement, e.g. over an eventually-consistent store) where a
    // read-your-write immediately after `start()` can miss.
    const realLifecycle = makeLifecycle();
    const deps = makeDeps({ lifecycle: { ...realLifecycle, get: vi.fn(async () => undefined) } });
    const result = await runStartRoute.handle({ contextRef: 'ctx-1' }, deps);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.run.state).toBe('running');
      expect(result.value.started).toBe(true);
    }
  });

  it('invokes onStarted with the request, the freshly started run, and the lifecycle', async () => {
    const onStarted = vi.fn(async (_context: RunStartContext) => {});
    const deps = makeDeps({ onStarted });
    const request = { contextRef: 'ctx-1', agentId: 'agent-a' };
    await runStartRoute.handle(request, deps);
    expect(onStarted).toHaveBeenCalledTimes(1);
    const context = onStarted.mock.calls[0]![0];
    expect(context.request).toBe(request);
    expect(context.lifecycle).toBe(deps.lifecycle);
    expect(context.run.state).toBe('running');
  });

  it('does not invoke onStarted when the run was returned via idempotency-key replay (started: false)', async () => {
    const onStarted = vi.fn(async (_context: RunStartContext) => {});
    const deps = makeDeps({ onStarted });
    await deps.lifecycle.start({ contextRef: 'ctx-1', idempotencyKey: 'dedupe-1' });
    onStarted.mockClear();

    const result = await runStartRoute.handle({ contextRef: 'ctx-1', idempotencyKey: 'dedupe-1' }, deps);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.started).toBe(false);
    expect(onStarted).not.toHaveBeenCalled();
  });

  it('returns the lifecycle current view rather than the pre-driver snapshot when onStarted finishes the run itself', async () => {
    const deps = makeDeps({
      onStarted: async (context) => {
        await context.lifecycle.finish({ runId: context.run.id, status: 'succeeded', code: 0, signal: null, resumable: false });
      },
    });
    const result = await runStartRoute.handle({ contextRef: 'ctx-1' }, deps);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.run.state).toBe('succeeded');
    }
  });

  it('fails the run and returns INTERNAL_ERROR when onStarted throws synchronously', async () => {
    const deps = makeDeps({
      onStarted: () => {
        throw new Error('driver spawn failed');
      },
    });
    const result = await runStartRoute.handle({ contextRef: 'ctx-1' }, deps);
    expect(result).toEqual({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'run driver failed to start: driver spawn failed' },
    });
    const runs = await deps.lifecycle.list('ctx-1');
    expect(runs[0]?.state).toBe('failed');
  });

  it('fails the run and returns INTERNAL_ERROR when onStarted returns a rejected promise', async () => {
    const deps = makeDeps({ onStarted: () => Promise.reject(new Error('async spawn failure')) });
    const result = await runStartRoute.handle({ contextRef: 'ctx-1' }, deps);
    expect(result).toEqual({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'run driver failed to start: async spawn failure' },
    });
  });

  it('stringifies a non-Error throw from onStarted', async () => {
    const deps = makeDeps({
      onStarted: () => {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw 'raw string failure';
      },
    });
    const result = await runStartRoute.handle({ contextRef: 'ctx-1' }, deps);
    expect(result).toEqual({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'run driver failed to start: raw string failure' },
    });
  });
});

describe('runStatusRoute.handle', () => {
  it('returns the run when it exists', async () => {
    const deps = makeDeps();
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    const result = await runStatusRoute.handle(run.id, deps);
    expect(result).toEqual({ ok: true, value: { run } });
  });

  it('returns NOT_FOUND when the run does not exist', async () => {
    const deps = makeDeps();
    const result = await runStatusRoute.handle('never-started', deps);
    expect(result).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'run "never-started" was not found' },
    });
  });
});

describe('runCancelRoute.handle', () => {
  it('returns NOT_FOUND when the run does not exist', async () => {
    const deps = makeDeps();
    const result = await runCancelRoute.handle({ runId: 'never-started' }, deps);
    expect(result).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'run "never-started" was not found' },
    });
  });

  it('cancels an existing run and returns its updated status', async () => {
    const deps = makeDeps();
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    const result = await runCancelRoute.handle({ runId: run.id, reason: 'user requested' }, deps);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.run.id).toBe(run.id);
    }
    // cancel() only records intent (state stays non-terminal until the driver observes it and finishes) —
    // assert the call actually reached the lifecycle by checking the cancellation was recorded.
    let observed = false;
    deps.lifecycle.onCancelRequested(run.id, () => {
      observed = true;
    });
    expect(observed).toBe(true);
  });
});

describe('registerRunEventStream', () => {
  function mount(deps: RunHttpDeps) {
    const app = makeApp();
    registerRunEventStream(app as any, deps);
    return app.handlers['GET /api/runs/:runId/events']!;
  }

  it('responds 400 without touching the lifecycle when runId is missing', async () => {
    const deps = makeDeps();
    const streamSpy = vi.spyOn(deps.lifecycle, 'stream');
    const handler = mount(deps);
    const res = makeSseRes();
    await handler(makeSseReq({ runId: '' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'BAD_REQUEST', message: 'runId must be a non-empty path parameter' },
    });
    expect(streamSpy).not.toHaveBeenCalled();
  });

  it('sends 404 NOT_FOUND when the lifecycle reports unknown-run', async () => {
    const deps = makeDeps();
    const handler = mount(deps);
    const res = makeSseRes();
    await handler(makeSseReq({ runId: 'never-started' }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'NOT_FOUND', message: 'run was not found' } });
  });

  it('sends 400 BAD_REQUEST when the lifecycle reports invalid-cursor', async () => {
    const deps = makeDeps();
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    const handler = mount(deps);
    const res = makeSseRes();
    await handler(makeSseReq({ runId: run.id, headers: { 'last-event-id': 'not-a-number' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'BAD_REQUEST', message: 'invalid replay cursor "not-a-number"' },
    });
  });

  it('sends 409 CONFLICT with the oldest-available cursor when the lifecycle reports replay-gap', async () => {
    const eventLog = createInMemoryEventLog({ maxEntriesPerRun: 2 });
    const deps = makeDeps({ lifecycle: createRunLifecycle({ eventLog }) });
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    for (let i = 0; i < 5; i += 1) {
      await deps.lifecycle.emit(run.id, { event: 'agent', data: { type: 'status', label: String(i) } });
    }
    const handler = mount(deps);
    const res = makeSseRes();
    await handler(makeSseReq({ runId: run.id, headers: { 'last-event-id': '1' } }), res);
    expect(res.status).toHaveBeenCalledWith(409);
    const [body] = res.json.mock.calls[0]!;
    expect(body.error.code).toBe('CONFLICT');
    expect(body.error.details).toMatchObject({ oldestAvailableCursor: expect.any(String) });
  });

  it('prefers the Last-Event-ID header over the afterCursor query parameter', async () => {
    const deps = makeDeps();
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    const streamSpy = vi.spyOn(deps.lifecycle, 'stream');
    const handler = mount(deps);
    const res = makeSseRes();
    await handler(
      makeSseReq({ runId: run.id, headers: { 'last-event-id': 'header-cursor' }, query: { afterCursor: 'query-cursor' } }),
      res,
    );
    expect(streamSpy).toHaveBeenCalledWith(run.id, expect.any(Function), { afterCursor: 'header-cursor' });
  });

  it('falls back to the afterCursor query parameter when there is no Last-Event-ID header', async () => {
    const deps = makeDeps();
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    const streamSpy = vi.spyOn(deps.lifecycle, 'stream');
    const handler = mount(deps);
    const res = makeSseRes();
    await handler(makeSseReq({ runId: run.id, query: { afterCursor: 'query-cursor' } }), res);
    expect(streamSpy).toHaveBeenCalledWith(run.id, expect.any(Function), { afterCursor: 'query-cursor' });
  });

  it('uses null afterCursor when neither header nor query parameter is present', async () => {
    const deps = makeDeps();
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    const streamSpy = vi.spyOn(deps.lifecycle, 'stream');
    const handler = mount(deps);
    const res = makeSseRes();
    await handler(makeSseReq({ runId: run.id }), res);
    expect(streamSpy).toHaveBeenCalledWith(run.id, expect.any(Function), { afterCursor: null });
  });

  it('ignores a non-string afterCursor query parameter (e.g. a repeated query key parsed as an array)', async () => {
    const deps = makeDeps();
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    const streamSpy = vi.spyOn(deps.lifecycle, 'stream');
    const handler = mount(deps);
    const res = makeSseRes();
    await handler(makeSseReq({ runId: run.id, query: { afterCursor: ['a', 'b'] } }), res);
    expect(streamSpy).toHaveBeenCalledWith(run.id, expect.any(Function), { afterCursor: null });
  });

  it('writes SSE headers, flushes buffered replay history, and keeps the connection open on a fresh (non-terminal) run', async () => {
    const deps = makeDeps();
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    const handler = mount(deps);
    const res = makeSseRes();
    await handler(makeSseReq({ runId: run.id }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache, no-transform');
    expect(res.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
    expect(res.flushHeaders).toHaveBeenCalledTimes(1);
    // The replayed 'start' event was written as a buffered SSE frame.
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('event: start'));
    expect(res.end).not.toHaveBeenCalled();
    expect(res.on).toHaveBeenCalledWith('close', expect.any(Function));
  });

  it('ends the response immediately without registering a close listener when the buffered replay already contains the terminal end event', async () => {
    const deps = makeDeps();
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    await deps.lifecycle.finish({ runId: run.id, status: 'succeeded', code: 0, signal: null, resumable: false });
    const handler = mount(deps);
    const res = makeSseRes();
    await handler(makeSseReq({ runId: run.id }), res);

    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('event: end'));
    expect(res.end).toHaveBeenCalledTimes(1);
    expect(res.on).not.toHaveBeenCalled();
  });

  it('delivers a live event as it is emitted and closes the stream on a live end event', async () => {
    const deps = makeDeps();
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    const handler = mount(deps);
    const res = makeSseRes();
    await handler(makeSseReq({ runId: run.id }), res);
    res.write.mockClear();

    await deps.lifecycle.emit(run.id, { event: 'agent', data: { type: 'status', label: 'working' } });
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('event: agent'));
    expect(res.end).not.toHaveBeenCalled();

    await deps.lifecycle.finish({ runId: run.id, status: 'succeeded', code: 0, signal: null, resumable: false });
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('event: end'));
    expect(res.end).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes from the lifecycle when the client closes the connection', async () => {
    const deps = makeDeps();
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    const handler = mount(deps);
    const res = makeSseRes();
    await handler(makeSseReq({ runId: run.id }), res);

    res.emitClose();
    res.write.mockClear();
    await deps.lifecycle.emit(run.id, { event: 'agent', data: { type: 'status', label: 'after close' } });
    expect(res.write).not.toHaveBeenCalled();
  });

  it('sends 500 INTERNAL_ERROR when subscribing throws before headers are sent', async () => {
    const deps = makeDeps();
    deps.lifecycle.stream = vi.fn(async () => {
      throw new Error('subscribe blew up');
    });
    const handler = mount(deps);
    const res = makeSseRes();
    await handler(makeSseReq({ runId: 'run-1' }), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'INTERNAL_ERROR', message: 'subscribe blew up' } });
  });

  it('stringifies a non-Error throw from stream() when headers are not yet sent', async () => {
    const deps = makeDeps();
    deps.lifecycle.stream = vi.fn(async () => {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw 'raw stream failure';
    });
    const handler = mount(deps);
    const res = makeSseRes();
    await handler(makeSseReq({ runId: 'run-1' }), res);
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'INTERNAL_ERROR', message: 'raw stream failure' } });
  });

  it('ends the response instead of sending a JSON error when a post-subscribe failure occurs after headers were already sent', async () => {
    // The buffered-replay flush (`for (const event of pending) writeSseEvent(res, event)`) runs
    // strictly after `res.flushHeaders()`, so a `res.write` failure at that point is a realistic
    // stand-in for e.g. a socket error once the stream is already flowing, and lands the catch
    // block's `!res.headersSent` check on its `res.end()` branch instead of `sendApiError`.
    const deps = makeDeps();
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    const handler = mount(deps);
    const res = makeSseRes();
    res.flushHeaders = vi.fn(() => {
      res.headersSent = true;
    });
    res.write = vi.fn(() => {
      throw new Error('socket write failed');
    });
    await handler(makeSseReq({ runId: run.id }), res);
    expect(res.json).not.toHaveBeenCalled();
    expect(res.end).toHaveBeenCalledTimes(1);
  });
});

describe('registerRunRoutes', () => {
  it('mounts exactly the create/status/cancel JSON routes plus the SSE stream, nothing else', () => {
    const app = makeApp();
    registerRunRoutes(app as any, makeDeps(), adapter);
    expect(Object.keys(app.handlers).sort()).toEqual(
      [
        'POST /api/runs',
        'GET /api/runs/:runId',
        'POST /api/runs/:runId/cancel',
        'GET /api/runs/:runId/events',
      ].sort(),
    );
  });

  it('requires same-origin for POST /api/runs: blocks a cross-origin request with 403', async () => {
    vi.mocked(isLocalSameOrigin).mockReturnValue(false);
    const app = makeApp();
    registerRunRoutes(app as any, makeDeps(), adapter);
    const res = makeJsonRes();
    await app.handlers['POST /api/runs']!({ body: { contextRef: 'ctx-1' }, query: {}, params: {} }, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('requires same-origin for POST /api/runs/:runId/cancel: blocks a cross-origin request with 403', async () => {
    vi.mocked(isLocalSameOrigin).mockReturnValue(false);
    const app = makeApp();
    registerRunRoutes(app as any, makeDeps(), adapter);
    const res = makeJsonRes();
    await app.handlers['POST /api/runs/:runId/cancel']!({ body: {}, query: {}, params: { runId: 'run-1' } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('does not require same-origin for GET /api/runs/:runId: allows a cross-origin status read', async () => {
    vi.mocked(isLocalSameOrigin).mockReturnValue(false);
    const app = makeApp();
    const deps = makeDeps();
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    registerRunRoutes(app as any, deps, adapter);
    const res = makeJsonRes();
    await app.handlers['GET /api/runs/:runId']!({ body: {}, query: {}, params: { runId: run.id } }, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('mounted POST /api/runs creates a run end to end through the real Adapter pipeline', async () => {
    const app = makeApp();
    const deps = makeDeps();
    registerRunRoutes(app as any, deps, adapter);
    const res = makeJsonRes();
    await app.handlers['POST /api/runs']!({ body: { contextRef: 'ctx-1' }, query: {}, params: {} }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    const [body] = res.json.mock.calls[0]!;
    expect(body.run.state).toBe('running');
    expect(body.started).toBe(true);
  });
});
