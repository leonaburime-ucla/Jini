/**
 * @module fastify/host-tools
 *
 * Fastify-mounting glue for `../host-tools.js`'s `hostEditorsRoute`/`openResourceInEditorRoute` —
 * the exact same `JsonRouteSpec` objects the Express mounting in `../host-tools.js` uses, just
 * mounted through this subtree's own `mountJsonRoute` instead.
 */
import type { FastifyInstance } from 'fastify';
import { hostEditorsRoute, openResourceInEditorRoute, type HostToolsOpenInDeps } from '../host-tools.js';
import { mountJsonRoute, type AdapterContext } from './adapter.js';

/** Mounts `GET /api/editors` and `POST /api/resources/:resourceRef/open-in` on `app` — the Fastify-native equivalent of `../host-tools.js`'s `registerHostToolsRoutes`. */
export function registerHostToolsRoutes(
  app: FastifyInstance,
  adapter: AdapterContext,
  openInDeps: HostToolsOpenInDeps = {},
): void {
  mountJsonRoute(app, hostEditorsRoute, {}, adapter);
  mountJsonRoute(app, openResourceInEditorRoute, openInDeps, adapter);
}
