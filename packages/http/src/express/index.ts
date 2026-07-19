/**
 * @module @jini/http/express
 *
 * The Express-native transport implementation: request parsing, response serialization, the
 * Express-mounting Adapter (`defineJsonRoute`/`mountJsonRoute`), the `/api` bearer-auth and
 * origin-guard middleware, a loopback-only request guard, a route-registration inventory/guard
 * built on Express's monkey-patchable registration methods, legacy-shaped compat error helpers,
 * and the generic daemon-status/shutdown routes wired through the Express Adapter. Every export
 * here operates on Express's `Request`/`Response`/`Express` types (all as `import type` — this
 * subtree has no runtime dependency on the `express` package itself, only its types). Import the
 * shared, framework-agnostic pieces (`Result`, `JsonRouteSpec`, origin-validation predicates,
 * `mountPackHttp`) from the package root instead of duplicating them here.
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
