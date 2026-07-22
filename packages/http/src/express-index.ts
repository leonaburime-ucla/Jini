/**
 * @module @jini/http/express
 *
 * The Express-native transport namespace: re-exports this package's existing flat Express
 * implementation (request parsing, response serialization, the mounting Adapter, the `/api`
 * security middleware, the route-registration guard, compat error helpers, the daemon-status
 * routes, and the runs/agents/host-tools route packs) under one namespace, mirroring
 * `./fastify/index.js`'s shape so a transport-switchable caller (`@jini/node-host`'s
 * `createLocalNodeDaemon`) can import either namespace symmetrically. Nothing here is a new
 * implementation — every export is the same flat file every other consumer of this package
 * already imports directly from the root barrel; this module exists only so `httpExpress.*` and
 * `httpFastify.*` read the same at call sites that need to pick a transport explicitly.
 */
export type { AdapterContext } from './adapter.js';
export { defineJsonRoute, mountJsonRoute } from './adapter.js';

export type { ApiBearerAuthMiddlewareDeps, ApiOriginGuardMiddlewareDeps } from './api-security-middleware.js';
export { registerApiBearerAuthMiddleware, registerApiOriginGuardMiddleware } from './api-security-middleware.js';

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

export { registerRunStreamRoute } from './express/run-stream.js';

export { sendApiError, sendJson, statusForError } from './response.js';

export type { InstallRouteRegistrationGuardOptions, RouteRegistration } from './route-registration-guard.js';
export {
  getRouteRegistrationInventory,
  guardedRouteKey,
  installRouteRegistrationGuard,
} from './route-registration-guard.js';

export { registerRunRoutes } from './runs.js';
export { registerAgentRoutes } from './agents.js';
export { registerHostToolsRoutes } from './host-tools.js';
