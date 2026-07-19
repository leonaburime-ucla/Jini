import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { definePack } from '@jini/core';
import type { express as HttpExpress } from '@jini/http';
import { createLocalNodeDaemon, type LocalNodeDaemon } from '../create-local-node-daemon.js';

/**
 * Smoke coverage for `transport: 'fastify'` — proves the branch added to
 * `createLocalNodeDaemon` actually boots a real Fastify server (not Express with the flag
 * silently ignored), by exercising the same handful of request shapes the sibling
 * `create-local-node-daemon.test.ts` suite already exhaustively covers for the default
 * (`'express'`/omitted) transport: a caller pack's own route, `GET /api/daemon/status`, a bearer
 * 401 when a token is configured, and `stop()`. This file intentionally does NOT re-derive every
 * edge case from that suite (origin-guard branch matrix, EADDRINUSE, onShutdown ordering, etc.) —
 * that logic lives in the transport-agnostic boot-completion tail both branches share, and is
 * already fully exercised via the default transport. What is NOT yet covered here (left for a
 * follow-up pass, see the branch's handoff note): the loopback-vs-non-loopback 401 branch (the
 * sibling suite's `findExternalIPv4Address()`-gated test was not duplicated for Fastify), and the
 * Fastify-specific `.listen()` rejection paths (EADDRINUSE, invalid port) analogous to the
 * Express branch's own `app.listen()` throw/`'error'`-event tests.
 *
 * Important finding from writing this suite: `makePingPack()` below is deliberately NOT the same
 * fixture the sibling suite uses — that one's handler calls Express's `res.json(...)`, which does
 * not exist on a Fastify `reply` and throws (surfaced by Fastify as a 500) if mounted as-is. This
 * is expected, not a `mountPackHttp` bug: `mountPackHttp` only ever forwards `app` straight
 * through, unmodified, to a pack's own `http(app, services)` registrar, so the registrar itself
 * still receives a transport-specific `app`/response API. A pack that wants to run under both
 * transports must either branch on the app shape itself or (better) be written against
 * `@jini/http`'s own `defineJsonRoute`/`mountJsonRoute` from the matching namespace instead of
 * hand-rolling `app.get(path, handler)` calls the way this test fixture (and OD's own existing
 * packs, most likely) does today. See this suite's own `makePingPack()` doc for the concrete
 * before/after.
 */
const ENV_KEYS = ['JINI_API_TOKEN', 'JINI_DISABLE_API_AUTH', 'JINI_ALLOWED_ORIGINS', 'JINI_WEB_PORT', 'JINI_BIND_HOST'] as const;
let savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string>>;

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    const value = process.env[key];
    if (value !== undefined) savedEnv[key] = value;
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, savedEnv);
});

const tempDirs: string[] = [];
function makeTempDataDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'jini-node-host-fastify-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

const daemonsToStop: LocalNodeDaemon[] = [];
afterEach(async () => {
  while (daemonsToStop.length > 0) {
    const daemon = daemonsToStop.pop();
    if (daemon) await daemon.stop().catch(() => {});
  }
});

/**
 * A Fastify-shaped ping pack — deliberately NOT the same fixture the sibling
 * `create-local-node-daemon.test.ts` suite uses for the Express-default transport. That fixture's
 * handler calls `res.json(...)`, an Express `Response` method with no Fastify equivalent (Fastify's
 * `reply` has `.send(...)`, which auto-serializes a plain object to JSON with a 200 default status)
 * — mounting an Express-shaped pack handler on a raw Fastify instance throws inside the handler,
 * which Fastify's own default error handler turns into a 500. This is expected, not a bug in
 * `mountPackHttp` (which only ever forwards `app` straight through, unmodified, to the pack's own
 * registrar) — `mountPackHttp` being transport-agnostic does NOT make an individual pack's
 * hand-rolled route registration code transport-portable; only packs written against
 * `@jini/http`'s own `defineJsonRoute`/`mountJsonRoute` (from the matching `express`/`fastify`
 * namespace) get that portability for free. See this file's own top-of-module doc.
 */
