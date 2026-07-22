/**
 * @module terminals
 *
 * Interactive-terminal HTTP surface, mirroring OD's
 * `apps/daemon/src/routes/terminal.ts` (`/api/projects/:id/terminals` +
 * `.../:tid/{stream,stdin,resize,kill}`) generalized under `/api/terminals`.
 * See `ADS-memory/reports/proposals/PROP-http-route-packs-terminal-pty-2026-07-21.md`
 * for the design discussion and `@jini/daemon`'s `terminal-session.ts` module
 * doc for the session-ownership/gating decisions this route pack calls into.
 *
 * This file is deliberately thin — no PTY spawning, no session registry, no
 * ownership logic lives here (that is `@jini/daemon`'s `TerminalSessionManager`,
 * injected as `deps.manager`). This package only:
 *
 * - Resolves a `POST /api/terminals` request's `resourceRef` to a spawn `cwd`
 *   via `workspace-root.ts` (the same port `host-tools.ts`'s open-in route
 *   uses), then routes creation through `deps.toolExecutor.execute(...,
 *   'terminal.create', ...)` — the one call `@jini/daemon`'s module gates by
 *   policy (matching `db-ops.ts`'s tool-execution-boundary precedent).
 * - Routes `stdin`/`resize`/`kill`/`stream` directly to `deps.manager`'s
 *   lighter, session-ownership-checked methods — deliberately **not** through
 *   `ToolExecutor` again (see the daemon module's doc for why a full
 *   authorize/confirm round-trip per keystroke would make a terminal
 *   unusable).
 * - Adapts `deps.manager.attach`'s push/end sink to `sse.ts`'s generic SSE
 *   channel, the same way `runs.ts` adapts `RunLifecycle.stream`.
 */
import { randomUUID } from 'node:crypto';
import type { Express, Request, Response } from 'express';
import type { Principal } from '@jini/core';
import type {
  TerminalSessionActionResult,
  TerminalSessionInfo,
  TerminalSessionManager,
  TerminalSseSink,
} from '@jini/daemon';
import { TERMINAL_CREATE_TOOL_ID } from '@jini/daemon';
import type { ToolExecutionResult, ToolExecutor } from '@jini/daemon';
import { createApiError } from '@jini/protocol';
import { defineJsonRoute, mountJsonRoute, type AdapterContext } from './adapter.js';
import { validationError } from './request.js';
import { sendApiError } from './response.js';
import { createSseChannel, requestedAfterCursor, type SseEvent } from './sse.js';
import { denyAllWorkspaceRoots, resolveWorkspaceRoot, WorkspaceRootDeniedError, type WorkspaceRootResolver } from './workspace-root.js';
import { err, ok, type Result, type RouteInputContext } from './types.js';

/** Diagnostic detail for an internal-error response the public API deliberately does not disclose (SEC-005, matching `runs.ts`/`db-ops.ts`): a spawn failure (e.g. a missing/uncompiled native addon) can embed executable paths or host detail. */
export interface TerminalsInternalErrorContext {
  readonly source: 'terminal-create';
  readonly correlationId: string;
  readonly error: unknown;
}

function defaultTerminalsInternalErrorSink(context: TerminalsInternalErrorContext): void {
  // eslint-disable-next-line no-console
  console.error(`[@jini/http] internal error (${context.source}, correlationId=${context.correlationId})`, context.error);
}

