/**
 * Generic HTTP/SSE projection of the kernel RunLifecycle. The routes own no
 * agent, tool, or product vocabulary: a host optionally supplies `onStarted`
 * to attach its chosen driver after the lifecycle has durably recorded start.
 */
import type { Express, Request, Response } from 'express';
import { createApiError, type RunProtocolEvent, type RunStatus } from '@jini/protocol';
import type { RunLifecycle, StartRunInput } from '@jini/daemon';
import { defineJsonRoute, mountJsonRoute, type AdapterContext } from './adapter.js';
import { validationError } from './request.js';
import { sendApiError } from './response.js';
import { err, ok, type Result, type RouteInputContext } from './types.js';

export interface RunCreateRequest {
  readonly contextRef: string;
  readonly agentId?: string;
  readonly idempotencyKey?: string;
}

export interface RunStartContext {
  readonly request: RunCreateRequest;
  readonly run: RunStatus;
  /** The lifecycle this driver must use for emitted events, cancellation observation, and terminal completion. */
  readonly lifecycle: RunLifecycle;
}

/** Host-owned execution hook. It attaches a driver only after a durable run has been created. */
export type RunStartHandler = (context: RunStartContext) => Promise<void> | void;

export interface RunHttpDeps {
  readonly lifecycle: RunLifecycle;
  readonly onStarted?: RunStartHandler;
}

export interface RunStartResponse {
  readonly run: RunStatus;
  readonly started: boolean;
}

export interface RunStatusResponse {
  readonly run: RunStatus;
}

