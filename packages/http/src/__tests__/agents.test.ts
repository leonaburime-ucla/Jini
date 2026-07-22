import { describe, expect, it, vi } from 'vitest';
import { isLocalSameOrigin } from '../origin-validation.js';
import { agentListRoute, registerAgentRoutes, type AgentsHttpDeps, type AgentSummary } from '../agents.js';

vi.mock('../origin-validation.js', () => ({
  isLocalSameOrigin: vi.fn(() => true),
}));

interface MockApp {
  get: (path: string, handler: any) => void;
  post: (path: string, handler: any) => void;
  handlers: Record<string, (req: any, res: any) => Promise<void> | void>;
}

function makeApp(): MockApp {
  const handlers: MockApp['handlers'] = {};
  const make = (method: string) => (path: string, handler: any) => {
    handlers[`${method.toUpperCase()} ${path}`] = handler;
  };
  return { get: make('get'), post: make('post'), handlers };
}

function makeRes() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
}

const adapter = { resolvedPortRef: { current: 7456 } };
const AGENTS: readonly AgentSummary[] = [
  { id: 'claude', name: 'Claude' },
  { id: 'codex', name: 'Codex' },
];

function makeDeps(overrides: Partial<AgentsHttpDeps> = {}): AgentsHttpDeps {
  return { listAgents: () => AGENTS, ...overrides };
}

describe('agentListRoute.parse', () => {
  it('requires no input', () => {
    expect(agentListRoute.parse({ body: {}, query: {}, params: {} })).toEqual({ ok: true, value: undefined });
  });
});

describe('agentListRoute.handle', () => {
  it('wraps the injected listAgents() result as { agents }', async () => {
    const result = await agentListRoute.handle(undefined, makeDeps());
    expect(result).toEqual({ ok: true, value: { agents: AGENTS } });
  });

  it('reflects an empty registry as an empty array, not an error', async () => {
    const result = await agentListRoute.handle(undefined, makeDeps({ listAgents: () => [] }));
    expect(result).toEqual({ ok: true, value: { agents: [] } });
  });

  it('calls listAgents fresh on every handle (not cached across calls)', async () => {
    const listAgents = vi.fn(() => AGENTS);
    const deps = makeDeps({ listAgents });
    await agentListRoute.handle(undefined, deps);
    await agentListRoute.handle(undefined, deps);
    expect(listAgents).toHaveBeenCalledTimes(2);
  });
});

describe('registerAgentRoutes', () => {
  it('mounts exactly GET /api/agents', () => {
    const app = makeApp();
    registerAgentRoutes(app as any, makeDeps(), adapter);
    expect(Object.keys(app.handlers)).toEqual(['GET /api/agents']);
  });

  it('serves the injected agent list end-to-end through the mounted handler', async () => {
    const app = makeApp();
    registerAgentRoutes(app as any, makeDeps(), adapter);
    const res = makeRes();
    await app.handlers['GET /api/agents']!({ body: {}, query: {}, params: {} }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ agents: AGENTS });
  });

  it('does not require same-origin: allows a cross-origin read', async () => {
    vi.mocked(isLocalSameOrigin).mockReturnValue(false);
    try {
      const app = makeApp();
      registerAgentRoutes(app as any, makeDeps(), adapter);
      const res = makeRes();
      await app.handlers['GET /api/agents']!({ body: {}, query: {}, params: {} }, res);
      expect(res.status).toHaveBeenCalledWith(200);
    } finally {
      vi.mocked(isLocalSameOrigin).mockReturnValue(true);
    }
  });
});
