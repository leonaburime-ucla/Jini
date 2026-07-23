/**
 * @module health
 *
 * `GET /health`, `GET /api/health` (plain liveness — always `200 {ok: true}` once the process is
 * up, no dependency checks), `GET /ready`, `GET /api/ready` (real readiness — delegates to an
 * injected `checkReadiness`, `503` when it reports `ok: false`), and `GET /version`,
 * `GET /api/version` (echoes the running build's version). Both the mount-relative and
 * `/api`-prefixed form of each probe are registered because `api-security-middleware.ts`'s
 * `OPEN_PROBE_PATHS` already anticipated exactly these six paths as always-open (no bearer token,
 * no origin check) — this module is what finally makes that anticipated set of paths real routes
 * instead of an open gate over nothing.
 *
 * **Mount before `express.json()`/the bearer-auth/origin-guard middleware** (see
 * `@jini/node-host`'s `create-local-node-daemon.ts` wiring): these are simple parameterless GETs
 * with no request body, so nothing here needs JSON body-parsing, and a monitoring probe should
 * never need a bearer token or same-origin `Origin` header just to confirm the process is up —
 * the same reasoning `api-security-middleware.ts`'s own doc already gives for exempting these
 * paths.
 *
 * **`daemon-status.ts#daemonStatusRoute`'s own doc previously called `GET /api/daemon/status` "a
 * health-check" — this module is the real, purpose-built answer to that now.** `/api/daemon/status`
 * still exists and still reports version/host/port/data-dir/shutdown state (useful operator
 * detail), but a liveness/readiness monitor should poll `/health`/`/ready` instead: those are
 * unauthenticated by design (see above), `/api/daemon/status` is not gated same-origin either
 * today, but was never *documented* as the liveness contract — see that module's updated doc
 * comment.
 */
import type { Express } from 'express';
import { createApiError } from '@jini/protocol';
import { defineJsonRoute, mountJsonRoute, type AdapterContext } from './adapter.js';
import { err, ok } from './types.js';

export interface HealthReadinessResult {
  readonly ok: boolean;
  readonly checks: Record<string, boolean>;
}

export interface HealthHttpDeps {
  /** Resolves the running build's version string. May be sync or async, matching `daemon-status.ts#DaemonStatusDeps.getVersion`. */
  readonly getVersion: () => Promise<string> | string;
  /** Host-owned readiness probe (e.g. "is the sqlite handle healthy and is the process not mid-shutdown"). Defaults to always-ready (`{ok: true, checks: {}}`) — a host with nothing worth checking gets a working route with no wiring required. */
  readonly checkReadiness?: () => Promise<HealthReadinessResult>;
}

async function defaultCheckReadiness(): Promise<HealthReadinessResult> {
  return { ok: true, checks: {} };
}

export interface LivenessResponse {
  readonly ok: true;
}

export interface ReadinessResponse {
  readonly ok: true;
  readonly checks: Record<string, boolean>;
}

export interface VersionResponse {
  readonly version: string;
}

function livenessRoute(path: string) {
  return defineJsonRoute<void, LivenessResponse, HealthHttpDeps>({
    method: 'get',
    path,
    parse: () => ok(undefined),
    handle: () => ok({ ok: true }),
  });
}

function readinessRoute(path: string) {
  return defineJsonRoute<void, ReadinessResponse, HealthHttpDeps>({
    method: 'get',
    path,
    parse: () => ok(undefined),
    handle: async (_input, deps) => {
      const checkReadiness = deps.checkReadiness ?? defaultCheckReadiness;
      const result = await checkReadiness();
      if (!result.ok) {
        return err(createApiError('SERVICE_UNAVAILABLE', 'service not ready', { details: { checks: result.checks } }));
      }
      return ok({ ok: true, checks: result.checks });
    },
  });
}

function versionRoute(path: string) {
  return defineJsonRoute<void, VersionResponse, HealthHttpDeps>({
    method: 'get',
    path,
    parse: () => ok(undefined),
    handle: async (_input, deps) => ok({ version: await deps.getVersion() }),
  });
}

export const healthRoute = livenessRoute('/health');
export const apiHealthRoute = livenessRoute('/api/health');
export const readyRoute = readinessRoute('/ready');
export const apiReadyRoute = readinessRoute('/api/ready');
export const versionInfoRoute = versionRoute('/version');
export const apiVersionInfoRoute = versionRoute('/api/version');

/** Mounts all six health/readiness/version routes on `app`. Call this before installing `express.json()`/the bearer-auth/origin-guard middleware — see module doc. */
export function registerHealthRoutes(app: Express, deps: HealthHttpDeps, adapter: AdapterContext): void {
  mountJsonRoute(app, healthRoute, deps, adapter);
  mountJsonRoute(app, apiHealthRoute, deps, adapter);
  mountJsonRoute(app, readyRoute, deps, adapter);
  mountJsonRoute(app, apiReadyRoute, deps, adapter);
  mountJsonRoute(app, versionInfoRoute, deps, adapter);
  mountJsonRoute(app, apiVersionInfoRoute, deps, adapter);
}
