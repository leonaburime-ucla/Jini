/**
 * @module fastify/agents
 *
 * Fastify-mounting glue for `../agents.js`'s `agentListRoute` — the exact same `JsonRouteSpec`
 * the Express mounting in `../agents.js` uses, just mounted through this subtree's own
 * `mountJsonRoute` instead.
 */
import type { FastifyInstance } from 'fastify';
import { agentListRoute, type AgentsHttpDeps } from '../agents.js';
import { mountJsonRoute, type AdapterContext } from './adapter.js';

/** Mounts `GET /api/agents` on `app` — the Fastify-native equivalent of `../agents.js`'s `registerAgentRoutes`. */
export function registerAgentRoutes(app: FastifyInstance, deps: AgentsHttpDeps, adapter: AdapterContext): void {
  mountJsonRoute(app, agentListRoute, deps, adapter);
}
