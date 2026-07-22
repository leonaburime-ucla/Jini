/**
 * The module's top orchestration layer: wires request parsing, the same-origin guard, a route's
 * `handle`, and response serialization into a single Fastify route handler. This is the only file
 * in this subtree that knows about Fastify's `request`/`reply` on the mounting side. Same job as
 * `../express/adapter.ts`'s `mountJsonRoute`, registered through Fastify's native
 * `fastify.route({ method, url, handler })` instead of Express's `app[method](path, handler)`.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createApiError } from '@jini/protocol';
import { rawInput } from './request.js';
import { sendApiError, sendJson, statusForError } from './response.js';
import { guardSameOrigin, type OriginContext } from './origin.js';
import type { HttpMethod, JsonRouteSpec } from '../types.js';

/** Server startup state a mounted route needs to evaluate its same-origin guard. */
export interface AdapterContext extends OriginContext {}

/**
 * Identity function that pins a route spec's generic parameters at the definition site so
 * callers do not have to repeat them. The returned spec is consumed by `mountJsonRoute` (live)
 * and by tests (direct invocation of `route.parse` / `route.handle`).
 */
export function defineJsonRoute<Input, Output, Deps>(
  spec: JsonRouteSpec<Input, Output, Deps>,
): JsonRouteSpec<Input, Output, Deps> {
  return spec;
}

/** Maps the shared, lower-case `HttpMethod` union to the upper-case method literal Fastify's `route()` expects. */
const FASTIFY_METHOD: Record<HttpMethod, 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'> = {
  get: 'GET',
  post: 'POST',
  put: 'PUT',
  delete: 'DELETE',
  patch: 'PATCH',
};

/**
 * Mounts one JsonRouteSpec on a Fastify instance. The Adapter is the only code here that knows
 * about request/reply; the route's parse and handle functions operate on `RouteInputContext` and
 * `Deps` respectively, so they are unit testable without Fastify.
 *
 * `exposeHeadRoute: false` is passed explicitly so a `GET` spec does not also register Fastify's
 * automatic `HEAD` sibling route — the Express version never registers one either, and a spec's
 * `handle` is not written to answer a bodyless `HEAD` request correctly (e.g. `daemonStatusRoute`
 * always returns a JSON body).
 */
export function mountJsonRoute<Input, Output, Deps>(
  app: FastifyInstance,
  spec: JsonRouteSpec<Input, Output, Deps>,
  deps: Deps,
  adapter: AdapterContext,
): void {
  app.route({
    method: FASTIFY_METHOD[spec.method],
    url: spec.path,
    exposeHeadRoute: false,
    handler: async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        if (spec.requireSameOrigin) {
          const origin = guardSameOrigin(req, adapter);
          if (!origin.ok) {
            sendApiError(reply, statusForError(origin.error), origin.error);
            return;
          }
        }
        const parsed = spec.parse(rawInput(req));
        if (!parsed.ok) {
          sendApiError(reply, statusForError(parsed.error), parsed.error);
          return;
        }
        const result = await spec.handle(parsed.value, deps);
        if (!result.ok) {
          sendApiError(reply, statusForError(result.error), result.error);
          return;
        }
        sendJson(reply, spec.successStatus ?? 200, result.value);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        sendApiError(reply, 500, createApiError('INTERNAL_ERROR', message));
      }
    },
  });
}
