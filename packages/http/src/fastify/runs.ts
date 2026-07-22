/**
 * @module fastify/runs
 *
 * Fastify-mounting glue for `../runs.js`'s route logic — every `JsonRouteSpec` (`runStartRoute`,
 * `runListRoute`, `runStatusRoute`, `runCancelRoute`) and the SSE event-stream core
 * (`handleRunEventStreamRequest`) are the exact same functions the Express mounting in `../runs.js`
 * uses; nothing here re-implements route logic, only how a request reaches it and a response
 * leaves it, mirroring the rest of this `fastify/` subtree.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { RunHttpDeps } from '../runs.js';
import { handleRunEventStreamRequest, runCancelRoute, runListRoute, runStartRoute, runStatusRoute } from '../runs.js';
import { mountJsonRoute, type AdapterContext } from './adapter.js';

/** Reads a reconnect cursor from the `Last-Event-ID` header, falling back to an `afterCursor` query parameter — the Fastify-request-shaped equivalent of `../sse.js`'s `requestedAfterCursor` (Fastify already parses both `.headers` and `.query` for us, so no Express-`Request`-shaped adapter object is needed here). */
function requestedAfterCursorFastify(request: FastifyRequest): string | null {
  const header = request.headers['last-event-id'];
  const headerValue = Array.isArray(header) ? header[0] : header;
  if (headerValue !== undefined && headerValue.length > 0) return headerValue;
  const query = (request.query as Record<string, unknown> | undefined)?.afterCursor;
  return typeof query === 'string' && query.length > 0 ? query : null;
}

/** Mounts `GET /api/runs/:runId/events` on `app` via Fastify's native `route()` (matching `mountJsonRoute`'s own registration mechanism, unlike `fastify/run-stream.ts`'s `.get()` shorthand — kept consistent within this file since `registerRunRoutes` below mounts both through the same `app`), hijacking the reply so `handleRunEventStreamRequest` can write the raw SSE stream directly. */
export function registerRunEventStream(app: FastifyInstance, deps: RunHttpDeps): void {
  app.route({
    method: 'GET',
    url: '/api/runs/:runId/events',
    exposeHeadRoute: false,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      reply.hijack();
      const runId = (request.params as { runId?: string }).runId ?? '';
      await handleRunEventStreamRequest(reply.raw, runId, requestedAfterCursorFastify(request), deps);
    },
  });
}

/** Mounts create/status/cancel JSON endpoints and the SSE event stream as one run transport — the Fastify-native equivalent of `../runs.js`'s `registerRunRoutes`, mounting the identical `JsonRouteSpec` objects. */
export function registerRunRoutes(app: FastifyInstance, deps: RunHttpDeps, adapter: AdapterContext): void {
  mountJsonRoute(app, runStartRoute, deps, adapter);
  mountJsonRoute(app, runListRoute, deps, adapter);
  mountJsonRoute(app, runStatusRoute, deps, adapter);
  mountJsonRoute(app, runCancelRoute, deps, adapter);
  registerRunEventStream(app, deps);
}
