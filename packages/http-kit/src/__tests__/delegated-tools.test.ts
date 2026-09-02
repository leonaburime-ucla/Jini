import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createToolRegistry, ToolInputError, type Principal, type ToolRegistry } from '@jini-ai/core';
import {
  createInMemoryEventLog,
  createRunLifecycle,
  createToolExecutor,
  type RunLifecycle,
  type ToolExecutor,
} from '@jini-ai/daemon';
import { isLocalSameOrigin } from '../origin-validation.js';
import {
  delegatedToolExecuteRoute,
  registerDelegatedToolRoutes,
  type DelegatedToolsHttpDeps,
} from '../delegated-tools.js';

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

const adapter = { resolvedPortRef: { current: 7456 } };
const TEST_PRINCIPAL: Principal = { id: 'test-principal' };

function makeLifecycle(): RunLifecycle {
  return createRunLifecycle({ eventLog: createInMemoryEventLog() });
}

/** A real ToolExecutor + ToolRegistry (not a fake) — one always-allowed echo tool, one always-denied tool. */
function makeToolExecutor(): ToolExecutor {
  const registry = createToolRegistry();
  registry.register({
    descriptor: { id: 'echo' },
    policy: { authorize: () => 'allow' },
    handler: async (ctx) => ({ echoed: ctx.input }),
  });
  registry.register({
    descriptor: { id: 'forbidden' },
    policy: { authorize: () => 'deny' },
    handler: async () => 'never runs',
  });
  return createToolExecutor({ registry });
}

function makeDeps(overrides: Partial<DelegatedToolsHttpDeps> = {}): DelegatedToolsHttpDeps {
  return {
    lifecycle: makeLifecycle(),
    toolExecutor: makeToolExecutor(),
    resolvePrincipal: () => TEST_PRINCIPAL,
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(isLocalSameOrigin).mockReturnValue(true);
});

describe('delegatedToolExecuteRoute.parse (parseDelegatedToolExecute)', () => {
  it('rejects a non-object body', () => {
    const result = delegatedToolExecuteRoute.parse({ body: 'nope', query: {}, params: {} });
    expect(result).toEqual({ ok: false, error: { code: 'BAD_REQUEST', message: 'body must be a JSON object' } });
  });

  it('rejects a missing runId with a structured validation issue', () => {
    const result = delegatedToolExecuteRoute.parse({ body: { toolUseId: 'tu-1', toolId: 't1' }, query: {}, params: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.details).toEqual({ kind: 'validation', issues: [{ path: 'runId', message: 'required non-empty string' }] });
    }
  });

  it('rejects a whitespace-only runId the same as a missing one', () => {
    const result = delegatedToolExecuteRoute.parse({
      body: { runId: '   ', toolUseId: 'tu-1', toolId: 't1' },
      query: {},
      params: {},
    });
    expect(result.ok).toBe(false);
  });

  it('rejects a missing toolUseId', () => {
    const result = delegatedToolExecuteRoute.parse({ body: { runId: 'r1', toolId: 't1' }, query: {}, params: {} });
    expect(result).toEqual({
      ok: false,
      error: { code: 'BAD_REQUEST', message: 'toolUseId must be a non-empty string', details: { kind: 'validation', issues: [{ path: 'toolUseId', message: 'required non-empty string' }] } },
    });
  });

  it('rejects a missing toolId', () => {
    const result = delegatedToolExecuteRoute.parse({ body: { runId: 'r1', toolUseId: 'tu-1' }, query: {}, params: {} });
    expect(result).toEqual({
      ok: false,
      error: { code: 'BAD_REQUEST', message: 'toolId must be a non-empty string', details: { kind: 'validation', issues: [{ path: 'toolId', message: 'required non-empty string' }] } },
    });
  });

  it('accepts a well-formed body without input, passing input through as undefined', () => {
    const result = delegatedToolExecuteRoute.parse({ body: { runId: 'r1', toolUseId: 'tu-1', toolId: 't1' }, query: {}, params: {} });
    expect(result).toEqual({ ok: true, value: { runId: 'r1', toolUseId: 'tu-1', toolId: 't1', input: undefined } });
  });

  it('accepts a well-formed body with an arbitrary JSON input payload', () => {
    const result = delegatedToolExecuteRoute.parse({
      body: { runId: 'r1', toolUseId: 'tu-1', toolId: 't1', input: { city: 'nyc', count: 3 } },
      query: {},
      params: {},
    });
    expect(result).toEqual({ ok: true, value: { runId: 'r1', toolUseId: 'tu-1', toolId: 't1', input: { city: 'nyc', count: 3 } } });
  });
});

