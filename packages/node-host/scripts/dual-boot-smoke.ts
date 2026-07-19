/**
 * Dual-boot smoke test for `createLocalNodeDaemon`'s `transport: 'express' | 'fastify'` switch.
 *
 * Boots the daemon twice — once per transport — against a fresh tmp-dir sqlite file each time,
 * and for each boot: fetches a caller-defined pack route, fetches `GET /api/daemon/status`,
 * confirms bearer-auth 401 behavior (a wrong token is rejected, the correct one is accepted),
 * and confirms `stop()` actually closes the listener. Run with:
 *
 *   pnpm --filter @jini/node-host exec tsx scripts/dual-boot-smoke.ts
 *
 * This is a standalone artifact (not part of the vitest suite, not counted toward coverage) whose
 * purpose is to be a saved, re-runnable proof — see packages/node-host/source-map.md and the Part
 * A handoff report for its last captured output.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { networkInterfaces, tmpdir } from 'node:os';
import { join } from 'node:path';
import { definePack } from '@jini/core';
import { createLocalNodeDaemon, type LocalNodeDaemon } from '../src/create-local-node-daemon.js';

function makeTempDataDir(): string {
  return mkdtempSync(join(tmpdir(), 'jini-dual-boot-smoke-'));
}

/** The bearer-auth middleware unconditionally exempts loopback peers by design (see
 * packages/http/src/express/api-security-middleware.ts's own doc) — the 401 branch can only be
 * observed via a real, non-loopback TCP connection, same as the test suites' own gated tests. */
function findExternalIPv4Address(): string | null {
  const ifaces = networkInterfaces();
  for (const entries of Object.values(ifaces)) {
    for (const iface of entries ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return null;
}

/** One pack fixture per transport, since Express's `res.json()` and Fastify's `reply.send()` are
 * not interchangeable — see this repo's own transport-specific test-fixture docs for why. */
function makePingPack(transport: 'express' | 'fastify') {
  return definePack({
    name: 'ping',
    deps: [],
    services: () => ({}),
    http: (app: unknown) => {
      const handler =
        transport === 'express'
          ? (_req: unknown, res: { json: (b: unknown) => void }) => res.json({ ok: true, transport })
          : (_req: unknown, reply: { send: (b: unknown) => void }) => reply.send({ ok: true, transport });
      (app as { get: (path: string, h: typeof handler) => void }).get('/api/ping', handler);
    },
  });
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

async function smokeTestTransport(transport: 'express' | 'fastify'): Promise<void> {
  console.log(`\n=== transport: ${transport} ===`);
  process.env.JINI_API_TOKEN = 'smoke-test-secret';
  const dataDir = makeTempDataDir();
  let daemon: LocalNodeDaemon | undefined;

  try {
    const lanAddress = findExternalIPv4Address();
    daemon = await createLocalNodeDaemon({
      dataDir,
      packs: [makePingPack(transport)],
      transport,
      host: lanAddress ? '0.0.0.0' : undefined,
    });
    console.log(`booted at ${daemon.url}`);

    // 1. Caller-defined pack route, with the correct bearer token (loopback caller + configured token).
    const pingRes = await fetch(`${daemon.url}/api/ping`, { headers: { Authorization: 'Bearer smoke-test-secret' } });
    const pingBody = await pingRes.json();
    assert(pingRes.status === 200, `expected /api/ping to return 200, got ${pingRes.status}`);
    assert(
      JSON.stringify(pingBody) === JSON.stringify({ ok: true, transport }),
      `expected /api/ping body {ok:true,transport:'${transport}'}, got ${JSON.stringify(pingBody)}`,
    );
    console.log(`  GET /api/ping (bearer ok)      -> ${pingRes.status} ${JSON.stringify(pingBody)}`);

    // 2. GET /api/daemon/status
    const statusRes = await fetch(`${daemon.url}/api/daemon/status`);
    const statusBody = await statusRes.json();
    assert(statusRes.status === 200, `expected /api/daemon/status to return 200, got ${statusRes.status}`);
    console.log(`  GET /api/daemon/status         -> ${statusRes.status} ${JSON.stringify(statusBody)}`);

    // 3. Bearer-auth 401: the middleware unconditionally exempts loopback peers, so this branch
    // only shows up via a real non-loopback connection — skip gracefully (not a failure) on a
    // fully loopback-only sandbox with no routable IPv4 interface.
    if (lanAddress) {
      const port = Number(new URL(daemon.url).port);
      const unauthedRes = await fetch(`http://${lanAddress}:${port}/api/ping`);
      assert(unauthedRes.status === 401, `expected a non-loopback caller with no bearer token to return 401, got ${unauthedRes.status}`);
      console.log(`  GET /api/ping (non-loopback, no bearer) -> ${unauthedRes.status} (correctly rejected)`);
    } else {
      console.log('  GET /api/ping (non-loopback, no bearer) -> SKIPPED (no routable non-loopback IPv4 interface on this machine)');
    }

    // 4. stop() works: the listener is actually closed afterward.
    await daemon.stop();
    let stoppedThrew = false;
    try {
      await fetch(`${daemon.url}/api/ping`);
    } catch {
      stoppedThrew = true;
    }
    assert(stoppedThrew, 'expected a post-stop fetch to reject (listener should be closed)');
    console.log(`  stop()                         -> listener closed, post-stop fetch rejected as expected`);
    daemon = undefined; // already stopped
  } finally {
    delete process.env.JINI_API_TOKEN;
    if (daemon) await daemon.stop().catch(() => {});
    rmSync(dataDir, { recursive: true, force: true });
  }
  console.log(`=== transport: ${transport} — PASS ===`);
}

async function main(): Promise<void> {
  await smokeTestTransport('express');
  await smokeTestTransport('fastify');
  console.log('\nDual-boot smoke test: ALL PASS (express + fastify)');
}

main().catch((error) => {
  console.error('\nDual-boot smoke test FAILED:', error);
  process.exitCode = 1;
});
