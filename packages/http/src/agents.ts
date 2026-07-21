/**
 * @module agents
 *
 * `GET /api/agents` — lists the agent defs a host has registered, as
 * `{id, name}` pairs. Added while building `@jini/mcp`'s `list_agents` tool
 * (see `packages/mcp/source-map.md`'s 2026-07-21 addition): no HTTP
 * projection of a host's registered-agent set existed anywhere in this
 * package before this route.
 *
 * `listAgents` is injected (matching `daemon-status.ts`/`active-context.ts`'s
 * DI convention) rather than this module importing `@jini/agent-runtime`
 * directly — a host typically already has that package's `AGENT_DEFS` array
 * in scope and just needs to project it, and this keeps `@jini/http` from
 * taking on a new package dependency for a two-field shape. Deliberately
 * static: this reflects what a host has *registered*, not which agent
 * binaries are actually installed/reachable on the machine (that would need
 * live detection/probing per agent — a real design decision with timeout and
 * caching tradeoffs, out of scope for this route).
 */
import type { Express } from 'express';
import { defineJsonRoute, mountJsonRoute, type AdapterContext } from './adapter.js';
import { ok } from './types.js';

/** The two fields a caller needs to pick an agent id for a run — deliberately not `@jini/agent-runtime`'s full `RuntimeAgentDef` (which carries CLI-spawn internals no HTTP caller should see). */
export interface AgentSummary {
  readonly id: string;
  readonly name: string;
}

export interface AgentsHttpDeps {
  /** Returns every agent def a host has registered. Synchronous: this is a projection of an in-memory list, not a live probe. */
  readonly listAgents: () => readonly AgentSummary[];
}

export interface AgentListResponse {
  readonly agents: readonly AgentSummary[];
}

/** `GET /api/agents` — read-only, no side effects; matches `runListRoute`/`runStatusRoute`'s posture of not requiring same-origin. */
export const agentListRoute = defineJsonRoute<void, AgentListResponse, AgentsHttpDeps>({
  method: 'get',
  path: '/api/agents',
  parse: () => ok(undefined),
  handle: (_input, deps) => ok({ agents: deps.listAgents() }),
});

/** Mounts `GET /api/agents` on `app`. A pack's `http(app, services)` calls this directly. */
export function registerAgentRoutes(app: Express, deps: AgentsHttpDeps, adapter: AdapterContext): void {
  mountJsonRoute(app, agentListRoute, deps, adapter);
}
