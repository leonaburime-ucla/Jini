import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createToolRegistry, type Principal, type ToolPolicy, type ToolRegistry } from '@jini/core';
import { createToolExecutor, type ToolExecutor } from '@jini/daemon';
import { isLocalSameOrigin } from '../origin-validation.js';
import {
  createDaemonDbToolRegistrations,
  daemonDbInspectRoute,
  daemonDbVacuumRoute,
  daemonDbVerifyRoute,
  DB_INSPECT_TOOL_ID,
  DB_VACUUM_TOOL_ID,
  DB_VERIFY_TOOL_ID,
  denyAllDaemonDbPolicy,
  registerDaemonDbRoutes,
  type DaemonDbHttpDeps,
  type DaemonDbOperations,
} from '../db-ops.js';

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

function makeRes() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
}

const adapter = { resolvedPortRef: { current: 7456 } };
const principal: Principal = { id: 'local-daemon-operator' };

const inspectReport = {
  kind: 'sqlite' as const,
  location: '/data/app.sqlite',
  sizeBytes: 4096,
  schemaVersion: 3,
  tables: [{ name: 'runs', rowCount: 12 }],
  generatedAt: 1000,
};

const verifyReportClean = {
  ok: true,
  mode: 'integrity_check' as const,
  issues: [],
  elapsedMs: 5,
  generatedAt: 1000,
};

const vacuumResult = { ok: true as const, beforeBytes: 4096, afterBytes: 2048, reclaimedBytes: 2048, elapsedMs: 12 };

function makeOperations(overrides: Partial<DaemonDbOperations> = {}): DaemonDbOperations {
  return {
    inspect: vi.fn(async () => inspectReport),
    verify: vi.fn(async (_quick: boolean) => verifyReportClean),
    vacuum: vi.fn(async () => vacuumResult),
    ...overrides,
  };
}

/** Builds a real ToolExecutor with the three DB tools registered under `policy`. */
function makeExecutor(
  operations: DaemonDbOperations,
  policy: ToolPolicy = { authorize: () => 'allow' },
): { executor: ToolExecutor; registry: ToolRegistry } {
  const registry = createToolRegistry();
  const registrations = createDaemonDbToolRegistrations({ operations, policy });
  registry.register(registrations.inspect);
  registry.register(registrations.verify);
  registry.register(registrations.vacuum);
  return { executor: createToolExecutor({ registry }), registry };
}

function makeDeps(overrides: Partial<DaemonDbHttpDeps> & { operations?: DaemonDbOperations; policy?: ToolPolicy } = {}): {
  deps: DaemonDbHttpDeps;
  operations: DaemonDbOperations;
} {
  const operations = overrides.operations ?? makeOperations();
  const { executor } = overrides.toolExecutor
    ? { executor: overrides.toolExecutor }
    : makeExecutor(operations, overrides.policy);
  return {
    deps: { toolExecutor: executor, principal, ...overrides },
    operations,
  };
}

beforeEach(() => {
  vi.mocked(isLocalSameOrigin).mockReturnValue(true);
});

describe('createDaemonDbToolRegistrations', () => {
  it('registers exactly the three documented tool ids', () => {
    const regs = createDaemonDbToolRegistrations({ operations: makeOperations() });
    expect(regs.inspect.descriptor.id).toBe(DB_INSPECT_TOOL_ID);
    expect(regs.verify.descriptor.id).toBe(DB_VERIFY_TOOL_ID);
    expect(regs.vacuum.descriptor.id).toBe(DB_VACUUM_TOOL_ID);
  });

  it('defaults every tool to denyAllDaemonDbPolicy', () => {
    const regs = createDaemonDbToolRegistrations({ operations: makeOperations() });
    expect(regs.inspect.policy).toBe(denyAllDaemonDbPolicy);
    expect(regs.verify.policy).toBe(denyAllDaemonDbPolicy);
    expect(regs.vacuum.policy).toBe(denyAllDaemonDbPolicy);
  });

  it('denyAllDaemonDbPolicy denies regardless of principal', () => {
    expect(
      denyAllDaemonDbPolicy.authorize({
        principal: { id: 'anyone', roles: ['admin'] },
        run: { id: 'r1' },
        tool: { id: DB_INSPECT_TOOL_ID },
        input: undefined,
      }),
    ).toBe('deny');
  });

  it('a caller-supplied policy overrides the default for all three tools', () => {
    const policy: ToolPolicy = { authorize: () => 'allow' };
    const regs = createDaemonDbToolRegistrations({ operations: makeOperations(), policy });
    expect(regs.inspect.policy).toBe(policy);
    expect(regs.verify.policy).toBe(policy);
    expect(regs.vacuum.policy).toBe(policy);
  });

  it('forwards requiresConfirmation/timeoutMs onto every descriptor', () => {
    const regs = createDaemonDbToolRegistrations({
      operations: makeOperations(),
      requiresConfirmation: true,
      timeoutMs: 5000,
    });
    expect(regs.inspect.descriptor.requiresConfirmation).toBe(true);
    expect(regs.verify.descriptor.timeoutMs).toBe(5000);
    expect(regs.vacuum.descriptor.requiresConfirmation).toBe(true);
  });

  it('the verify handler defaults quick to false when input is not a record', async () => {
    const operations = makeOperations();
    const regs = createDaemonDbToolRegistrations({ operations });
    await regs.verify.handler({ executionId: 'e1', principal, run: { id: 'r1' }, input: undefined, signal: new AbortController().signal });
    expect(operations.verify).toHaveBeenCalledWith(false);
  });

  it('the verify handler passes quick: true through from the input record', async () => {
    const operations = makeOperations();
    const regs = createDaemonDbToolRegistrations({ operations });
    await regs.verify.handler({ executionId: 'e1', principal, run: { id: 'r1' }, input: { quick: true }, signal: new AbortController().signal });
    expect(operations.verify).toHaveBeenCalledWith(true);
  });

  it('the inspect/vacuum handlers call their operation with no arguments', async () => {
    const operations = makeOperations();
    const regs = createDaemonDbToolRegistrations({ operations });
    await regs.inspect.handler({ executionId: 'e1', principal, run: { id: 'r1' }, input: undefined, signal: new AbortController().signal });
    await regs.vacuum.handler({ executionId: 'e2', principal, run: { id: 'r1' }, input: undefined, signal: new AbortController().signal });
    expect(operations.inspect).toHaveBeenCalledWith();
    expect(operations.vacuum).toHaveBeenCalledWith();
  });
});

