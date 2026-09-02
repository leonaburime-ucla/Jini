/**
 * @module delegated-tools
 *
 * `POST /api/delegated-tool-calls` — the daemon-side half of gap 3's MCP-callback continuation
 * transport spike (see `packages/daemon/source-map.md`'s "run/chat orchestration gap 3, part 1"
 * addition and this package's own dated section in `source-map.md`). The swarm-consensus Final
 * Recommendation asked for exactly this round trip: "inject the already-shipped MCP host into
 * one MCP-capable CLI's launch config, prove a tool round-trip through the existing
 * `delegated-tool-bridge.ts`." This route is that round trip's daemon-side half — an MCP server
 * subprocess spawned alongside a `claude` run (`packages/mcp/src/bin/serve.ts`, injected via
 * `packages/daemon/src/agent-executor.ts`'s optional `mcpJsonInjection` config) calls back into
 * the daemon over loopback HTTP (`packages/mcp/src/server/daemon-client.ts`) with
 * `{runId, toolUseId, toolId, input}`; this route decodes that request and calls the
 * already-shipped, already-tested `createDelegatedToolBridge`
 * (`packages/daemon/src/delegated-tool-bridge.ts`), which is the ONLY execution path from here:
 * every injected byte still routes through `ToolExecutor`'s deny-by-default gate — no parallel
 * authorization mechanism is introduced by this route.
 *
 * `resolvePrincipal` is host-owned and has no default (mirrors gap 3's own resolved
 * human-in-the-loop answer — an explicit host-supplied allowlist/policy, never an invented
 * mechanism): whatever `Principal` a host resolves for a given delegated-tool-call request is
 * exactly what flows into `ToolExecutor.execute`'s own `ToolPolicy.authorize`/
 * `ExecutionDelegate` gates. This route does not itself decide who is allowed to do what — it
 * only decides *which run* a request may act against (an unknown or not-yet-started `runId` is
 * rejected with `404` before the bridge is ever invoked, same precedent as `runs.ts`'s
 * `runCancelRoute`).
 */
import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import { createApiError } from '@jini-ai/protocol';
import { isReadOnlyTool, type Principal, type ToolRegistry } from '@jini-ai/core';
import { createDelegatedToolBridge, type RunLifecycle, type ToolExecutionResult, type ToolExecutor } from '@jini-ai/daemon';
import { defineJsonRoute, mountJsonRoute, type AdapterContext } from './adapter.js';
import { validationError } from './request.js';
import { err, ok, type Result, type RouteInputContext } from './types.js';

export interface DelegatedToolExecuteRequest {
  readonly runId: string;
  readonly toolUseId: string;
  readonly toolId: string;
  readonly input?: unknown;
  /**
   * When `true`, the call is refused unless `toolId`'s registration declares itself read-only
   * (`@jini-ai/core`'s `isReadOnlyTool`). Set by a caller that has already promised ITS own caller
   * that the surface only reads — `@jini-ai/mcp`'s `execute_readonly_delegated_tool`, whose
   * `readOnlyHint: true` annotation is exactly such a promise.
   *
   * The constraint is enforced HERE rather than in the calling process because only this side can
   * resolve a tool id against the live `ToolRegistry`. A caller-side check would be a claim; this
   * is the fact.
   *
   * Omitted means unconstrained, which is what every existing caller sends — the original
   * `execute_delegated_tool` path is untouched by this field's existence.
   */
  readonly requireReadOnly?: boolean;
}

export interface DelegatedToolExecuteResponse {
  readonly result: ToolExecutionResult;
}

/**
 * Diagnostic detail for an internal-error response the public API deliberately does not
 * disclose (SEC-005), matching `runs.ts`'s `RunInternalErrorContext` precedent: a thrown
 * `ToolExecutor`/registry failure can embed tool-handler internals no HTTP caller should see.
 */
export interface DelegatedToolsInternalErrorContext {
  readonly source: 'delegated-tool-execute' | 'resolve-principal';
  readonly runId: string;
  readonly toolId: string;
  readonly correlationId: string;
  readonly error: unknown;
}

