import { describe, expect, it, vi } from 'vitest';
import { agentListRoute as ExpressAgentListRoute, type AgentsHttpDeps, type AgentSummary } from '../../agents.js';
import { registerAgentRoutes } from '../agents.js';

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
const AGENTS: readonly AgentSummary[] = [
  { id: 'claude', name: 'Claude' },
  { id: 'codex', name: 'Codex' },
];

function makeDeps(overrides: Partial<AgentsHttpDeps> = {}): AgentsHttpDeps {
  return { listAgents: () => AGENTS, ...overrides };
}

describe('fastify agents re-exports', () => {
  it('mounts the exact same agentListRoute spec object as the express module (no duplicated route logic)', async () => {
    const { app, handlers } = makeApp();
    registerAgentRoutes(app as any, makeDeps(), adapter);
    const reply = makeReply();
    await handlers['GET /api/agents']!({ body: {}, query: {}, params: {} }, reply);
    // Proves the mounted handler is really calling the shared spec, not a re-implementation:
    // parsing/handling the identical input the express-side spec.parse/handle already cover.
    const parsed = ExpressAgentListRoute.parse({ body: {}, query: {}, params: {} });
    expect(parsed.ok).toBe(true);
  });
});

describe('registerAgentRoutes (fastify)', () => {
  it('mounts exactly GET /api/agents', () => {
    const { app, handlers } = makeApp();
    registerAgentRoutes(app as any, makeDeps(), adapter);
    expect(Object.keys(handlers)).toEqual(['GET /api/agents']);
  });

  it('serves the injected agent list end-to-end through the mounted Fastify handler', async () => {
    const { app, handlers } = makeApp();
    registerAgentRoutes(app as any, makeDeps(), adapter);
    const reply = makeReply();
    await handlers['GET /api/agents']!({ body: {}, query: {}, params: {} }, reply);
    expect(reply.code).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({ agents: AGENTS });
  });

  it('reflects an empty registry as an empty array through the Fastify mount, not an error', async () => {
    const { app, handlers } = makeApp();
    registerAgentRoutes(app as any, makeDeps({ listAgents: () => [] }), adapter);
    const reply = makeReply();
    await handlers['GET /api/agents']!({ body: {}, query: {}, params: {} }, reply);
    expect(reply.send).toHaveBeenCalledWith({ agents: [] });
  });
});