export interface RunCancelResponse {
  readonly run: RunStatus;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(body: Record<string, unknown>, key: string): string | undefined | null {
  const value = body[key];
  if (value === undefined) return undefined;
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function parseRunCreate(input: RouteInputContext): Result<RunCreateRequest> {
  if (!isRecord(input.body)) return err(validationError('body must be a JSON object'));
  const contextRef = optionalString(input.body, 'contextRef');
  if (contextRef === undefined || contextRef === null) {
    return err(validationError('contextRef must be a non-empty string', [{ path: 'contextRef', message: 'required non-empty string' }]));
  }
  const agentId = optionalString(input.body, 'agentId');
  const idempotencyKey = optionalString(input.body, 'idempotencyKey');
  if (agentId === null || idempotencyKey === null) {
    return err(validationError('optional string fields must be non-empty when provided'));
  }
  return ok({
    contextRef,
    ...(agentId === undefined ? {} : { agentId }),
    ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
  });
}

function parseRunId(input: RouteInputContext): Result<string> {
  const runId = input.params.runId;
  return typeof runId === 'string' && runId.length > 0
    ? ok(runId)
    : err(validationError('runId must be a non-empty path parameter'));
}

function parseRunCancel(input: RouteInputContext): Result<{ runId: string; reason?: string }> {
  const parsedRunId = parseRunId(input);
  if (!parsedRunId.ok) return parsedRunId;
  if (input.body === undefined || input.body === null) return ok({ runId: parsedRunId.value });
  if (!isRecord(input.body)) return err(validationError('body must be a JSON object when provided'));
  const reason = optionalString(input.body, 'reason');
  if (reason === null) return err(validationError('reason must be a non-empty string when provided'));
  return ok({ runId: parsedRunId.value, ...(reason === undefined ? {} : { reason }) });
}

export const runStartRoute = defineJsonRoute<RunCreateRequest, RunStartResponse, RunHttpDeps>({
  method: 'post',
  path: '/api/runs',
  requireSameOrigin: true,
  parse: parseRunCreate,
  handle: async (input, deps) => {
    const startInput: StartRunInput = input;
    const started = await deps.lifecycle.start(startInput);
    if (started.started && deps.onStarted) {
      try {
        await deps.onStarted({ request: input, run: started.run, lifecycle: deps.lifecycle });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await deps.lifecycle.finish({ runId: started.run.id, status: 'failed', code: null, signal: null, resumable: false });
        return err(createApiError('INTERNAL_ERROR', `run driver failed to start: ${message}`));
      }
    }
    // A host-owned driver may finish immediately (for example, a single-step
    // run). Return the lifecycle's current view rather than the snapshot
    // captured before invoking that driver.
    const run = (await deps.lifecycle.get(started.run.id)) ?? started.run;
    return ok({ run, started: started.started });
  },
  successStatus: 201,
});

export const runStatusRoute = defineJsonRoute<string, RunStatusResponse, RunHttpDeps>({
  method: 'get',
  path: '/api/runs/:runId',
  parse: parseRunId,
  handle: async (runId, deps) => {
    const run = await deps.lifecycle.get(runId);
    return run === undefined ? err(createApiError('NOT_FOUND', `run "${runId}" was not found`)) : ok({ run });
  },
});

export const runCancelRoute = defineJsonRoute<{ runId: string; reason?: string }, RunCancelResponse, RunHttpDeps>({
  method: 'post',
  path: '/api/runs/:runId/cancel',
  requireSameOrigin: true,
  parse: parseRunCancel,
  handle: async (input, deps) => {
    const run = await deps.lifecycle.get(input.runId);
    if (run === undefined) return err(createApiError('NOT_FOUND', `run "${input.runId}" was not found`));
    return ok({ run: await deps.lifecycle.cancel(input) });
  },
});

function requestedAfterCursor(req: Request): string | null {
  const header = req.get('last-event-id');
  if (header && header.length > 0) return header;
  const query = req.query.afterCursor;
  return typeof query === 'string' && query.length > 0 ? query : null;
}

function writeSseEvent(res: Response, event: RunProtocolEvent): void {
  res.write(`id: ${event.opaqueCursor}\nevent: ${event.kind}\ndata: ${JSON.stringify(event)}\n\n`);
}

function sendStreamFailure(res: Response, kind: Exclude<Awaited<ReturnType<RunLifecycle['stream']>>, { kind: 'ok' }>): void {
  if (kind.kind === 'unknown-run') {
    sendApiError(res, 404, createApiError('NOT_FOUND', 'run was not found'));
    return;
  }
  if (kind.kind === 'invalid-cursor') {
    sendApiError(res, 400, createApiError('BAD_REQUEST', `invalid replay cursor "${kind.requestedCursor}"`));
    return;
  }
  sendApiError(
    res,
    409,
    createApiError('CONFLICT', `replay gap after cursor "${kind.requestedCursor}"`, {
      details: { oldestAvailableCursor: kind.oldestAvailableCursor },
    }),
  );
}

/** `GET /api/runs/:runId/events` — canonical events as SSE, with Last-Event-ID reconnect support. */
export function registerRunEventStream(app: Express, deps: RunHttpDeps): void {
  app.get('/api/runs/:runId/events', async (req: Request, res: Response) => {
    const runId = req.params.runId;
    if (typeof runId !== 'string' || runId.length === 0) {
      sendApiError(res, 400, createApiError('BAD_REQUEST', 'runId must be a non-empty path parameter'));
      return;
    }

    const pending: RunProtocolEvent[] = [];
    let readyToWrite = false;
    let unsubscribe: (() => void) | null = null;
    const deliver = (event: RunProtocolEvent) => {
      if (!readyToWrite) {
        pending.push(event);
        return;
      }
      writeSseEvent(res, event);
      if (event.kind === 'end') {
        unsubscribe?.();
        res.end();
      }
    };

    try {
      const subscribed = await deps.lifecycle.stream(runId, deliver, { afterCursor: requestedAfterCursor(req) });
      if (subscribed.kind !== 'ok') {
        sendStreamFailure(res, subscribed);
        return;
      }
      const stopSubscription = subscribed.unsubscribe;
      unsubscribe = stopSubscription;
      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
      readyToWrite = true;
      for (const event of pending) writeSseEvent(res, event);

      if (pending.some((event) => event.kind === 'end')) {
        stopSubscription();
        res.end();
        return;
      }

      res.on('close', () => unsubscribe?.());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!res.headersSent) sendApiError(res, 500, createApiError('INTERNAL_ERROR', message));
      else res.end();
    }
  });
}

/** Mounts create/status/cancel JSON endpoints and the SSE event stream as one run transport. */
export function registerRunRoutes(app: Express, deps: RunHttpDeps, adapter: AdapterContext): void {
  mountJsonRoute(app, runStartRoute, deps, adapter);
  mountJsonRoute(app, runStatusRoute, deps, adapter);
  mountJsonRoute(app, runCancelRoute, deps, adapter);
  registerRunEventStream(app, deps);
}
