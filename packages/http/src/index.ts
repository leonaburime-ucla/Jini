/**
 * @module @jini/http
 *
 * JSON-route transport for a `@jini/core` daemon composition: the `Result`/route-spec types,
 * request parsing, response serialization, the same-origin guard, the Express-mounting Adapter,
 * legacy-shaped compat error helpers, a route-pack registrar, generic daemon status/shutdown
 * routes, and every route pack this package ships (runs, agents, host-tools, memory, routines,
 * db-ops, terminals, model-proxy, active-context, delegated-tools) — all still exported flat at
 * this root, unchanged, since that is the load-bearing default surface every existing consumer
 * (including `@jini/node-host`'s `createLocalNodeDaemon`) already imports from directly.
 *
 * The HTTP transport is additionally switchable: `./express/index.js` re-exports this same flat
 * surface's mounting pieces under an `express` namespace (see the bottom of this file), and
 * `./fastify/index.js` provides an idiomatically-native Fastify equivalent — request/response
 * plumbing, the mounting Adapter, the `/api` security middleware, the route-registration guard,
 * compat error helpers, and the daemon-status routes, all built once, independently, against
 * `FastifyRequest`/`FastifyReply`/`FastifyInstance`. A consumer that wants explicit transport
 * selection (as `createLocalNodeDaemon`'s `transport` option does) imports the `express`/`fastify`
 * namespace; everyone else keeps using the flat root exports exactly as before. See
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

export type { AdapterContext } from './adapter.js';
export { defineJsonRoute, mountJsonRoute } from './adapter.js';

export type { CreateSseChannelOptions, SseChannel, SseEvent } from './sse.js';
export { createSseChannel, DEFAULT_MAX_QUEUED_SSE_EVENTS, requestedAfterCursor, sendRawApiError } from './sse.js';

export type { CreateSseResponseOptions, SseConnection } from './raw-sse.js';
export { createSseResponse } from './raw-sse.js';

export type {
  ResolveWorkspaceRootOptions,
  WorkspaceRootRequest,
  WorkspaceRootResolver,
} from './workspace-root.js';
export { denyAllWorkspaceRoots, resolveWorkspaceRoot, WorkspaceRootDeniedError } from './workspace-root.js';

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

export type { RunStreamDeps } from './run-stream.js';
export { handleRunStreamRequest, RUN_STREAM_ROUTE_PATH } from './run-stream.js';

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

export type {
  MemoryChangeEmitter,
  MemoryConfigResponse,
  MemoryDeleteEntryResponse,
  MemoryEntryInput,
  MemoryEntryResponse,
  MemoryExtractionLog,
  MemoryExtractionsResponse,
  MemoryHttpDeps,
  MemoryIndexResponse,
  MemoryNoteEntry,
  MemoryNoteEntrySummary,
  MemoryNoteStore,
  MemoryNoteStoreOptions,
  MemoryOverviewResponse,
  MemoryRemovedResponse,
  MemoryTreeNode,
  MemoryTreeNodePatch,
  MemoryTreeResponse,
  MemoryUpdateTreeNodeResponse,
  MemoryVerificationsResponse,
  MemoryVerifyLog,
} from './memory.js';
export {
  memoryClearExtractionsRoute,
  memoryClearVerificationsRoute,
  memoryCreateEntryRoute,
  memoryDeleteEntryRoute,
  memoryListExtractionsRoute,
  memoryListVerificationsRoute,
  memoryOverviewRoute,
  memoryReadEntryRoute,
  memoryRemoveExtractionRoute,
  memoryRemoveVerificationRoute,
  memoryTreeRoute,
  memoryUpdateEntryRoute,
  memoryUpdateTreeNodeRoute,
  memoryWriteConfigRoute,
  memoryWriteIndexRoute,
  registerMemoryEventStream,
  registerMemoryRoutes,
} from './memory.js';

export type {
  RoutineDeleteResponse,
  RoutineHttpDeps,
  RoutineListResponse,
  RoutineResponse,
  RoutineRunNowResponse,
  RoutineRunsResponse,
  RoutineScheduler,
} from './routines.js';
export {
  registerRoutineRoutes,
  routineCreateRoute,
  routineDeleteRoute,
  routineGetRoute,
  routineListRoute,
  routineRunNowRoute,
  routineRunsListRoute,
  routineUpdateRoute,
} from './routines.js';

export type {
  CreateDaemonDbToolRegistrationsOptions,
  DaemonDbHttpDeps,
  DaemonDbInternalErrorContext,
  DaemonDbOperations,
  DaemonDbStatusReport,
  DaemonDbTableInfo,
  DaemonDbToolRegistrations,
  DaemonDbVacuumResult,
  DbIntegrityIssue,
  DbIntegrityIssueKind,
  DbIntegrityReport,
} from './db-ops.js';
export {
  createDaemonDbToolRegistrations,
  daemonDbInspectRoute,
  daemonDbVacuumRoute,
  daemonDbVerifyRoute,
  DB_INSPECT_TOOL_ID,
  DB_VACUUM_TOOL_ID,
  DB_VERIFY_TOOL_ID,
  denyAllDaemonDbPolicy,
  registerDaemonDbRoutes,
} from './db-ops.js';

export type {
  DelegatedToolExecuteRequest,
  DelegatedToolExecuteResponse,
  DelegatedToolsHttpDeps,
  DelegatedToolsInternalErrorContext,
} from './delegated-tools.js';
export { delegatedToolExecuteRoute, registerDelegatedToolRoutes } from './delegated-tools.js';

export type {
  TerminalActionResponse,
  TerminalCreateRequest,
  TerminalListResponse,
  TerminalsHttpDeps,
  TerminalsInternalErrorContext,
} from './terminals.js';
export {
  registerTerminalEventStream,
  registerTerminalRoutes,
  terminalCreateRoute,
  terminalDeleteRoute,
  terminalKillRoute,
  terminalListRoute,
  terminalResizeRoute,
  terminalStdinRoute,
} from './terminals.js';

export type { ModelProxyHttpDeps, ModelProxyInternalErrorContext } from './model-proxy.js';
export { registerModelProxyRoutes } from './model-proxy.js';

// Legacy-shaped compat error helpers (separate code/message/init call shape). `sendApiError`
// above (from `response.ts`) takes a single `ApiError` object; this compat `sendApiError` takes
// `(code, message, init)` — same job, different call-site generation, so it is re-exported here
// under a distinct name to avoid a duplicate export.
export {
  createCompatApiError,
  createCompatApiErrorResponse,
  sendApiError as sendCompatApiError,
} from './compat.js';

export * as express from './express-index.js';
export * as fastify from './fastify/index.js';
