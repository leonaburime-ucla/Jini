/**
 * @module daemon-status
 *
 * Generic daemon status + shutdown routes, ported from an origin daemon's
 * status/shutdown route pair — see `source-map.md`'s routes-classification
 * table for the full origin file's MIXED verdict and exact provenance. Only
 * the product-neutral half of that file is here: the origin's plugin-count
 * field, a product-specific config-dir path, and a sandbox-mode flag were all
 * dropped rather than carried over, since none of those concepts exist in the
 * engine kernel. Everything a caller needs is injected via `DaemonStatusDeps`
 * rather than read from globals, so this module has no dependency on any
 * particular process/runtime wiring.
 */
import type { Express } from 'express';
import { defineJsonRoute, mountJsonRoute, type AdapterContext } from './adapter.js';
import { ok } from './types.js';

/**
 * Everything the two routes below need, supplied by the caller. `requestShutdown`
 * is a callback rather than this module calling `process.emit('SIGTERM')`
 * directly, because whether that actually terminates the process depends on a
 * listener the caller (not this package) is responsible for registering — see
 * the origin file's own comment on this being a best-effort signal, not a
 * guaranteed one.
 */
export interface DaemonStatusDeps {
  /** Resolves the running daemon's version string. May be sync or async. */
  getVersion: () => Promise<string> | string;
  /** The host the daemon is bound to, echoed back verbatim. */
  host: string;
  /** Returns the daemon's resolved listen port. */
  getPort: () => number;
  /** The daemon's data directory, echoed back verbatim. */
  dataDir: string;
  /** Returns whether a shutdown has already been requested. */
  isShuttingDown: () => boolean;
  /** Invoked (after the response is sent) when a shutdown is requested. */
  requestShutdown: () => void;
}

export interface DaemonStatusResponse {
  ok: true;
  version: string;
  host: string;
  port: number;
  dataDir: string;
  shuttingDown: boolean;
  pid: number;
}

export interface DaemonShutdownResponse {
  ok: true;
  scheduled: true;
}

/**
 * `GET /api/daemon/status` — a health-check callers can poll to confirm the
 * daemon is up and to read its version/host/port/data-dir/shutdown state.
 */
export const daemonStatusRoute = defineJsonRoute<void, DaemonStatusResponse, DaemonStatusDeps>({
  method: 'get',
  path: '/api/daemon/status',
  parse: () => ok(undefined),
  handle: async (_input, deps) => {
    const version = await deps.getVersion();
    return ok({
      ok: true,
      version,
      host: deps.host,
      port: deps.getPort(),
      dataDir: deps.dataDir,
      shuttingDown: deps.isShuttingDown(),
      pid: process.pid,
    });
  },
});

/**
 * `POST /api/daemon/shutdown` — schedules a graceful shutdown. Responds
 * immediately (matching the origin's behavior) and defers the actual
 * `requestShutdown()` call via `setImmediate` so the response has already been
 * written before whatever the caller's shutdown callback does takes effect.
 * Gated same-origin: this is a control-plane action, not a public read.
 */
export const daemonShutdownRoute = defineJsonRoute<void, DaemonShutdownResponse, DaemonStatusDeps>({
  method: 'post',
  path: '/api/daemon/shutdown',
  requireSameOrigin: true,
  parse: () => ok(undefined),
  handle: (_input, deps) => {
    setImmediate(() => {
      try {
        deps.requestShutdown();
      } catch {
        // Best-effort: if the caller's shutdown wiring is already gone, there's
        // nothing left for this route to do about it.
      }
    });
    return ok({ ok: true, scheduled: true });
  },
});

/** Mounts both daemon-status routes on `app`. A pack's `http(app, services)` calls this directly. */
export function registerDaemonStatusRoutes(
  app: Express,
  deps: DaemonStatusDeps,
  adapter: AdapterContext,
): void {
  mountJsonRoute(app, daemonStatusRoute, deps, adapter);
  mountJsonRoute(app, daemonShutdownRoute, deps, adapter);
}