/** Everything this route pack needs from the host. */
export interface TerminalsHttpDeps {
  readonly manager: TerminalSessionManager;
  readonly toolExecutor: ToolExecutor;
  /** The identity these routes act as — same fixed, host-supplied-value shape as `db-ops.ts`'s `DaemonDbHttpDeps.principal` (this transport has no session/identity subsystem of its own). */
  readonly principal: Principal;
  /** Resolves a `resourceRef` to a spawn working directory. Defaults to {@link denyAllWorkspaceRoots} — a host that never wires a real resolver gets a 404 on every create call, never a guessed path (see `workspace-root.ts`). */
  readonly resolveRoot?: WorkspaceRootResolver;
  /** Host-owned sink for the real exception behind a generic `INTERNAL_ERROR` response (SEC-005). Defaults to `console.error`. */
  readonly onInternalError?: (context: TerminalsInternalErrorContext) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Every one-off `terminal.create` tool call gets its own opaque `RunRef` — matching `db-ops.ts`'s `freshRun()`: these are single requests, not steps of a longer-lived agent run. */
function freshRun(): { readonly id: string } {
  return { id: randomUUID() };
}

function toolResultToApiResult(deps: TerminalsHttpDeps, result: ToolExecutionResult): Result<TerminalSessionInfo> {
  switch (result.status) {
    case 'completed':
      return ok(result.output as TerminalSessionInfo);
    case 'denied':
      return err(createApiError('TOOL_OPERATION_DENIED', 'this operation was denied by policy'));
    case 'confirmation-denied':
      return err(createApiError('TOOL_OPERATION_DENIED', 'this operation was denied during confirmation'));
    case 'timed-out':
    case 'cancelled':
    case 'failed': {
      const correlationId = randomUUID();
      const sink = deps.onInternalError ?? defaultTerminalsInternalErrorSink;
      sink({ source: 'terminal-create', correlationId, error: result.status === 'failed' ? result.error : result.status });
      return err(createApiError('INTERNAL_ERROR', 'an internal error occurred', { requestId: correlationId }));
    }
  }
}

export interface TerminalCreateRequest {
  readonly resourceRef: string;
  readonly detail?: string;
  readonly cols?: number;
  readonly rows?: number;
  readonly shell?: string;
}

function parseTerminalCreate(input: RouteInputContext): Result<TerminalCreateRequest> {
  if (!isRecord(input.body)) return err(validationError('body must be a JSON object'));
  const resourceRef = input.body.resourceRef;
  if (typeof resourceRef !== 'string' || resourceRef.length === 0) {
    return err(validationError('resourceRef is required', [{ path: 'resourceRef', message: 'required non-empty string' }]));
  }
  const detail = input.body.detail;
  if (detail !== undefined && (typeof detail !== 'string' || detail.length === 0)) {
    return err(validationError('detail must be a non-empty string when provided'));
  }
  const cols = input.body.cols;
  if (cols !== undefined && typeof cols !== 'number') {
    return err(validationError('cols must be a number when provided'));
  }
  const rows = input.body.rows;
  if (rows !== undefined && typeof rows !== 'number') {
    return err(validationError('rows must be a number when provided'));
  }
  const shell = input.body.shell;
  if (shell !== undefined && (typeof shell !== 'string' || shell.length === 0)) {
    return err(validationError('shell must be a non-empty string when provided'));
  }
  return ok({
    resourceRef,
    ...(detail === undefined ? {} : { detail }),
    ...(cols === undefined ? {} : { cols }),
    ...(rows === undefined ? {} : { rows }),
    ...(shell === undefined ? {} : { shell }),
  });
}

/**
 * `POST /api/terminals` — the one gated call (see module doc). Resolves
 * `resourceRef` to a working directory the same way `host-tools.ts`'s
 * open-in route does, then authorizes+spawns the session through
 * `ToolExecutor.execute(..., 'terminal.create', ...)`.
 */
export const terminalCreateRoute = defineJsonRoute<TerminalCreateRequest, TerminalSessionInfo, TerminalsHttpDeps>({
  method: 'post',
  path: '/api/terminals',
  requireSameOrigin: true,
  parse: parseTerminalCreate,
  handle: async (input, deps) => {
    let cwd: string;
    try {
      cwd = await resolveWorkspaceRoot(
        { resourceRef: input.resourceRef, ...(input.detail === undefined ? {} : { detail: input.detail }) },
        { resolver: deps.resolveRoot ?? denyAllWorkspaceRoots },
      );
    } catch (error) {
      if (error instanceof WorkspaceRootDeniedError) {
        return err(createApiError('NOT_FOUND', `resource "${input.resourceRef}" was not found`));
      }
      throw error;
    }
    const toolInput = {
      resourceRef: input.resourceRef,
      cwd,
      ...(input.cols === undefined ? {} : { cols: input.cols }),
      ...(input.rows === undefined ? {} : { rows: input.rows }),
      ...(input.shell === undefined ? {} : { shell: input.shell }),
    };
    const result = await deps.toolExecutor.execute(deps.principal, freshRun(), TERMINAL_CREATE_TOOL_ID, toolInput);
    return toolResultToApiResult(deps, result);
  },
  successStatus: 201,
});

export interface TerminalListResponse {
  readonly terminals: readonly TerminalSessionInfo[];
}

function parseTerminalList(input: RouteInputContext): Result<{ resourceRef?: string }> {
  const value = input.query.resourceRef;
  if (value === undefined) return ok({});
  if (typeof value !== 'string' || value.length === 0) {
    return err(validationError('resourceRef must be a non-empty string when provided'));
  }
  return ok({ resourceRef: value });
}

/** `GET /api/terminals` — sessions the calling principal owns, optionally narrowed by `resourceRef`. Never gated through `ToolExecutor` — a read scoped to the caller's own sessions, matching `runs.ts`'s `runListRoute` precedent. */
export const terminalListRoute = defineJsonRoute<{ resourceRef?: string }, TerminalListResponse, TerminalsHttpDeps>({
  method: 'get',
  path: '/api/terminals',
  parse: parseTerminalList,
  handle: (input, deps) =>
    ok({ terminals: deps.manager.list(deps.principal, input.resourceRef === undefined ? {} : { resourceRef: input.resourceRef }) }),
});

function parseTerminalId(input: RouteInputContext): Result<string> {
  const id = input.params.id;
  return typeof id === 'string' && id.length > 0 ? ok(id) : err(validationError('id must be a non-empty path parameter'));
}

export interface TerminalActionResponse {
  readonly ok: boolean;
  readonly terminal?: TerminalSessionInfo;
}

function actionResultToApiResult(result: TerminalSessionActionResult, notFoundMessage: string): Result<TerminalActionResponse> {
  if (result.status === 'not-found') return err(createApiError('NOT_FOUND', notFoundMessage));
  return ok({ ok: result.ok, ...(result.session ? { terminal: result.session } : {}) });
}

function parseStdinInput(input: RouteInputContext): Result<{ id: string; data: string }> {
  const parsedId = parseTerminalId(input);
  if (!parsedId.ok) return parsedId;
  if (!isRecord(input.body)) return err(validationError('body must be a JSON object'));
  const data = input.body.data;
  if (typeof data !== 'string') {
    return err(validationError('data (string) is required', [{ path: 'data', message: 'required string' }]));
  }
  return ok({ id: parsedId.value, data });
}

/** `POST /api/terminals/:id/stdin` — writes `data` to the session's pty. Ownership-checked by `deps.manager.write` directly, not re-gated through `ToolExecutor` (see module doc). */
export const terminalStdinRoute = defineJsonRoute<{ id: string; data: string }, TerminalActionResponse, TerminalsHttpDeps>({
  method: 'post',
  path: '/api/terminals/:id/stdin',
  requireSameOrigin: true,
  parse: parseStdinInput,
  handle: async (input, deps) => {
    const result = await deps.manager.write(deps.principal, input.id, input.data);
    return actionResultToApiResult(result, `terminal "${input.id}" was not found`);
  },
});

function parseResizeInput(input: RouteInputContext): Result<{ id: string; cols: number; rows: number }> {
  const parsedId = parseTerminalId(input);
  if (!parsedId.ok) return parsedId;
  if (!isRecord(input.body)) return err(validationError('body must be a JSON object'));
  const cols = Number(input.body.cols);
  const rows = Number(input.body.rows);
  if (!Number.isFinite(cols) || !Number.isFinite(rows)) {
    return err(validationError('cols and rows (numbers) are required'));
  }
  return ok({ id: parsedId.value, cols, rows });
}

/** `POST /api/terminals/:id/resize` — resizes the session's pty. */
export const terminalResizeRoute = defineJsonRoute<{ id: string; cols: number; rows: number }, TerminalActionResponse, TerminalsHttpDeps>({
  method: 'post',
  path: '/api/terminals/:id/resize',
  requireSameOrigin: true,
  parse: parseResizeInput,
  handle: async (input, deps) => {
    const result = await deps.manager.resize(deps.principal, input.id, input.cols, input.rows);
    return actionResultToApiResult(result, `terminal "${input.id}" was not found`);
  },
});

function handleKill(id: string, deps: TerminalsHttpDeps): Promise<Result<TerminalActionResponse>> {
  return deps.manager.kill(deps.principal, id, 'SIGTERM').then((result) => actionResultToApiResult(result, `terminal "${id}" was not found`));
}

/** `POST /api/terminals/:id/kill` — sends `SIGTERM` to the session's pty. */
export const terminalKillRoute = defineJsonRoute<string, TerminalActionResponse, TerminalsHttpDeps>({
  method: 'post',
  path: '/api/terminals/:id/kill',
  requireSameOrigin: true,
  parse: parseTerminalId,
  handle: (id, deps) => handleKill(id, deps),
});

/** `DELETE /api/terminals/:id` — alias for `kill`, matching OD's dual `POST .../kill` / `DELETE` routes. */
export const terminalDeleteRoute = defineJsonRoute<string, TerminalActionResponse, TerminalsHttpDeps>({
  method: 'delete',
  path: '/api/terminals/:id',
  requireSameOrigin: true,
  parse: parseTerminalId,
  handle: (id, deps) => handleKill(id, deps),
});

/** The wire shape `sse.ts`'s generic channel streams for a terminal — the underlying `@jini/platform` event's `id`/`event`/`data` triple, reshaped to `SseEvent`'s `opaqueCursor`/`kind` naming. */
interface TerminalWireEvent extends SseEvent {
  readonly data: unknown;
}

/**
 * `GET /api/terminals/:id/stream` — SSE, with `Last-Event-ID`/`afterCursor`
 * reconnect replay (via `sse.ts`'s `requestedAfterCursor`, the same helper
 * `runs.ts` uses). Adapts `deps.manager.attach`'s push/end
 * `TerminalSseSink` to `sse.ts`'s generic channel, mirroring
 * `registerRunEventStream`'s adaptation of `RunLifecycle.stream`.
 */
export function registerTerminalEventStream(app: Express, deps: TerminalsHttpDeps): void {
  app.get('/api/terminals/:id/stream', (req: Request, res: Response) => {
    const id = req.params.id;
    if (typeof id !== 'string' || id.length === 0) {
      sendApiError(res, 400, createApiError('BAD_REQUEST', 'id must be a non-empty path parameter'));
      return;
    }
    const cursor = requestedAfterCursor(req);
    const lastEventId = cursor === null ? 0 : Number(cursor);

    const channel = createSseChannel<TerminalWireEvent>(res, { isEndEvent: (event) => event.kind === 'exit' });

    // `deps.manager.attach` can call `sink.end()` synchronously, from inside the very call below
    // (an already-exited session's replay path) — before the channel has ever been `open()`ed. If
    // `end()` mapped straight to `channel.end()`, that would end the response with the queued
    // backlog never flushed (headers never even sent). `channelOpened` defers the actual
    // `channel.end()` call until after `open()` has drained whatever `send()` already queued; a
    // later, live `end()` (the session exits while already streaming, well after `open()` ran)
    // still ends the channel immediately, as normal.
    let channelOpened = false;
    let endRequestedBeforeOpen = false;
    const sink: TerminalSseSink = {
      send(event, data, eventId) {
        channel.enqueue({ opaqueCursor: String(eventId), kind: event, data });
      },
      end() {
        if (channelOpened) {
          channel.end();
        } else {
          endRequestedBeforeOpen = true;
        }
      },
    };

    let attachedSink: TerminalSseSink | null = null;
    channel.onClose(() => {
      if (attachedSink) deps.manager.detach(id, attachedSink);
    });

    const result = deps.manager.attach(deps.principal, id, lastEventId, sink);
    if (result === 'not-found') {
      channel.abandon();
      sendApiError(res, 404, createApiError('NOT_FOUND', `terminal "${id}" was not found`));
      return;
    }
    if (result === 'attached') {
      attachedSink = sink;
    }
    channel.open();
    channelOpened = true;
    // Idempotent-safe even if the queued 'exit' event already auto-closed the channel via
    // `isEndEvent` during `open()`'s own drain (`channel.end()` is documented safe to call twice).
    if (endRequestedBeforeOpen) channel.end();
  });
}

/** Mounts every terminal route (`list`/`create`/`stdin`/`resize`/`kill`/`delete`/`stream`) on `app`. A pack's `http(app, services)` calls this directly. */
export function registerTerminalRoutes(app: Express, deps: TerminalsHttpDeps, adapter: AdapterContext): void {
  mountJsonRoute(app, terminalListRoute, deps, adapter);
  mountJsonRoute(app, terminalCreateRoute, deps, adapter);
  mountJsonRoute(app, terminalStdinRoute, deps, adapter);
  mountJsonRoute(app, terminalResizeRoute, deps, adapter);
  mountJsonRoute(app, terminalKillRoute, deps, adapter);
  mountJsonRoute(app, terminalDeleteRoute, deps, adapter);
  registerTerminalEventStream(app, deps);
}