export interface DelegatedToolsHttpDeps {
  readonly lifecycle: RunLifecycle;
  readonly toolExecutor: ToolExecutor;
  /** Host-owned: resolves the `Principal` a given delegated-tool-call request executes as. Mandatory — see module doc; there is no safe default identity this package could assume on a host's behalf. */
  readonly resolvePrincipal: (request: DelegatedToolExecuteRequest) => Principal | Promise<Principal>;
  /** Host-owned sink for the real exception behind a generic `INTERNAL_ERROR` response (SEC-005). Defaults to `console.error`. */
  readonly onInternalError?: (context: DelegatedToolsInternalErrorContext) => void;
  /**
   * The same `ToolRegistry` `deps.toolExecutor` was built over, supplied so a
   * {@link DelegatedToolExecuteRequest.requireReadOnly} call can be checked against the descriptor
   * that will actually run. Descriptors only — this route never gains a way to reach a handler.
   *
   * Optional so that mounting this route stays a non-breaking one-liner for every host that
   * predates the constraint. A host that omits it does not get a WEAKER gate: a `requireReadOnly`
   * call it cannot verify is refused outright ({@link READ_ONLY_UNVERIFIABLE_MESSAGE}), never
   * waived. Unconstrained calls behave identically with or without it.
   */
  readonly toolRegistry?: ToolRegistry;
}

/**
 * Refusal text for a `requireReadOnly` call naming a tool that is not registered read-only —
 * including one that is not registered at all, which is the same answer for the same reason
 * (nothing corroborates that it only reads).
 *
 * Names the tool and the remedy, because the caller is a model choosing between two gateways and
 * "denied" alone would leave it guessing which one to try. `describe_tool` already discloses
 * whether an id exists, so distinguishing "unknown" from "writes" here would buy the caller nothing
 * and cost a second message to keep in step.
 */
export function readOnlyRefusalMessage(toolId: string): string {
  return `tool "${toolId}" is not registered as read-only — this gateway executes only tools whose registration declares readOnly; call it through execute_delegated_tool instead`;
}

/**
 * Refusal text for a `requireReadOnly` call this host has no way to check, because it mounted the
 * route without {@link DelegatedToolsHttpDeps.toolRegistry}.
 *
 * Refusing is the only safe answer: the alternative — running the call because the constraint could
 * not be evaluated — would let a write through a caller that annotated itself read-only, which is
 * strictly worse than having no read-only gateway at all. The message names the missing dep so the
 * fix is one line in the host's own wiring rather than an investigation.
 */
export const READ_ONLY_UNVERIFIABLE_MESSAGE =
  'this host cannot verify read-only tools — POST /api/delegated-tool-calls was mounted without DelegatedToolsHttpDeps.toolRegistry, so a requireReadOnly call cannot be checked and is refused';

/**
 * Evaluates a request's read-only constraint against the live registry.
 *
 * @param deps - Supplies the optional `toolRegistry` the check reads.
 * @param input - The parsed request; an absent/false `requireReadOnly` short-circuits to `null`.
 * @returns `null` when the call may proceed, or the `ApiError` to answer with.
 * @complexity O(n) in registered tool count on a constrained call only (`ToolRegistry` exposes
 *   enumeration, not lookup by id); O(1) — a single boolean test — on every unconstrained call,
 *   which is every call the pre-existing gateway makes.
 */
function checkReadOnlyConstraint(
  deps: DelegatedToolsHttpDeps,
  input: DelegatedToolExecuteRequest,
): ReturnType<typeof createApiError> | null {
  if (input.requireReadOnly !== true) return null;
  if (deps.toolRegistry === undefined) {
    return createApiError('TOOL_OPERATION_DENIED', READ_ONLY_UNVERIFIABLE_MESSAGE);
  }
  const descriptor = deps.toolRegistry.list().find((candidate) => candidate.id === input.toolId);
  if (isReadOnlyTool(descriptor)) return null;
  return createApiError('TOOL_OPERATION_DENIED', readOnlyRefusalMessage(input.toolId));
}