function makePingPack() {
  return definePack({
    name: 'ping',
    deps: [],
    services: () => ({}),
    http: (app: unknown) => {
      (app as { get: (path: string, handler: (req: unknown, reply: { send: (b: unknown) => void }) => void) => void }).get(
        '/api/ping',
        (_req, reply) => reply.send({ ok: true }),
      );
    },
  });
}

describe('createLocalNodeDaemon({ transport: "fastify" })', () => {
  it('boots a real Fastify server on an ephemeral port and reports a URL reflecting the real bound port', async () => {
    const dataDir = makeTempDataDir();
    const daemon = await createLocalNodeDaemon({ dataDir, packs: [makePingPack()], transport: 'fastify' });
    daemonsToStop.push(daemon);

    expect(daemon.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    const port = Number(new URL(daemon.url).port);
    expect(port).toBeGreaterThan(0);
    const address = daemon.server.address();
    expect(address && typeof address === 'object' ? address.port : null).toBe(port);
  });

  it("mounts a caller pack's own route through the Fastify adapter (proves mountPackHttp works identically for both transports)", async () => {
    const dataDir = makeTempDataDir();
    const daemon = await createLocalNodeDaemon({ dataDir, packs: [makePingPack()], transport: 'fastify' });
    daemonsToStop.push(daemon);

    const res = await fetch(`${daemon.url}/api/ping`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('serves GET /api/daemon/status through the Fastify daemon-status routes', async () => {
    const dataDir = makeTempDataDir();
    const daemon = await createLocalNodeDaemon({ dataDir, packs: [makePingPack()], transport: 'fastify' });
    daemonsToStop.push(daemon);

    const res = await fetch(`${daemon.url}/api/daemon/status`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as HttpExpress.DaemonStatusResponse;
    expect(body).toMatchObject({ ok: true, host: '127.0.0.1', dataDir, shuttingDown: false });
    expect(typeof body.version).toBe('string');
    expect(body.port).toBe(Number(new URL(daemon.url).port));
  });

  it('allows a loopback caller with a correct bearer token when apiToken is configured (Fastify onRequest hook gate)', async () => {
    process.env.JINI_API_TOKEN = 'integration-secret';
    const dataDir = makeTempDataDir();
    const daemon = await createLocalNodeDaemon({ dataDir, packs: [makePingPack()], transport: 'fastify' });
    daemonsToStop.push(daemon);

    const res = await fetch(`${daemon.url}/api/ping`, { headers: { Authorization: 'Bearer integration-secret' } });
    expect(res.status).toBe(200);
  });

  it('rejects a disallowed cross-origin POST with 403 (Fastify onRequest origin-guard hook)', async () => {
    const dataDir = makeTempDataDir();
    const daemon = await createLocalNodeDaemon({ dataDir, packs: [makePingPack()], transport: 'fastify' });
    daemonsToStop.push(daemon);

    const res = await fetch(`${daemon.url}/api/ping`, {
      method: 'POST',
      headers: { Origin: 'https://evil.example.com' },
    });
    expect(res.status).toBe(403);
  });

  it('stop() closes the Fastify-backed listener: a post-stop fetch rejects', async () => {
    const dataDir = makeTempDataDir();
    const daemon = await createLocalNodeDaemon({ dataDir, packs: [makePingPack()], transport: 'fastify' });

    await daemon.stop();
    await expect(fetch(`${daemon.url}/api/ping`)).rejects.toThrow();
  });

  it('the POST /api/daemon/shutdown route triggers the same graceful stop() for the Fastify transport', async () => {
    const dataDir = makeTempDataDir();
    const daemon = await createLocalNodeDaemon({ dataDir, packs: [makePingPack()], transport: 'fastify' });

    const shutdownRes = await fetch(`${daemon.url}/api/daemon/shutdown`, { method: 'POST' });
    expect(shutdownRes.status).toBe(200);
    expect(await shutdownRes.json()).toEqual({ ok: true, scheduled: true });

    await vi.waitFor(
      async () => {
        await expect(fetch(`${daemon.url}/api/ping`)).rejects.toThrow();
      },
      { timeout: 2000 },
    );
  });
});