describe('daemonDbInspectRoute', () => {
  it('success: returns the inspect report when the policy allows', async () => {
    const { deps, operations } = makeDeps();
    const result = await daemonDbInspectRoute.handle(undefined, deps);
    expect(result).toEqual({ ok: true, value: inspectReport });
    expect(operations.inspect).toHaveBeenCalledTimes(1);
  });

  it('auth-denial: the ToolExecutor gate denies by default, the underlying operation is never invoked, and the route returns 403', async () => {
    // This is the load-bearing proof that the gate is actually in the call path, not
    // bypassable: `makeDeps()` with no explicit policy wires the real `denyAllDaemonDbPolicy`
    // default through a REAL ToolExecutor/ToolRegistry (no route-level mock), and asserts the
    // injected operation itself was never called.
    const { deps, operations } = makeDeps({ policy: undefined });
    const result = await daemonDbInspectRoute.handle(undefined, deps);
    expect(result).toEqual({
      ok: false,
      error: { code: 'TOOL_OPERATION_DENIED', message: 'this operation was denied by policy' },
    });
    expect(operations.inspect).not.toHaveBeenCalled();
  });

  it('a failed tool execution redacts the real error and reports a correlation id (SEC-005), while invoking onInternalError with the real error', async () => {
    const boom = new Error('disk read failed at /secret/data/app.sqlite');
    const operations = makeOperations({ inspect: vi.fn(async () => { throw boom; }) });
    const onInternalError = vi.fn();
    const { deps } = makeDeps({ operations, onInternalError });
    const result = await daemonDbInspectRoute.handle(undefined, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INTERNAL_ERROR');
      expect(result.error.message).toBe('an internal error occurred');
      expect(JSON.stringify(result.error)).not.toContain('/secret/data/app.sqlite');
      expect(result.error.requestId).toEqual(expect.any(String));
    }
    expect(onInternalError).toHaveBeenCalledTimes(1);
    const [context] = onInternalError.mock.calls[0]!;
    expect(context.source).toBe('db-inspect');
    expect(context.error).toBe(boom);
  });

  it('logs to console.error by default when onInternalError is omitted', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const operations = makeOperations({ inspect: vi.fn(async () => { throw new Error('boom'); }) });
    const { deps } = makeDeps({ operations });
    await daemonDbInspectRoute.handle(undefined, deps);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('reports a denied confirmation the same as a policy denial', async () => {
    const registry = createToolRegistry();
    const operations = makeOperations();
    const regs = createDaemonDbToolRegistrations({
      operations,
      policy: { authorize: () => 'allow' },
      requiresConfirmation: true,
    });
    registry.register(regs.inspect);
    registry.register(regs.verify);
    registry.register(regs.vacuum);
    const executor = createToolExecutor({ registry, delegate: { onConfirm: () => 'deny' } });
    const deps: DaemonDbHttpDeps = { toolExecutor: executor, principal };
    const result = await daemonDbInspectRoute.handle(undefined, deps);
    expect(result).toEqual({
      ok: false,
      error: { code: 'TOOL_OPERATION_DENIED', message: 'this operation was denied during confirmation' },
    });
    expect(operations.inspect).not.toHaveBeenCalled();
  });

  it('reports a timeout as a redacted INTERNAL_ERROR', async () => {
    const registry = createToolRegistry();
    const regs = createDaemonDbToolRegistrations({
      operations: makeOperations({
        inspect: () => new Promise(() => {}), // never resolves
      }),
      policy: { authorize: () => 'allow' },
      timeoutMs: 1,
    });
    registry.register(regs.inspect);
    registry.register(regs.verify);
    registry.register(regs.vacuum);
    const executor = createToolExecutor({ registry });
    const deps: DaemonDbHttpDeps = { toolExecutor: executor, principal };
    const result = await daemonDbInspectRoute.handle(undefined, deps);
    expect(result).toEqual({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'an internal error occurred', requestId: expect.any(String) },
    });
  });
});

