import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isLocalSameOrigin } from '../../origin-validation.js';
import { hostEditorsRoute, openResourceInEditorRoute } from '../../host-tools.js';
import { denyAllWorkspaceRoots } from '../../workspace-root.js';
import { registerHostToolsRoutes } from '../host-tools.js';

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

describe('fastify host-tools re-exports', () => {
  it('mounts the exact same hostEditorsRoute/openResourceInEditorRoute spec objects as the express module', () => {
    const { app, handlers } = makeApp();
    registerHostToolsRoutes(app as any, adapter);
    expect(Object.keys(handlers).sort()).toEqual(
      [`${hostEditorsRoute.method.toUpperCase()} ${hostEditorsRoute.path}`, `${openResourceInEditorRoute.method.toUpperCase()} ${openResourceInEditorRoute.path}`].sort(),
    );
  });
});

describe('registerHostToolsRoutes (fastify)', () => {
  it('serves GET /api/editors end-to-end through the mounted Fastify handler', async () => {
    const { app, handlers } = makeApp();
    registerHostToolsRoutes(app as any, adapter);
    const reply = makeReply();
    await handlers['GET /api/editors']!({ body: {}, query: {}, params: {} }, reply);
    expect(reply.code).toHaveBeenCalledWith(200);
    const [body] = reply.send.mock.calls[0]!;
    expect(Array.isArray(body.editors)).toBe(true);
  });

  it('serves POST /api/resources/:resourceRef/open-in through the mounted Fastify handler, denying every call under the default resolver (denyAllWorkspaceRoots)', async () => {
    const { app, handlers } = makeApp();
    registerHostToolsRoutes(app as any, adapter, { resolveRoot: denyAllWorkspaceRoots });
    const reply = makeReply();
    await handlers['POST /api/resources/:resourceRef/open-in']!(
      { body: { editorId: 'vscode' }, query: {}, params: { resourceRef: 'some-resource' } },
      reply,
    );
    expect(reply.code).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({ error: { code: 'NOT_FOUND', message: 'resource "some-resource" was not found' } });
  });

  it('threads a real resolveRoot through the Fastify mount, reaching the editor-launch path (not denied)', async () => {
    const { app, handlers } = makeApp();
    registerHostToolsRoutes(app as any, adapter, {
      resolveRoot: () => '/tmp/known-resource',
      spawnImpl: vi.fn(() => {
        const { EventEmitter } = require('node:events');
        const child = new EventEmitter();
        queueMicrotask(() => child.emit('error', new Error('ENOENT: not installed, for real-resolver-reachability proof only')));
        return child;
      }) as any,
    });
    const reply = makeReply();
    await handlers['POST /api/resources/:resourceRef/open-in']!(
      { body: { editorId: 'vscode' }, query: {}, params: { resourceRef: 'known-resource' } },
      reply,
    );
    // Not 404: the resolver ran and returned a real directory, proving the Fastify mount
    // actually threads openInDeps through — the launch outcome itself is already covered by
    // openResourceInEditorRoute's own shared handle() tests.
    expect(reply.code).not.toHaveBeenCalledWith(404);
  });

  it('defaults openInDeps to {} (denyAllWorkspaceRoots) when omitted entirely', async () => {
    const { app, handlers } = makeApp();
    registerHostToolsRoutes(app as any, adapter);
    const reply = makeReply();
    await handlers['POST /api/resources/:resourceRef/open-in']!(
      { body: { editorId: 'vscode' }, query: {}, params: { resourceRef: 'anything' } },
      reply,
    );
    expect(reply.code).toHaveBeenCalledWith(404);
  });
});
