/**
 * @module @jini/http
 *
 * JSON-route transport for a `@jini/core` daemon composition. This root barrel exports only the
 * pieces that are genuinely framework-agnostic: the `Result`/route-spec types, the same-origin
 * validation predicates, and the route-pack registrar (`mountPackHttp`, which only ever passes
 * `app` straight through to a pack's own `http(app, services)` — see `pack-http.ts`'s doc). Every
 * transport-specific piece (request/response plumbing, the mounting Adapter, the `/api` security
 * middleware, the route-registration guard, the loopback request guard, compat error helpers, and
 * the daemon-status routes) now lives in one of two independent, self-contained, idiomatically
 * native subtrees — `./express/index.js` or `./fastify/index.js` — so a consumer picks a
 * transport namespace explicitly instead of getting an Express-shaped surface by default. See
 * `source-map.md` for full provenance and scope-decision notes.
 */
export type {
  Handler,
  HttpMethod,
  InputParser,
  JsonRouteSpec,
  Result,
  RouteInputContext,
} from './types.js';
export { err, ok } from './types.js';

export type {
  ParsedHostHeader,
  RequestWithOriginHeaders,
} from './origin-validation.js';
export {
  allowedBrowserPorts,
  configuredAllowedHosts,
  configuredAllowedOrigins,
  isAllowedBrowserHost,
  isAllowedBrowserOrigin,
  isIpLiteralHostname,
  isLoopbackOrPrivateLanHost,
  isLocalSameOrigin,
  isPrivateIpv4,
  parseHostHeader,
} from './origin-validation.js';

export { mountPackHttp } from './pack-http.js';

export type { CreateSseResponseOptions, SseConnection } from './sse.js';
export { createSseResponse } from './sse.js';

export type { RunStreamDeps } from './run-stream.js';
export { handleRunStreamRequest, RUN_STREAM_ROUTE_PATH } from './run-stream.js';

export * as express from './express/index.js';
export * as fastify from './fastify/index.js';