describe('daemonDbVerifyRoute.parse', () => {
  it('malformed input: rejects a non-string quick query value (e.g. a repeated query param becomes an array)', () => {
    const result = daemonDbVerifyRoute.parse({ body: {}, query: { quick: ['1', '2'] }, params: {} });
    expect(result).toEqual({
      ok: false,
      error: { code: 'BAD_REQUEST', message: 'quick must be a single query-string value when provided' },
    });
  });

  it('defaults to quick: false when the query parameter is absent', () => {
    expect(daemonDbVerifyRoute.parse({ body: {}, query: {}, params: {} })).toEqual({ ok: true, value: { quick: false } });
  });

  it.each([
    ['1', true],
    ['true', true],
    ['TRUE', true],
    ['0', false],
    ['false', false],
    ['garbage', false],
  ])('parses quick=%s as %s', (raw, expected) => {
    const result = daemonDbVerifyRoute.parse({ body: {}, query: { quick: raw }, params: {} });
    expect(result).toEqual({ ok: true, value: { quick: expected } });
  });
});

describe('daemonDbVerifyRoute.handle', () => {
  it('success: forwards quick through the executor to the operation', async () => {
    const { deps, operations } = makeDeps();
    const result = await daemonDbVerifyRoute.handle({ quick: true }, deps);
    expect(result).toEqual({ ok: true, value: verifyReportClean });
    expect(operations.verify).toHaveBeenCalledWith(true);
  });

  it('auth-denial: denies by default and never calls verify()', async () => {
    const { deps, operations } = makeDeps({ policy: undefined });
    const result = await daemonDbVerifyRoute.handle({ quick: false }, deps);
    expect(result.ok).toBe(false);
    expect(operations.verify).not.toHaveBeenCalled();
  });
});

describe('daemonDbVacuumRoute.handle', () => {
  it('success: returns the vacuum result', async () => {
    const { deps, operations } = makeDeps();
    const result = await daemonDbVacuumRoute.handle(undefined, deps);
    expect(result).toEqual({ ok: true, value: vacuumResult });
    expect(operations.vacuum).toHaveBeenCalledTimes(1);
  });

  it('auth-denial: denies by default and never calls vacuum() — proves VACUUM cannot run unauthorized', async () => {
    const { deps, operations } = makeDeps({ policy: undefined });
    const result = await daemonDbVacuumRoute.handle(undefined, deps);
    expect(result.ok).toBe(false);
    expect(operations.vacuum).not.toHaveBeenCalled();
  });
});

describe('registerDaemonDbRoutes', () => {
  it('mounts exactly the three documented routes', () => {
    const app = makeApp();
    const { deps } = makeDeps();
    registerDaemonDbRoutes(app as any, deps, adapter);
    expect(Object.keys(app.handlers).sort()).toEqual(
      ['GET /api/daemon/db', 'POST /api/daemon/db/vacuum', 'POST /api/daemon/db/verify'].sort(),
    );
  });

  it('requires same-origin on all three mounted routes: allows a same-origin request', async () => {
    const app = makeApp();
    const { deps } = makeDeps();
    registerDaemonDbRoutes(app as any, deps, adapter);
    const res = makeRes();
    await app.handlers['GET /api/daemon/db']!({ body: {}, query: {}, params: {} }, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('requires same-origin on all three mounted routes: blocks a cross-origin request before the tool executor ever runs', async () => {
    vi.mocked(isLocalSameOrigin).mockReturnValue(false);
    const app = makeApp();
    const { deps, operations } = makeDeps();
    registerDaemonDbRoutes(app as any, deps, adapter);

    for (const key of ['GET /api/daemon/db', 'POST /api/daemon/db/verify', 'POST /api/daemon/db/vacuum'] as const) {
      const res = makeRes();
      await app.handlers[key]!({ body: {}, query: {}, params: {} }, res);
      expect(res.status).toHaveBeenCalledWith(403);
    }
    expect(operations.inspect).not.toHaveBeenCalled();
    expect(operations.verify).not.toHaveBeenCalled();
    expect(operations.vacuum).not.toHaveBeenCalled();
  });

  it('end to end through the mounted vacuum route: a malformed request never reaches the executor, a same-origin allowed request does', async () => {
    const app = makeApp();
    const { deps, operations } = makeDeps();
    registerDaemonDbRoutes(app as any, deps, adapter);
    const res = makeRes();
    await app.handlers['POST /api/daemon/db/verify']!({ body: {}, query: { quick: ['a', 'b'] }, params: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(operations.verify).not.toHaveBeenCalled();
  });
});