/** Logs the real failure server-side and returns the generic, correlation-id-bearing public error (SEC-005: never the raw exception). */
function defaultInternalErrorSink(context: DelegatedToolsInternalErrorContext): void {
  // eslint-disable-next-line no-console
  console.error(`[@jini-ai/http-kit] internal error (${context.source}, correlationId=${context.correlationId})`, context.error);
}

function reportInternalError(
  deps: DelegatedToolsHttpDeps,
  source: DelegatedToolsInternalErrorContext['source'],
  error: unknown,
  runId: string,
  toolId: string,
): ReturnType<typeof createApiError> {
  const correlationId = randomUUID();
  const sink = deps.onInternalError ?? defaultInternalErrorSink;
  sink({ source, runId, toolId, correlationId, error });
  return createApiError('INTERNAL_ERROR', 'an internal error occurred', { requestId: correlationId });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireNonEmptyString(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function parseDelegatedToolExecute(input: RouteInputContext): Result<DelegatedToolExecuteRequest> {
  if (!isRecord(input.body)) return err(validationError('body must be a JSON object'));

  const runId = requireNonEmptyString(input.body, 'runId');
  if (runId === undefined) {
    return err(validationError('runId must be a non-empty string', [{ path: 'runId', message: 'required non-empty string' }]));
  }
  const toolUseId = requireNonEmptyString(input.body, 'toolUseId');
  if (toolUseId === undefined) {
    return err(validationError('toolUseId must be a non-empty string', [{ path: 'toolUseId', message: 'required non-empty string' }]));
  }
  const toolId = requireNonEmptyString(input.body, 'toolId');
  if (toolId === undefined) {
    return err(validationError('toolId must be a non-empty string', [{ path: 'toolId', message: 'required non-empty string' }]));
  }
  // Spread-in rather than always-present so an unconstrained body parses to exactly the object it
  // parsed to before this field existed — the existing gateway's request shape is byte-identical,
  // which is what the "additive only" constraint means at the wire.
  //
  // Only a literal `true` arms the constraint. Anything else (absent, `false`, a truthy string) is
  // "unconstrained", never a parse error: this field can only ever TIGHTEN a call, so a malformed
  // value that fell through to the normal gateway is the same outcome as not sending it at all.
  const requireReadOnly = input.body['requireReadOnly'] === true ? { requireReadOnly: true } : {};
  return ok({ runId, toolUseId, toolId, input: input.body.input, ...requireReadOnly });
}

/**
 * Maps a settled `ToolExecutionResult` to the wire `Result` — the same status mapping
 * `db-ops.ts`'s `toolResultToApiResult` establishes for this identical `ToolExecutionResult`
 * union, kept consistent here rather than reinvented: `completed` → `200 {result}`,
 * `denied`/`confirmation-denied` → `403 TOOL_OPERATION_DENIED`, `timed-out`/`cancelled` → a
 * SEC-005-redacted `500 INTERNAL_ERROR` (the real status/error goes to `onInternalError`, never the
 * wire).
 *
 * `failed` splits in two, on `result.errorKind` (`@jini-ai/daemon`'s `ToolExecutor` sets it from
 * whether the handler threw `@jini-ai/core`'s `ToolInputError`): `'validation'` means the CALLER's
 * input was the problem — a wrong/missing/malformed field name, a `themeId` that doesn't exist, a
 * path escaping its theme — so it is reported as a real `400 BAD_REQUEST` carrying the handler's own
 * actionable message (the same one a model reads to retry correctly), not redacted. Everything else
 * (`'internal'`, or no `errorKind` at all — e.g. an older `ToolExecutor` build) stays the SEC-005
 * redacted 500 path, because a handler that threw for a reason OTHER than "your input was bad" can
 * embed exactly the kind of internal detail that path exists to keep off the wire.
 */
function toolExecutionResultToApiResult(
  deps: DelegatedToolsHttpDeps,
  runId: string,
  toolId: string,
  result: ToolExecutionResult,
): Result<DelegatedToolExecuteResponse> {
  switch (result.status) {
    case 'completed':
      return ok({ result });
    case 'denied':
      return err(createApiError('TOOL_OPERATION_DENIED', 'this operation was denied by policy'));
    case 'confirmation-denied':
      return err(createApiError('TOOL_OPERATION_DENIED', 'this operation was denied during confirmation'));
    case 'timed-out':
    case 'cancelled':
      return err(reportInternalError(deps, 'delegated-tool-execute', result.status, runId, toolId));
    case 'failed':
      if (result.errorKind === 'validation') {
        return err(createApiError('BAD_REQUEST', result.error ?? 'invalid tool input'));
      }
      return err(reportInternalError(deps, 'delegated-tool-execute', result.error ?? result.status, runId, toolId));
  }
}

/**
 * `POST /api/delegated-tool-calls` — executes one delegated tool call against an already-started
 * run. Maps `ToolExecutionResult.status` to the HTTP response via `toolExecutionResultToApiResult`
 * above — mirroring `db-ops.ts`'s precedent for the identical status union rather than treating
 * every business outcome as a `200`. A genuinely unexpected throw (an unregistered `toolId` — a
 * routing/programming error per `ToolExecutor.execute`'s own contract — or a race where the run
 * became terminal between this route's existence check and the bridge's first emitted event)
 * reaches the same SEC-005 redaction path.
 */
export const delegatedToolExecuteRoute = defineJsonRoute<
  DelegatedToolExecuteRequest,
  DelegatedToolExecuteResponse,
  DelegatedToolsHttpDeps
>({
  method: 'post',
  path: '/api/delegated-tool-calls',
  requireSameOrigin: true,
  parse: parseDelegatedToolExecute,
  handle: async (input, deps, signal) => {
    const run = await deps.lifecycle.get(input.runId);
    if (run === undefined) {
      return err(createApiError('NOT_FOUND', `run "${input.runId}" was not found`));
    }

    // Before `resolvePrincipal`, and long before the bridge: a refused call must cost nothing
    // downstream and must leave no trace of an execution that was never going to happen. It sits
    // after the run-existence check only so that a bad `runId` still answers 404 the way it always
    // did, regardless of the constraint.
    const readOnlyRefusal = checkReadOnlyConstraint(deps, input);
    if (readOnlyRefusal !== null) return err(readOnlyRefusal);

    let principal: Principal;
    try {
      principal = await deps.resolvePrincipal(input);
    } catch (error) {
      return err(reportInternalError(deps, 'resolve-principal', error, input.runId, input.toolId));
    }

    const bridge = createDelegatedToolBridge({ lifecycle: deps.lifecycle, toolExecutor: deps.toolExecutor });
    try {
      // `signal` carries the caller's HTTP connection dropping — see `mountJsonRoute`
      // (`adapter.ts`). The bridge already combines it with the run's own cancellation
      // (`DelegatedToolInvocation.signal`'s doc); this is the wire that was missing, not new
      // behaviour in the bridge or `ToolExecutor`.
      const result = await bridge.execute({
        runId: input.runId,
        toolUseId: input.toolUseId,
        toolId: input.toolId,
        principal,
        input: input.input,
        ...(signal !== undefined ? { signal } : {}),
      });
      return toolExecutionResultToApiResult(deps, input.runId, input.toolId, result);
    } catch (error) {
      return err(reportInternalError(deps, 'delegated-tool-execute', error, input.runId, input.toolId));
    }
  },
});

/** Mounts `POST /api/delegated-tool-calls` on `app`. A pack's `http(app, services)` calls this directly. */
export function registerDelegatedToolRoutes(app: Express, deps: DelegatedToolsHttpDeps, adapter: AdapterContext): void {
  mountJsonRoute(app, delegatedToolExecuteRoute, deps, adapter);
}