describe('delegatedToolExecuteRoute.handle', () => {
  it('returns NOT_FOUND when the run does not exist, without ever calling resolvePrincipal', async () => {
    const resolvePrincipal = vi.fn(() => TEST_PRINCIPAL);
    const deps = makeDeps({ resolvePrincipal });
    const result = await delegatedToolExecuteRoute.handle({ runId: 'never-started', toolUseId: 'tu-1', toolId: 'echo' }, deps);
    expect(result).toEqual({ ok: false, error: { code: 'NOT_FOUND', message: 'run "never-started" was not found' } });
    expect(resolvePrincipal).not.toHaveBeenCalled();
  });

  it('executes an allowed tool end to end through the real ToolExecutor and delegated-tool-bridge, and records tool_use/tool_result run events', async () => {
    const deps = makeDeps();
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    const result = await delegatedToolExecuteRoute.handle(
      { runId: run.id, toolUseId: 'tu-1', toolId: 'echo', input: { city: 'nyc' } },
      deps,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.result).toMatchObject({ status: 'completed', output: { echoed: { city: 'nyc' } } });
    }

    const events: unknown[] = [];
    await deps.lifecycle.stream(run.id, (event) => events.push(event));
    const agentEvents = (events as { kind: string; payload: { type: string } }[]).filter((e) => e.kind === 'agent');
    expect(agentEvents.map((e) => e.payload.type)).toEqual(['tool_use', 'tool_result']);
  });

  it('threads the parsed request into resolvePrincipal and the resolved principal into ToolExecutor.execute', async () => {
    const seenPrincipals: Principal[] = [];
    const registry = createToolRegistry();
    registry.register({
      descriptor: { id: 'echo' },
      policy: {
        authorize: (ctx) => {
          seenPrincipals.push(ctx.principal);
          return 'allow';
        },
      },
      handler: async (ctx) => ctx.input,
    });
    const toolExecutor = createToolExecutor({ registry });
    const scopedPrincipal: Principal = { id: 'scoped-principal', roles: ['runner'] };
    const resolvePrincipal = vi.fn(() => scopedPrincipal);
    const deps = makeDeps({ toolExecutor, resolvePrincipal });
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    await delegatedToolExecuteRoute.handle({ runId: run.id, toolUseId: 'tu-1', toolId: 'echo' }, deps);
    expect(resolvePrincipal).toHaveBeenCalledWith({ runId: run.id, toolUseId: 'tu-1', toolId: 'echo' });
    expect(seenPrincipals).toEqual([scopedPrincipal]);
  });

  it('supports an async resolvePrincipal', async () => {
    const deps = makeDeps({ resolvePrincipal: async () => TEST_PRINCIPAL });
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    const result = await delegatedToolExecuteRoute.handle({ runId: run.id, toolUseId: 'tu-1', toolId: 'echo' }, deps);
    expect(result.ok).toBe(true);
  });

  it('maps a denied ToolExecutionResult to a 403 TOOL_OPERATION_DENIED error, mirroring db-ops.ts', async () => {
    const deps = makeDeps();
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    const result = await delegatedToolExecuteRoute.handle({ runId: run.id, toolUseId: 'tu-1', toolId: 'forbidden' }, deps);
    expect(result).toEqual({
      ok: false,
      error: { code: 'TOOL_OPERATION_DENIED', message: 'this operation was denied by policy' },
    });
  });

  it('maps a confirmation-denied ToolExecutionResult to a 403 TOOL_OPERATION_DENIED error', async () => {
    const registry = createToolRegistry();
    registry.register({
      descriptor: { id: 'confirm-me', requiresConfirmation: true },
      policy: { authorize: () => 'allow' },
      handler: async () => 'should not run',
    });
    const toolExecutor = createToolExecutor({ registry, delegate: { onConfirm: () => 'deny' } });
    const deps = makeDeps({ toolExecutor });
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    const result = await delegatedToolExecuteRoute.handle({ runId: run.id, toolUseId: 'tu-1', toolId: 'confirm-me' }, deps);
    expect(result).toEqual({
      ok: false,
      error: { code: 'TOOL_OPERATION_DENIED', message: 'this operation was denied during confirmation' },
    });
  });

  it('maps a failed ToolExecutionResult to a SEC-005-redacted INTERNAL_ERROR and reports it via onInternalError', async () => {
    const registry = createToolRegistry();
    registry.register({
      descriptor: { id: 'flaky' },
      policy: { authorize: () => 'allow' },
      handler: async () => {
        throw new Error('boom: secret detail');
      },
    });
    const toolExecutor = createToolExecutor({ registry });
    const onInternalError = vi.fn();
    const deps = makeDeps({ toolExecutor, onInternalError });
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    const result = await delegatedToolExecuteRoute.handle({ runId: run.id, toolUseId: 'tu-1', toolId: 'flaky' }, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({ code: 'INTERNAL_ERROR', message: 'an internal error occurred', requestId: expect.any(String) });
    }
    expect(onInternalError).toHaveBeenCalledTimes(1);
    const context = onInternalError.mock.calls[0]![0];
    expect(context.source).toBe('delegated-tool-execute');
    expect(context.error).toBe('boom: secret detail');
  });

  it('maps a failed ToolExecutionResult with errorKind "validation" to a real 400 BAD_REQUEST, not the SEC-005-redacted 500 — this is the theme_list_files "malformed param name" bug fix', async () => {
    const registry = createToolRegistry();
    registry.register({
      descriptor: { id: 'picky' },
      policy: { authorize: () => 'allow' },
      handler: async () => {
        throw new ToolInputError("'themeId' (non-empty string) is required");
      },
    });
    const toolExecutor = createToolExecutor({ registry });
    const onInternalError = vi.fn();
    const deps = makeDeps({ toolExecutor, onInternalError });
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    const result = await delegatedToolExecuteRoute.handle({ runId: run.id, toolUseId: 'tu-1', toolId: 'picky' }, deps);
    expect(result).toEqual({
      ok: false,
      error: { code: 'BAD_REQUEST', message: "'themeId' (non-empty string) is required" },
    });
    // Not redacted, and not reported as an internal error — the caller gets the real message directly.
    expect(onInternalError).not.toHaveBeenCalled();
  });

  it('maps a failed ToolExecutionResult with no errorKind (an internal failure) to the SEC-005-redacted INTERNAL_ERROR, same as a plain Error', async () => {
    const registry = createToolRegistry();
    registry.register({
      descriptor: { id: 'flaky-internal' },
      policy: { authorize: () => 'allow' },
      handler: async () => {
        throw new Error('boom: secret detail');
      },
    });
    const toolExecutor = createToolExecutor({ registry });
    const onInternalError = vi.fn();
    const deps = makeDeps({ toolExecutor, onInternalError });
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    const result = await delegatedToolExecuteRoute.handle({ runId: run.id, toolUseId: 'tu-1', toolId: 'flaky-internal' }, deps);
    expect(result).toEqual({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'an internal error occurred', requestId: expect.any(String) },
    });
    expect(onInternalError).toHaveBeenCalledTimes(1);
    expect(onInternalError.mock.calls[0]![0].error).toBe('boom: secret detail');
  });

  it('maps a timed-out ToolExecutionResult to a SEC-005-redacted INTERNAL_ERROR', async () => {
    const registry = createToolRegistry();
    registry.register({
      descriptor: { id: 'slow', timeoutMs: 10 },
      policy: { authorize: () => 'allow' },
      handler: async (ctx) => {
        await new Promise((resolve, reject) => {
          ctx.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        });
      },
    });
    const toolExecutor = createToolExecutor({ registry });
    const onInternalError = vi.fn();
    const deps = makeDeps({ toolExecutor, onInternalError });
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    const result = await delegatedToolExecuteRoute.handle({ runId: run.id, toolUseId: 'tu-1', toolId: 'slow' }, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INTERNAL_ERROR');
    }
    expect(onInternalError).toHaveBeenCalledTimes(1);
    expect(onInternalError.mock.calls[0]![0].error).toBe('timed-out');
  });

  it('SEC-005: redacts an unregistered toolId (a ToolExecutor routing error) to a generic INTERNAL_ERROR and reports it via onInternalError', async () => {
    const onInternalError = vi.fn();
    const deps = makeDeps({ onInternalError });
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    const result = await delegatedToolExecuteRoute.handle({ runId: run.id, toolUseId: 'tu-1', toolId: 'nope' }, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({ code: 'INTERNAL_ERROR', message: 'an internal error occurred', requestId: expect.any(String) });
    }
    expect(onInternalError).toHaveBeenCalledTimes(1);
    const context = onInternalError.mock.calls[0]![0];
    expect(context.source).toBe('delegated-tool-execute');
    expect(context.runId).toBe(run.id);
    expect(context.toolId).toBe('nope');
    expect(context.error).toBeInstanceOf(Error);
  });

  it('SEC-005: falls back to console.error when no onInternalError sink is supplied', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const deps = makeDeps();
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    const result = await delegatedToolExecuteRoute.handle({ runId: run.id, toolUseId: 'tu-1', toolId: 'nope' }, deps);
    expect(result.ok).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    consoleErrorSpy.mockRestore();
  });

  it('propagates a caller-supplied abort signal through the bridge into ToolExecutor, cancelling a pending confirmation', async () => {
    // No `delegate.onConfirm` at all — `requestConfirmation` parks on an internal deferred (same
    // as `tool-executor.test.ts`'s own "is resumable" tests), which is exactly the unbounded,
    // human-in-the-loop wait a transport disconnect needs to be able to interrupt.
    const registry = createToolRegistry();
    registry.register({
      descriptor: { id: 'needs-confirm', requiresConfirmation: true },
      policy: { authorize: () => 'allow' },
      handler: async () => 'should not run',
    });
    const toolExecutor = createToolExecutor({ registry });
    const deps = makeDeps({ toolExecutor });
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    const controller = new AbortController();

    const resultPromise = delegatedToolExecuteRoute.handle(
      { runId: run.id, toolUseId: 'tu-1', toolId: 'needs-confirm' },
      deps,
      controller.signal,
    );
    // A small macrotask delay rather than a hand-counted number of microtask ticks — the exact hop
    // count through `lifecycle.emit`, the bridge, and `authorizeToolInvocation` is an internal
    // implementation detail of packages this test doesn't own; this just needs to be past all of it
    // and into the parked confirmation before aborting.
    await new Promise((resolve) => setTimeout(resolve, 20));
    controller.abort();

    const result = await resultPromise;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({ code: 'INTERNAL_ERROR', message: 'an internal error occurred', requestId: expect.any(String) });
    }
  });

  it('SEC-005: redacts a thrown resolvePrincipal failure to a generic INTERNAL_ERROR with source resolve-principal', async () => {
    const onInternalError = vi.fn();
    const deps = makeDeps({
      onInternalError,
      resolvePrincipal: () => {
        throw new Error('principal resolution failed: secret detail');
      },
    });
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    const result = await delegatedToolExecuteRoute.handle({ runId: run.id, toolUseId: 'tu-1', toolId: 'echo' }, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({ code: 'INTERNAL_ERROR', message: 'an internal error occurred', requestId: expect.any(String) });
    }
    const context = onInternalError.mock.calls[0]![0];
    expect(context.source).toBe('resolve-principal');
    expect(context.error).toBeInstanceOf(Error);
  });
});

