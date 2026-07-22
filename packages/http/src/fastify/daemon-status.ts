/**
 * @module fastify/daemon-status
 *
 * Mounts the generic daemon status + shutdown routes through the Fastify Adapter. The route
 * SPECS themselves (`daemonStatusRoute`/`daemonShutdownRoute` — pure `defineJsonRoute`-shaped
 * data plus framework-agnostic `parse`/`handle` functions, see `../daemon-status.ts`'s own doc
 * for their full provenance) are intentionally NOT duplicated here: they never reference Express
 * at runtime (`../daemon-status.ts` only imports `type { Express }` for its own
 * `registerDaemonStatusRoutes`'s parameter — a type-only import that TypeScript's
 * `verbatimModuleSyntax` erases from the compiled output entirely, so importing the specs from
 * that module does not pull the `express` package into this subtree at runtime). This file's own
 * job is only the Fastify-specific mounting wrapper, calling `./adapter.js`'s Fastify
 * `mountJsonRoute` instead of the Express one.
 */
import type { FastifyInstance } from 'fastify';
import {
  daemonShutdownRoute,
  daemonStatusRoute,
  type DaemonShutdownResponse,
  type DaemonStatusDeps,
  type DaemonStatusResponse,
} from '../daemon-status.js';
import { mountJsonRoute, type AdapterContext } from './adapter.js';

export { daemonShutdownRoute, daemonStatusRoute };
export type { DaemonShutdownResponse, DaemonStatusDeps, DaemonStatusResponse };

/** Mounts both daemon-status routes on `app`. A pack's `http(app, services)` calls this directly. */
export function registerDaemonStatusRoutes(app: FastifyInstance, deps: DaemonStatusDeps, adapter: AdapterContext): void {
  mountJsonRoute(app, daemonStatusRoute, deps, adapter);
  mountJsonRoute(app, daemonShutdownRoute, deps, adapter);
}
