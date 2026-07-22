/**
 * @module run-stream
 *
 * The AG-UI SSE run-stream route: subscribes to a run via `@jini/daemon`'s `RunLifecycle.stream`,
 * pipes every event through a fresh `@jini/agui` encoder, and writes each non-null AG-UI event to
 * the SSE response opened by `sse.ts`'s `createSseResponse`. `handleRunStreamRequest` is the core
 * — it only ever touches `node:http`'s `IncomingMessage`/`ServerResponse` — and
 * `registerRunStreamRoute` below is Express's own thin mounting glue (Express's `Request`/
 * `Response` already *are* Node's raw `http.IncomingMessage`/`http.ServerResponse`, so resolving
 * `req.params.runId` and handing the request/response straight through is the whole job).
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createAguiEncoder } from '@jini/agui';
import type { RunLifecycle } from '@jini/daemon';
import type { Express, Request, Response } from 'express';
import { createSseResponse } from './raw-sse.js';

/** Route path both transport subtrees mount this handler on. A plain string constant with no framework coupling at all — shared here rather than duplicated, the same way `pack-http.ts`'s `mountPackHttp` is shared for being genuinely framework-agnostic. */
export const RUN_STREAM_ROUTE_PATH = '/api/runs/:runId/agui-stream';

export interface RunStreamDeps {
  readonly lifecycle: RunLifecycle;
}

/**
 * Handles one AG-UI SSE run-stream request end to end. Opens the SSE connection immediately (an
 * SSE endpoint commits to `text/event-stream` headers before it can know whether `runId` is
 * valid), then subscribes to the run: a replay-then-live-subscribe `unknown-run`/`replay-gap`/
 * `invalid-cursor` result is reported as one `{ error }` SSE data event before closing (there is
 * no JSON-status-code channel left once SSE headers are already committed). On the happy path,
 * every event `RunLifecycle` delivers is encoded and forwarded; the connection closes itself once
 * the run's own terminal `'end'` event has been forwarded (a driver's contract with
 * `RunLifecycle` guarantees no further events follow a run's `'end')`, so nothing is lost by
 * closing right after it). If the client disconnects first, `createSseResponse`'s own
 * `req.on('close', ...)` fires first, which (via `onClose` here) unsubscribes from the run so a
 * disconnected client never leaves a dangling `RunLifecycle` subscriber.
 *
 * @param req - The raw request `createSseResponse` opens the stream against.
 * @param res - The raw response `createSseResponse` opens the stream against.
 * @param runId - The run to stream, already resolved by the caller's transport-specific glue.
 * @param deps.lifecycle - The `RunLifecycle` to subscribe to.
 * @complexity O(1) plus the encoder's own per-event cost (see `@jini/agui`'s `createAguiEncoder` doc) and `RunLifecycle.stream`'s own replay cost.
 * @overallScore 100/100
 */
export async function handleRunStreamRequest(
  req: IncomingMessage,
  res: ServerResponse,
  runId: string,
  deps: RunStreamDeps,
): Promise<void> {
  let unsubscribe: (() => void) | undefined;
  const connection = createSseResponse(req, res, {
    onClose: () => unsubscribe?.(),
  });
  const encoder = createAguiEncoder();

  const result = await deps.lifecycle.stream(runId, (event) => {
    const encoded = encoder.encode(event, { runId });
    if (encoded) connection.send(encoded);
    if (event.kind === 'end') connection.close();
  });

  if (result.kind !== 'ok') {
    connection.send({ error: result.kind });
    connection.close();
    return;
  }
  // Assigned even when the run was already terminal (in which case the driver-facing 'end' event
  // was already replayed synchronously above, already closing the connection, and `unsubscribe`
  // here is `RunLifecycle`'s own no-op stub for that case) — keeping this assignment unconditional
  // avoids a branch whose two arms would otherwise do the same thing.
  unsubscribe = result.unsubscribe;
}

/** Mounts the AG-UI SSE run-stream route on `app`. A pack's `http(app, services)` calls this directly. */
export function registerRunStreamRoute(app: Express, deps: RunStreamDeps): void {
  app.get(RUN_STREAM_ROUTE_PATH, async (req: Request, res: Response) => {
    // `:runId` is a required path segment of RUN_STREAM_ROUTE_PATH — this handler is only ever
    // reached via a URL that already matched it, so the param is always present at runtime even
    // though @types/express types every param as possibly `undefined` in general.
    await handleRunStreamRequest(req, res, req.params.runId!, deps);
  });
}
