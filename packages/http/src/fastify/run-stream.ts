/**
 * @module fastify/run-stream
 *
 * Fastify-specific mounting glue for the shared AG-UI SSE run-stream handler
 * (`../run-stream.js`). `reply.raw`/`request.raw` give the exact underlying `http.ServerResponse`/
 * `http.IncomingMessage` pair directly, so this file's only job is resolving the `runId` route
 * param and handing those raw objects straight through — a few lines, not a reimplementation, per
 * the design decision that motivated building the SSE primitive once instead of duplicating it
 * per transport. `reply.hijack()` tells Fastify this handler is taking over the raw response
 * itself, so Fastify's own reply lifecycle (which otherwise expects the handler to return a value
 * for it to serialize, or call `reply.send(...)`) does not try to act on a response this handler
 * already wrote to and ended directly.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { handleRunStreamRequest, RUN_STREAM_ROUTE_PATH, type RunStreamDeps } from '../run-stream.js';

/** Mounts the AG-UI SSE run-stream route on `app`. A pack's `http(app, services)` calls this directly. */
export function registerRunStreamRoute(app: FastifyInstance, deps: RunStreamDeps): void {
  app.get(RUN_STREAM_ROUTE_PATH, async (request: FastifyRequest, reply: FastifyReply) => {
    reply.hijack();
    const runId = (request.params as { runId: string }).runId;
    await handleRunStreamRequest(request.raw, reply.raw, runId, deps);
  });
}
