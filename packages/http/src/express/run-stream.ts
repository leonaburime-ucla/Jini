/**
 * @module express/run-stream
 *
 * Express-specific mounting glue for the shared AG-UI SSE run-stream handler (`../run-stream.js`).
 * Express's `Request`/`Response` already *are* Node's raw `http.IncomingMessage`/
 * `http.ServerResponse` (Express's `Response` extends `http.ServerResponse` directly), so this
 * file's only job is resolving `req.params.runId` and handing the request/response straight
 * through — a few lines, not a reimplementation, per the design decision that motivated building
 * the SSE primitive once instead of duplicating it per transport.
 */
import type { Express, Request, Response } from 'express';
import { handleRunStreamRequest, RUN_STREAM_ROUTE_PATH, type RunStreamDeps } from '../run-stream.js';

/** Mounts the AG-UI SSE run-stream route on `app`. A pack's `http(app, services)` calls this directly. */
export function registerRunStreamRoute(app: Express, deps: RunStreamDeps): void {
  app.get(RUN_STREAM_ROUTE_PATH, async (req: Request, res: Response) => {
    // `:runId` is a required path segment of RUN_STREAM_ROUTE_PATH — this handler is only ever
    // reached via a URL that already matched it, so the param is always present at runtime even
    // though @types/express types every param as possibly `undefined` in general.
    await handleRunStreamRequest(req, res, req.params.runId!, deps);
  });
}