describe('registerDelegatedToolRoutes', () => {
  it('mounts exactly POST /api/delegated-tool-calls', () => {
    const app = makeApp();
    registerDelegatedToolRoutes(app as any, makeDeps(), adapter);
    expect(Object.keys(app.handlers)).toEqual(['POST /api/delegated-tool-calls']);
  });

  it('requires same-origin: blocks a cross-origin request with 403', async () => {
    vi.mocked(isLocalSameOrigin).mockReturnValue(false);
    const app = makeApp();
    registerDelegatedToolRoutes(app as any, makeDeps(), adapter);
    const res = makeJsonRes();
    await app.handlers['POST /api/delegated-tool-calls']!(
      { body: { runId: 'r1', toolUseId: 'tu-1', toolId: 'echo' }, query: {}, params: {} },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('mounted POST /api/delegated-tool-calls executes an allowed tool end to end through the real Adapter pipeline', async () => {
    const app = makeApp();
    const deps = makeDeps();
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    registerDelegatedToolRoutes(app as any, deps, adapter);
    const res = makeJsonRes();
    await app.handlers['POST /api/delegated-tool-calls']!(
      { body: { runId: run.id, toolUseId: 'tu-1', toolId: 'echo', input: 'hi' }, query: {}, params: {} },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    const [body] = res.json.mock.calls[0]!;
    expect(body.result).toMatchObject({ status: 'completed', output: { echoed: 'hi' } });
  });

  it('a real HTTP request close (client disconnect) reaches ToolExecutor and cancels a pending confirmation, end to end through mountJsonRoute', async () => {
    const registry = createToolRegistry();
    registry.register({
      descriptor: { id: 'needs-confirm', requiresConfirmation: true },
      policy: { authorize: () => 'allow' },
      handler: async () => 'should not run',
    });
    const toolExecutor = createToolExecutor({ registry });
    const app = makeApp();
    const deps = makeDeps({ toolExecutor });
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    registerDelegatedToolRoutes(app as any, deps, adapter);
    const req = { body: { runId: run.id, toolUseId: 'tu-1', toolId: 'needs-confirm' }, query: {}, params: {} };
    // Disconnect is observed on `res`, not `req` — see `adapter.ts`'s own comment: a real POST's
    // body is already fully read by the time this handler runs, which fires `req`'s `'close'`
    // immediately (no disconnect at all), so `res`'s `'close'` is the one that's actually safe.
    const listeners = new Set<() => void>();
    const res = {
      ...makeJsonRes(),
      on(event: string, listener: () => void) {
        if (event === 'close') listeners.add(listener);
      },
      off(event: string, listener: () => void) {
        if (event === 'close') listeners.delete(listener);
      },
    };
    const events: { kind: string; payload: { type: string; content?: string; isError?: boolean } }[] = [];
    await deps.lifecycle.stream(run.id, (event) => events.push(event as (typeof events)[number]));

    const handled = app.handlers['POST /api/delegated-tool-calls']!(req, res);

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(listeners.size).toBeGreaterThan(0);
    for (const listener of listeners) listener();

    await handled;
    // The client already disconnected — `mountJsonRoute` deliberately withholds the response
    // rather than writing to a socket nobody is reading from anymore.
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();

    // But the cancellation genuinely reached `ToolExecutor` through the whole chain: the run's own
    // event stream — which the bridge writes to regardless of whether an HTTP response ever goes
    // out — shows the pending confirmation ending as cancelled, not left parked forever.
    const agentEvents = events.filter((e) => e.kind === 'agent');
    expect(agentEvents.map((e) => e.payload.type)).toEqual(['tool_use', 'tool_result']);
    const toolResult = agentEvents[1]!.payload;
    expect(toolResult.content).toBe('Tool execution cancelled.');
    expect(toolResult.isError).toBe(true);
  });

  it('mounted POST /api/delegated-tool-calls responds 404 for an unknown runId through the real Adapter pipeline', async () => {
    const app = makeApp();
    registerDelegatedToolRoutes(app as any, makeDeps(), adapter);
    const res = makeJsonRes();
    await app.handlers['POST /api/delegated-tool-calls']!(
      { body: { runId: 'never-started', toolUseId: 'tu-1', toolId: 'echo' }, query: {}, params: {} },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('delegatedToolExecuteRoute read-only constraint (requireReadOnly)', () => {
  /**
   * A registry carrying the two cases the gate exists to separate: a tool whose registration
   * DECLARES `readOnly: true`, and one that does not. Both are otherwise identical and both would
   * execute happily through the unconstrained gateway — the only thing separating them is the
   * declaration, which is the point.
   */
  function makeReadOnlyStack(): { registry: ToolRegistry; toolExecutor: ToolExecutor; ran: string[] } {
    const ran: string[] = [];
    const registry = createToolRegistry();
    registry.register({
      descriptor: { id: 'reader', readOnly: true },
      policy: { authorize: () => 'allow' },
      handler: async (ctx) => {
        ran.push('reader');
        return { read: ctx.input };
      },
    });
    registry.register({
      descriptor: { id: 'writer' },
      policy: { authorize: () => 'allow' },
      handler: async () => {
        ran.push('writer');
        return 'wrote something durable';
      },
    });
    return { registry, toolExecutor: createToolExecutor({ registry }), ran };
  }

  it('parses requireReadOnly off the body', () => {
    const result = delegatedToolExecuteRoute.parse({
      body: { runId: 'r1', toolUseId: 'tu-1', toolId: 't1', requireReadOnly: true },
      query: {},
      params: {},
    });
    expect(result).toEqual({
      ok: true,
      value: { runId: 'r1', toolUseId: 'tu-1', toolId: 't1', input: undefined, requireReadOnly: true },
    });
  });

  it('leaves requireReadOnly undefined when the body omits it, so the existing gateway is byte-identical', () => {
    const result = delegatedToolExecuteRoute.parse({ body: { runId: 'r1', toolUseId: 'tu-1', toolId: 't1' }, query: {}, params: {} });
    expect(result).toEqual({ ok: true, value: { runId: 'r1', toolUseId: 'tu-1', toolId: 't1', input: undefined } });
  });

  it('refuses a tool that is not declared read-only, with the exact remedy-bearing message, WITHOUT running its handler', async () => {
    const { registry, toolExecutor, ran } = makeReadOnlyStack();
    const deps = makeDeps({ toolExecutor, toolRegistry: registry });
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    const result = await delegatedToolExecuteRoute.handle(
      { runId: run.id, toolUseId: 'tu-1', toolId: 'writer', requireReadOnly: true },
      deps,
    );
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'TOOL_OPERATION_DENIED',
        message:
          'tool "writer" is not registered as read-only — this gateway executes only tools whose registration declares readOnly; call it through execute_delegated_tool instead',
      },
    });
    // The heart of the task: a readOnlyHint:true gateway that let a write through would launder a
    // write past the caller's own safety gate. The handler must never have been reached.
    expect(ran).toEqual([]);
  });

  it('executes a tool whose registration declares readOnly: true', async () => {
    const { registry, toolExecutor, ran } = makeReadOnlyStack();
    const deps = makeDeps({ toolExecutor, toolRegistry: registry });
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    const result = await delegatedToolExecuteRoute.handle(
      { runId: run.id, toolUseId: 'tu-1', toolId: 'reader', input: { q: 1 }, requireReadOnly: true },
      deps,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.result).toMatchObject({ status: 'completed', output: { read: { q: 1 } } });
    }
    expect(ran).toEqual(['reader']);
  });

  it('refuses an unregistered toolId under the constraint rather than falling through to ToolExecutor', async () => {
    const { registry, toolExecutor } = makeReadOnlyStack();
    const onInternalError = vi.fn();
    const deps = makeDeps({ toolExecutor, toolRegistry: registry, onInternalError });
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    const result = await delegatedToolExecuteRoute.handle(
      { runId: run.id, toolUseId: 'tu-1', toolId: 'nope', requireReadOnly: true },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('TOOL_OPERATION_DENIED');
      expect(result.error.message).toContain('"nope" is not registered as read-only');
    }
    expect(onInternalError).not.toHaveBeenCalled();
  });

  it('fails CLOSED when the host mounted the route without a toolRegistry — an unverifiable constraint is refused, never waived', async () => {
    const { toolExecutor, ran } = makeReadOnlyStack();
    const deps = makeDeps({ toolExecutor });
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    const result = await delegatedToolExecuteRoute.handle(
      { runId: run.id, toolUseId: 'tu-1', toolId: 'reader', requireReadOnly: true },
      deps,
    );
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'TOOL_OPERATION_DENIED',
        message:
          'this host cannot verify read-only tools — POST /api/delegated-tool-calls was mounted without DelegatedToolsHttpDeps.toolRegistry, so a requireReadOnly call cannot be checked and is refused',
      },
    });
    expect(ran).toEqual([]);
  });

  it('leaves the unconstrained gateway unchanged: the same write tool still executes when requireReadOnly is absent', async () => {
    const { registry, toolExecutor, ran } = makeReadOnlyStack();
    const deps = makeDeps({ toolExecutor, toolRegistry: registry });
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    const result = await delegatedToolExecuteRoute.handle({ runId: run.id, toolUseId: 'tu-1', toolId: 'writer' }, deps);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.result).toMatchObject({ status: 'completed', output: 'wrote something durable' });
    }
    expect(ran).toEqual(['writer']);
  });

  it('routes a permitted read-only call through the SAME bridge as the unconstrained gateway — identical tool_use/tool_result run events', async () => {
    const { registry, toolExecutor } = makeReadOnlyStack();
    const deps = makeDeps({ toolExecutor, toolRegistry: registry });
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    await delegatedToolExecuteRoute.handle({ runId: run.id, toolUseId: 'tu-1', toolId: 'reader', requireReadOnly: true }, deps);
    const events: unknown[] = [];
    await deps.lifecycle.stream(run.id, (event) => events.push(event));
    const agentEvents = (events as { kind: string; payload: { type: string } }[]).filter((e) => e.kind === 'agent');
    expect(agentEvents.map((e) => e.payload.type)).toEqual(['tool_use', 'tool_result']);
  });

  it('checks the constraint before resolvePrincipal, so a refused call costs nothing downstream', async () => {
    const { registry, toolExecutor } = makeReadOnlyStack();
    const resolvePrincipal = vi.fn(() => TEST_PRINCIPAL);
    const deps = makeDeps({ toolExecutor, toolRegistry: registry, resolvePrincipal });
    const { run } = await deps.lifecycle.start({ contextRef: 'ctx-1' });
    await delegatedToolExecuteRoute.handle({ runId: run.id, toolUseId: 'tu-1', toolId: 'writer', requireReadOnly: true }, deps);
    expect(resolvePrincipal).not.toHaveBeenCalled();
  });
});
