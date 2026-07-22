import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiError } from '@jini/protocol';
import { defineJsonRoute, mountJsonRoute } from '../adapter.js';
import { err, ok } from '../../types.js';
import { isLocalSameOrigin } from '../../origin-validation.js';

vi.mock('../../origin-validation.js', () => ({
  isLocalSameOrigin: vi.fn(() => true),
}));

interface RouteCall {
  method: string;
  url: string;
  exposeHeadRoute?: boolean;
  handler: (req: any, reply: any) => Promise<void> | void;
}

/** Mirrors the one piece of the real Fastify surface `mountJsonRoute` touches: `route(options)`. */
function makeApp() {
  const calls: RouteCall[] = [];
  const handlers: Record<string, RouteCall['handler']> = {};
  const app = {
    route: (opts: RouteCall) => {
      calls.push(opts);
      handlers[`${opts.method} ${opts.url}`] = opts.handler;
    },
  };
  return { app, calls, handlers };
}

function makeReply() {
  return {
    code: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
}

const adapter = { resolvedPortRef: { current: 7456 } };

beforeEach(() => {
  vi.mocked(isLocalSameOrigin).mockReturnValue(true);
});

describe('fastify http adapter', () => {
  it('mounts via fastify.route() with exposeHeadRoute disabled', () => {
    const route = defineJsonRoute<void, unknown, unknown>({
      method: 'get',
      path: '/echo',
      parse: () => ok(undefined),
      handle: () => ok({}),
    });
    const { app, calls } = makeApp();
    mountJsonRoute(app as any, route, {}, adapter);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ method: 'GET', url: '/echo', exposeHeadRoute: false });
  });

  it.each([
    ['get', 'GET'],
    ['post', 'POST'],
    ['put', 'PUT'],
    ['delete', 'DELETE'],
    ['patch', 'PATCH'],
  ] as const)('maps HttpMethod %s to Fastify method %s', (httpMethod, fastifyMethod) => {
    const route = defineJsonRoute<void, unknown, unknown>({
      method: httpMethod,
      path: '/x',
      parse: () => ok(undefined),
      handle: () => ok({}),
    });
    const { app, calls } = makeApp();
    mountJsonRoute(app as any, route, {}, adapter);
    expect(calls[0]!.method).toBe(fastifyMethod);
  });

  it('parses input and returns the success payload', async () => {
    const route = defineJsonRoute<{ value: string }, { echoed: string }, unknown>({
      method: 'post',
      path: '/echo',
      parse: (raw) => ok({ value: String((raw.body as any).value) }),
      handle: (input) => ok({ echoed: input.value }),
    });
    const { app, handlers } = makeApp();
    mountJsonRoute(app as any, route, {}, adapter);
    const reply = makeReply();
    await handlers['POST /echo']!({ body: { value: 'hi' }, query: {}, params: {} }, reply);
    expect(reply.code).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({ echoed: 'hi' });
  });

  it('returns 400 when parse fails', async () => {
    const route = defineJsonRoute<{ value: string }, unknown, unknown>({
      method: 'post',
      path: '/missing',
      parse: () => err(createApiError('BAD_REQUEST', 'required')),
      handle: () => ok({}),
    });
    const { app, handlers } = makeApp();
    mountJsonRoute(app as any, route, {}, adapter);
    const reply = makeReply();
    await handlers['POST /missing']!({ body: {}, query: {}, params: {} }, reply);
    expect(reply.code).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({ error: { code: 'BAD_REQUEST', message: 'required' } });
  });

  it('maps a NOT_FOUND domain error to 404', async () => {
    const route = defineJsonRoute<void, unknown, unknown>({
      method: 'get',
      path: '/missing',
      parse: () => ok(undefined),
      handle: () => err(createApiError('NOT_FOUND', 'gone')),
    });
    const { app, handlers } = makeApp();
    mountJsonRoute(app as any, route, {}, adapter);
    const reply = makeReply();
    await handlers['GET /missing']!({ body: {}, query: {}, params: {} }, reply);
    expect(reply.code).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({ error: { code: 'NOT_FOUND', message: 'gone' } });
  });

  it('allows a same-origin request through when requireSameOrigin is set', async () => {
    vi.mocked(isLocalSameOrigin).mockReturnValue(true);
    const route = defineJsonRoute<void, { secret: number }, unknown>({
      method: 'get',
      path: '/secret',
      requireSameOrigin: true,
      parse: () => ok(undefined),
      handle: () => ok({ secret: 42 }),
    });
    const { app, handlers } = makeApp();
    mountJsonRoute(app as any, route, {}, adapter);
    const reply = makeReply();
    await handlers['GET /secret']!({ body: {}, query: {}, params: {} }, reply);
    expect(reply.code).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({ secret: 42 });
  });

  it('blocks cross-origin requests when requireSameOrigin is set', async () => {
    vi.mocked(isLocalSameOrigin).mockReturnValue(false);
    const route = defineJsonRoute<void, { secret: number }, unknown>({
      method: 'get',
      path: '/secret',
      requireSameOrigin: true,
      parse: () => ok(undefined),
      handle: () => ok({ secret: 42 }),
    });
    const { app, handlers } = makeApp();
    mountJsonRoute(app as any, route, {}, adapter);
    const reply = makeReply();
    await handlers['GET /secret']!({ body: {}, query: {}, params: {} }, reply);
    expect(reply.code).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith({
      error: { code: 'FORBIDDEN', message: 'cross-origin request rejected' },
    });
  });

  it('catches thrown handler errors as INTERNAL_ERROR (500)', async () => {
    const route = defineJsonRoute<void, unknown, unknown>({
      method: 'get',
      path: '/boom',
      parse: () => ok(undefined),
      handle: () => {
        throw new Error('boom');
      },
    });
    const { app, handlers } = makeApp();
    mountJsonRoute(app as any, route, {}, adapter);
    const reply = makeReply();
    await handlers['GET /boom']!({ body: {}, query: {}, params: {} }, reply);
    expect(reply.code).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({
      error: { code: 'INTERNAL_ERROR', message: 'boom' },
    });
  });

  it('catches a thrown non-Error value as INTERNAL_ERROR (500) via String(e)', async () => {
    const route = defineJsonRoute<void, unknown, unknown>({
      method: 'get',
      path: '/boom-string',
      parse: () => ok(undefined),
      handle: () => {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw 'boom-string';
      },
    });
    const { app, handlers } = makeApp();
    mountJsonRoute(app as any, route, {}, adapter);
    const reply = makeReply();
    await handlers['GET /boom-string']!({ body: {}, query: {}, params: {} }, reply);
    expect(reply.code).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({
      error: { code: 'INTERNAL_ERROR', message: 'boom-string' },
    });
  });

  it('passes deps through to the handler', async () => {
    interface Deps {
      tag: string;
    }
    const route = defineJsonRoute<void, { tag: string }, Deps>({
      method: 'get',
      path: '/deps',
      parse: () => ok(undefined),
      handle: (_input, deps) => ok({ tag: deps.tag }),
    });
    const { app, handlers } = makeApp();
    mountJsonRoute(app as any, route, { tag: 'injected' }, adapter);
    const reply = makeReply();
    await handlers['GET /deps']!({ body: {}, query: {}, params: {} }, reply);
    expect(reply.send).toHaveBeenCalledWith({ tag: 'injected' });
  });
});
