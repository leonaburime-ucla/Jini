/**
 * Route-pack registrar: mounts every composed pack's `http` registrar (`Pack.http`, typed
 * `(app: unknown, services) => void` in `@jini/core` so the kernel never depends on any one HTTP
 * framework) onto a concrete app instance. This is the piece of extraction-plan.md §3's
 * "@jini/http — HTTP/SSE transport + route-pack registrar" that ties a `Daemon` composed by
 * `createDaemon` to a real HTTP surface: a pack that declares an `http(app, services)` function
 * gets called with the *same* app and the *same* services object `@jini/cli` would receive via
 * `Pack.cli`, so both transports call one shared app-service (extraction-plan.md §2.3). `app` is
 * typed `unknown` here (mirroring `Pack.http`'s own signature) rather than a concrete Express or
 * Fastify app type, since this registrar itself never touches `app` beyond passing it straight
 * through to each pack's own `http(app, services)` — it is genuinely framework-agnostic and is
 * therefore shared by both the `express/` and `fastify/` transport subtrees rather than
 * duplicated into each.
 *
 * Injecting an `ExecutionDelegate` for the tool-execution boundary (extraction-plan.md §2.5,
 * §10 task 6) is explicitly out of scope here — no `ToolExecutor` exists in this codebase yet.
 * `mountPackHttp` only wires the transport-neutral pack composition already built in
 * `@jini/core`; a future task adds delegate injection once the boundary itself exists.
 */
import type { Daemon, Pack } from '@jini/core';

type AnyPack = Pack<any, any, string>;

/**
 * Calls `pack.http(app, services)` for every pack in `packs` that declares an `http` registrar,
 * passing the services object `createDaemon` already composed for that pack. Packs with no
 * `http` registrar (e.g. a CLI-only or headless pack) are skipped.
 */
export function mountPackHttp<const Packs extends readonly AnyPack[]>(
  app: unknown,
  packs: Packs,
  daemon: Daemon<Packs>,
): void {
  const services = daemon.services as Record<string, unknown>;
  for (const pack of packs) {
    pack.http?.(app, services[pack.name]);
  }
}
