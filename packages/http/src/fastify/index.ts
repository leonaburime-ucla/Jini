/**
 * @module @jini/http/fastify
 *
 * The Fastify-native transport implementation: request parsing, response serialization, the
 * Fastify-mounting Adapter (`defineJsonRoute`/`mountJsonRoute`, built on `fastify.route(...)`),
 * the `/api` bearer-auth and origin-guard `onRequest` hooks, a loopback-only request guard, a
 * route-registration inventory/guard built on Fastify's native `onRoute` application hook, legacy-
 * shaped compat error helpers, and the generic daemon-status/shutdown routes wired through the
 * Fastify Adapter. Every export here operates on Fastify's `FastifyRequest`/`FastifyReply`/
 * `FastifyInstance` types. Import the shared, framework-agnostic pieces (`Result`,
 * `JsonRouteSpec`, origin-validation predicates, `mountPackHttp`) from the package root instead of
 * duplicating them here.
 */
export type { AdapterContext } from './adapter.js';
export { defineJsonRoute, mountJsonRoute } from './adapter.js';

export type { ApiBearerAuthMiddlewareDeps, ApiOriginGuardMiddlewareDeps } from './api-security-middleware.js';
export { registerApiBearerAuthMiddleware, registerApiOriginGuardMiddleware } from './api-security-middleware.js';

// Legacy-shaped compat error helpers (separate code/message/init call shape). `sendApiError`
// below (from `response.ts`) takes a single `ApiError` object; this compat `sendApiError` takes
// `(code, message, init)` — same job, different call-site generation, so it is re-exported here
// under a distinct name to avoid a duplicate export.
export {
  createCompatApiError,
  createCompatApiErrorResponse,
  sendApiError as sendCompatApiError,
} from './compat.js';

export type {
  DaemonShutdownResponse,
  DaemonStatusDeps,
  DaemonStatusResponse,
} from './daemon-status.js';
export { daemonShutdownRoute, daemonStatusRoute, registerDaemonStatusRoutes } from './daemon-status.js';

export {
  isLoopbackHostname,
  isLoopbackPeerAddress,
  localOriginFromHeader,
  normalizeLocalAuthority,
  requireLocalDaemonRequest,
  validateLocalDaemonRequest,
} from './local-daemon-request.js';

export type { OriginContext } from './origin.js';
export { guardSameOrigin } from './origin.js';

export { rawInput, validationError } from './request.js';

export { sendApiError, sendJson, statusForError } from './response.js';

export type { InstallRouteRegistrationGuardOptions, RouteRegistration } from './route-registration-guard.js';
export {
  getRouteRegistrationInventory,
  guardedRouteKey,
  installRouteRegistrationGuard,
} from './route-registration-guard.js';
