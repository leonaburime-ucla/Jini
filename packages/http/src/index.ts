/**
 * @module @jini/http
 *
 * JSON-route transport for a `@jini/core` daemon composition: the `Result`/route-spec types,
 * request parsing, response serialization, the same-origin guard, the Express-mounting Adapter,
 * legacy-shaped compat error helpers, a route-pack registrar, generic daemon status/shutdown
 * routes, and a generic active-resource-focus channel. See `source-map.md` for full provenance
 * and scope-decision notes.
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

export { rawInput, validationError } from './request.js';

export { sendApiError, sendJson, statusForError } from './response.js';

export type { OriginContext } from './origin.js';
export { guardSameOrigin } from './origin.js';

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

export type { AdapterContext } from './adapter.js';
export { defineJsonRoute, mountJsonRoute } from './adapter.js';

export { mountPackHttp } from './pack-http.js';

export type { RunCancellationService } from './cancel-owned-runs.js';
export { cancelRunsOwnedBy } from './cancel-owned-runs.js';

export type { ActiveContextDeps, ActiveContextResource } from './active-context.js';
export {
  ACTIVE_CONTEXT_TTL_MS,
  getActiveRoute,
  registerActiveContextRoutes,
  setActiveRoute,
} from './active-context.js';

export type {
  CatalogueEntry,
  HostEditor,
  HostEditorsResponse,
  HostToolLaunchPlan,
  HostToolProbeEnv,
  LaunchHostToolResult,
  Platform,
  RealPlatform,
} from './host-tools.js';
export {
  applicableForPlatform,
  CATALOGUE,
  currentPlatform,
  defaultProbeEnv,
  hostEditorsRoute,
  launchHostTool,
  listAvailableEditors,
  pathDirs,
  probeCommandOnPath,
  probeMacBundle,
  registerHostToolsRoutes,
  resolveEntry,
  resolveHostToolLaunchPlan,
} from './host-tools.js';

export type { ApiBearerAuthMiddlewareDeps, ApiOriginGuardMiddlewareDeps } from './api-security-middleware.js';
export { registerApiBearerAuthMiddleware, registerApiOriginGuardMiddleware } from './api-security-middleware.js';

export type { InstallRouteRegistrationGuardOptions, RouteRegistration } from './route-registration-guard.js';
export {
  getRouteRegistrationInventory,
  guardedRouteKey,
  installRouteRegistrationGuard,
} from './route-registration-guard.js';

export {
  isLoopbackHostname,
  isLoopbackPeerAddress,
  localOriginFromHeader,
  normalizeLocalAuthority,
  requireLocalDaemonRequest,
  validateLocalDaemonRequest,
} from './local-daemon-request.js';

export type {
  DaemonShutdownResponse,
  DaemonStatusDeps,
  DaemonStatusResponse,
} from './daemon-status.js';
export { daemonShutdownRoute, daemonStatusRoute, registerDaemonStatusRoutes } from './daemon-status.js';

export type {
  RunCancelResponse,
  RunCreateRequest,
  RunHttpDeps,
  RunInternalErrorContext,
  RunListResponse,
  RunStartContext,
  RunStartHandler,
  RunStartResponse,
  RunStatusResponse,
} from './runs.js';
export {
  registerRunEventStream,
  registerRunRoutes,
  runCancelRoute,
  runListRoute,
  runStartRoute,
  runStatusRoute,
} from './runs.js';

export type { AgentListResponse, AgentsHttpDeps, AgentSummary } from './agents.js';
export { agentListRoute, registerAgentRoutes } from './agents.js';

// Legacy-shaped compat error helpers (separate code/message/init call shape). `sendApiError`
// above (from `response.ts`) takes a single `ApiError` object; this compat `sendApiError` takes
// `(code, message, init)` — same job, different call-site generation, so it is re-exported here
// under a distinct name to avoid a duplicate export.
export {
  createCompatApiError,
  createCompatApiErrorResponse,
  sendApiError as sendCompatApiError,
} from './compat.js';
