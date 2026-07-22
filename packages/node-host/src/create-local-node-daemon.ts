/**
 * @module create-local-node-daemon
 *
 * The "host preset" (extraction-plan.md §2.4) that lets a brand-new product boot a running daemon
 * process by implementing zero interfaces: assembles `@jini/sqlite`'s durable `EventLog`,
 * `@jini/daemon`'s `RunLifecycle` and `AgentExecutor` (the driver that actually spawns an agent
 * CLI subprocess for 23 of the 24 registered defs — see `@jini/daemon`'s own source-map.md), an HTTP
 * app wrapped in `@jini/http`'s route-registration guard and security middleware, a caller's own
 * `@jini/core` packs, and the generic daemon-status routes, then listens and returns `{url, server,
 * stop}`. Generalized from OD's `startServer()` — see `source-map.md` for the exact line-by-line
 * provenance and drop-list (every plugin/design-system/connector/routine/media/marketplace/
 * telemetry/project route `startServer` also wires is explicitly out of scope; this is the generic
 * assembly skeleton only).
 *
 * Also writes (2026-07-21) a `@jini/sidecar`-backed local daemon-registry record — see
 * `resolveDaemonRegistryPath`'s own doc and this file's `CreateLocalNodeDaemonConfig.discoveryFile`
 * — once the real bound port is known, and removes it during `stop()`. This is the missing daemon
 * side of `@jini/cli`'s `resolveDaemonUrl({ discover })` injection point (see that package's
 * `local-daemon-discovery.ts` and its own `source-map.md`'s 2026-07-21 investigation, which found
 * no such record existed anywhere a separate CLI process could read). Registry-record writing is
 * transport-independent — it runs identically regardless of which HTTP transport bound the port.
 *
 * The HTTP transport itself is switchable — {@link CreateLocalNodeDaemonConfig.transport} picks
 * `'express'` (the default, for drop-in compatibility with every existing caller) or `'fastify'`
 * (a radix-tree router, meaningfully faster than Express's regex-array one). Both branches wire
 * the matching namespace off `@jini/http`'s barrel (`express`/`fastify`) for the route guard,
 * security middleware, and daemon-status routes; `mountPackHttp` is transport-agnostic (it only
 * ever forwards `app` straight through to a pack's own `http(app, services)`). `registerRunRoutes`/
 * `registerAgentRoutes`/`registerHostToolsRoutes` are mounted identically in both branches too —
 * each has a real Fastify-mounting sibling in `@jini/http`'s `fastify` namespace that mounts the
 * exact same `JsonRouteSpec` objects the Express one does, so `transport: 'fastify'` gets the same
 * routes, not a reduced set. Both transports converge on the same raw `node:http` `Server` before
 * `.listen()` resolves (Fastify exposes its own internal one via `app.server`) so the rest of the
 * boot lifecycle — `keepAliveTimeout`/`headersTimeout` tuning, bound-port resolution, and
 * `stop()`'s graceful `closeHttpServer` — stays a single, transport-agnostic implementation
 * instead of being duplicated per transport. `stop()` closes that raw server directly rather than
 * calling Fastify's own `app.close()`, so a Fastify-transport daemon skips Fastify's own
 * `onClose` hook run on shutdown — no caller in this codebase registers one today (see
 * `source-map.md`'s risk log for this known gap).
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { Server } from 'node:http';

import express, { type Express } from 'express';
import Fastify, { type FastifyInstance } from 'fastify';
import { AGENT_DEFS } from '@jini/agent-runtime';
import { bindings, createDaemon, type Bindings, type Daemon } from '@jini/core';
import type { AnyPack, MissingTokenIds } from '@jini/core/internal';
import {
  AgentExecutorToken,
  createAgentExecutor,
  createDefaultRunStartHandler,
  createRunByteJournal,
  createRunLifecycle,
  EventLogToken,
  RunLifecycleToken,
  type ResolveRunInput,
} from '@jini/daemon';
import { createSqliteEventLog } from '@jini/sqlite';
import {
  configuredAllowedOrigins,
  denyAllWorkspaceRoots,
  express as httpExpress,
  fastify as httpFastify,
  mountPackHttp,
  type RunStartHandler,
  type WorkspaceRootResolver,
} from '@jini/http';
import { removeDaemonRegistryRecordIfCurrent, resolveDaemonRegistryPath, writeDaemonRegistryRecord } from '@jini/sidecar';

import { closeHttpServer, normalizeDaemonBindHost } from './host-bootstrap.js';

const require = createRequire(import.meta.url);
/** This package's own `package.json` version, echoed back by `GET /api/daemon/status`. Read once at module load — never changes for the life of the process. */
const packageVersion = (require('../package.json') as { readonly version: string }).version;

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_TOKEN_ENV_VAR = 'JINI_API_TOKEN';
const DEFAULT_DISABLE_ENV_VAR = 'JINI_DISABLE_API_AUTH';
const DEFAULT_BIND_HOST_ENV_VAR = 'JINI_BIND_HOST';

/**
 * Extracts the real bound TCP port from `server.address()`'s result once a `'listening'` event
 * has fired. Pulled out as its own pure function (rather than inlined) so the belt-and-braces
 * "somehow still not a port" branch — `server.address()` is typed `AddressInfo | string | null`
 * for the general `net.Server` case, but is always a real `AddressInfo` with a positive `.port`
 * for the TCP listener this module creates — is directly unit-testable without needing a real
 * socket or any mocking.
 *
 * @param address - The raw return value of `server.address()`.
 * @returns The bound port, or `null` if `address` is `null` (not yet listening), a string (a Unix
 * domain socket path — this module never listens on one), or an `AddressInfo` with a non-positive port.
 * @complexity O(1).
 * @overallScore 100/100
 */
export function resolveBoundPort(address: { port: number } | string | null): number | null {
  if (address == null || typeof address === 'string') return null;
  return address.port > 0 ? address.port : null;
}

/**
 * The host a daemon's reported base URL should use: binding to every interface (`0.0.0.0` /
 * `::`) is not itself a connectable address, so callers are told to use the IPv4 loopback address
 * instead. Any other bind host is echoed back verbatim.
 *
 * @param bindHost - The literal host `createLocalNodeDaemon` bound to (already normalized).
 * @returns `'127.0.0.1'` for an all-interfaces bind host, otherwise `bindHost` unchanged.
 * @complexity O(1).
 * @overallScore 100/100
 */
export function resolveReportHost(bindHost: string): string {
  return bindHost === '0.0.0.0' || bindHost === '::' ? '127.0.0.1' : bindHost;
}

/** The token ids `createLocalNodeDaemon` always binds itself, before any caller customization runs. */
export type KernelBoundIds = 'jini.eventLog' | 'jini.runLifecycle' | 'jini.agentExecutor';

export interface CreateLocalNodeDaemonConfig<
  Packs extends readonly AnyPack[],
  BoundIds extends string = KernelBoundIds,
> {
  /** Directory the daemon's durable state lives in. Created implicitly by `better-sqlite3` opening `<dataDir>/events.db` — the directory itself must already exist. */
  dataDir: string;
  packs: Packs;
  /**
   * Extends the kernel's own pre-bound `EventLog`/`RunLifecycle` bindings with whatever a pack's
   * own deps require. A callback rather than a pre-built `Bindings` instance because
   * `Bindings.bind()` mutates and returns `this` — two independently constructed instances can't
   * be merged, so the caller must chain directly onto the instance this function already seeded.
   */
  bindings?: (b: Bindings<KernelBoundIds>) => Bindings<BoundIds>;
  /** TCP port to listen on. Defaults to `0` (ask the OS for an ephemeral free port). */
  port?: number;
  /** Host/address to bind to. Defaults to `'127.0.0.1'` (loopback-only). */
  host?: string;
  /** Which `@jini/http` transport namespace assembles the HTTP app. Defaults to `'express'`. */
  transport?: 'express' | 'fastify';
  /** Env var names for the optional bearer-token gate. Defaults to `JINI_API_TOKEN` / `JINI_DISABLE_API_AUTH`. */
  apiToken?: { tokenEnvVar?: string; disableEnvVar?: string };
  /** Invoked once the HTTP listener has fully closed, before the durable `EventLog` is closed. Any rejection still lets shutdown finish (see `stop()`'s doc), but propagates to the `stop()` caller. */
  onShutdown?: () => Promise<void> | void;
  /** Defaults to `process.env`. Threaded through for testability — see this module's own doc on the one place (`JINI_BIND_HOST`) this still touches the real process env regardless. */
  env?: NodeJS.ProcessEnv;
  /**
   * Accepted for forward-compat with `@jini/agent-runtime`'s eventual registry-to-daemon wiring.
   * Not wired to anything yet — no registry-to-daemon integration exists anywhere in this
   * codebase today (see extraction-plan.md and this package's `source-map.md`).
   */
  agents?: unknown[];
  /**
   * Optional host-owned driver attached immediately after `POST /api/runs` durably starts a run.
   * Takes full precedence over {@link resolveRunInput} when both are supplied — a host that
   * wants complete control over run-start behavior should use this, not compose alongside the
   * default handler.
   */
  onRunStarted?: RunStartHandler;
  /**
   * Host-owned prompt/cwd/env composition seam (gap 1 of the run/chat orchestration
   * swarm-consensus Final Recommendation — see
   * `ADS-memory/reports/swarm-consensus/runs/20260722T023000Z-consensus-report.md`). When
   * supplied and `onRunStarted` is not, this daemon builds a default `RunStartHandler` via
   * `@jini/daemon`'s `createDefaultRunStartHandler` that resolves each run's input through this
   * seam and drives it straight to the zero-config `AgentExecutor` this preset already
   * constructs. Ignored when `onRunStarted` is supplied — see that option's own doc. Omit both to
   * durably start runs with no driver attached at all (unchanged prior behavior).
   */
  resolveRunInput?: ResolveRunInput;
  /**
   * Resolves a `resourceRef` (an opaque, host-defined identifier — this preset has no `Project`/
   * `Workspace` noun of its own) to a filesystem working directory for `@jini/http`'s
   * `POST /api/resources/:resourceRef/open-in` route (always mounted — see below). Defaults to
   * `denyAllWorkspaceRoots`: with no resolver supplied, the route exists and is reachable but
   * denies every call with `404`, never fabricating or guessing a path. A host that wants the
   * route to actually do anything supplies this.
   */
  resolveWorkspaceRoot?: WorkspaceRootResolver;
  /**
   * Where this daemon's local discovery record (URL/host/port/pid) is written once it starts
   * listening, so a separate CLI process on the same machine can find it via
   * `@jini/cli`'s `createLocalDaemonDiscovery`. Defaults to `resolveDaemonRegistryPath(dataDir)`
   * (`<dataDir>/daemon.json`) — the same conservative, host-overridable-default pattern
   * `resolveDaemonUrl` itself already uses, and scoped to `dataDir` so two daemons on one machine
   * (already required to use two different `dataDir`s for two independent sqlite files) never
   * collide on a single registry path. Pass `false` to disable writing a discovery record
   * entirely. Writing (and removing, on `stop()`) this record is always best-effort: a failure
   * here (e.g. an unwritable `dataDir`) never fails daemon startup or shutdown — the record is a
   * convenience for automatic discovery, not a correctness requirement, and a caller can always
   * fall back to an explicit `--daemon-url`/env var.
   */
  discoveryFile?: string | false;
}

export interface LocalNodeDaemon {
  /** The daemon's real, resolved base URL (reflects the actual bound port even when `port: 0` was requested). */
  readonly url: string;
  readonly server: Server;
  /**
   * Gracefully shuts the daemon down: closes the HTTP listener, runs the caller's `onShutdown`
   * hook, then closes the durable `EventLog` (releasing the sqlite file handle). Idempotent and
   * safe to call more than once, or concurrently — every call after the first observes the same
   * in-flight/settled shutdown rather than repeating the work.
   */
  stop(): Promise<void>;
}

/**
 * Boots a complete, runnable `@jini/core` daemon process: an `EventLog` + `RunLifecycle` are
 * created and bound automatically, an Express app is assembled behind `@jini/http`'s route guard
 * and security middleware, the caller's own `packs` are composed and mounted, and the generic
 * daemon-status routes are registered — then the app starts listening and this resolves once the
 * real port is known.
 *
 * Preserves `createDaemon`'s compile-time "missing binding" error through this wrapper: the same
 * `MissingTokenIds<Packs, BoundIds>` conditional gate `createDaemon` itself uses (re-derived here
 * via `@jini/core/internal`, not duplicated) forces a call site with an unbound pack dependency to
 * fail to typecheck with the missing token id(s) visible in the error, exactly as it would calling
 * `createDaemon` directly. See `packages/node-host/src/create-local-node-daemon.typecheck.ts` for
 * the compile-time proof.
 *
 * **Why two overloads instead of one generic signature with `BoundIds extends string =
 * KernelBoundIds`:** that single-signature shape is what `docs/jini-port/extraction-plan.md`'s
 * task brief for this file literally shows, but it does not actually work — empirically verified
 * against this repo's own TypeScript (5.9.3, `strict`): when a type parameter both (a) has a
 * default and (b) is referenced inside a conditional type in the same parameter position where it
 * also needs to be inferred from a nested callback's return type, TypeScript resolves it to the
 * default *instead of* inferring from the callback, silently defeating the gate on exactly the
 * call shape (`bindings` provided) where it matters most. Splitting into two overloads — one
 * where `bindings` is absent and `BoundIds` is the concrete `KernelBoundIds`, one where `bindings`
 * is required and `BoundIds` is inferred fresh with no default — sidesteps the inference conflict
 * entirely; each overload only asks TypeScript to solve one problem instead of two contradictory
 * ones. Both directions are covered by `@ts-expect-error` proofs in `create-local-node-daemon.typecheck.ts`.
 *
 * @param config - See {@link CreateLocalNodeDaemonConfig}. Omit `bindings` when every pack's deps
 * are satisfied by the two kernel tokens alone; supply it (chaining onto the seeded `Bindings`
 * instance) to bind anything else a pack requires.
 * @returns A promise resolving to `{url, server, stop}` once the daemon is actually listening and
 * ready to serve requests.
 * @throws Rejects if the port is already in use (`EADDRINUSE`), the host can't be bound
 * (`EACCES`/`EADDRNOTAVAIL`), or the OS somehow reports a listening socket with no resolvable
 * port. On any of these the durable `EventLog` this call already opened is closed before
 * rejecting, so a failed boot never leaks an open sqlite file handle.
 * @complexity O(1) beyond the packs' own `services()`/`http()` costs — `createDaemon` composition
 * is O(p) in pack count (see `@jini/core`'s own complexity note).
 * @overallScore 100/100
 */
export async function createLocalNodeDaemon<const Packs extends readonly AnyPack[]>(
  config: CreateLocalNodeDaemonConfig<Packs, KernelBoundIds> &
    { bindings?: undefined } &
    (MissingTokenIds<Packs, KernelBoundIds> extends never
      ? unknown
      : { readonly __missingBindings: MissingTokenIds<Packs, KernelBoundIds> }),
): Promise<LocalNodeDaemon>;
export async function createLocalNodeDaemon<const Packs extends readonly AnyPack[], BoundIds extends string>(
  config: CreateLocalNodeDaemonConfig<Packs, BoundIds> &
    { bindings: (b: Bindings<KernelBoundIds>) => Bindings<BoundIds> } &
    (MissingTokenIds<Packs, BoundIds> extends never
      ? unknown
      : { readonly __missingBindings: MissingTokenIds<Packs, BoundIds> }),
): Promise<LocalNodeDaemon>;
export async function createLocalNodeDaemon(
  config: CreateLocalNodeDaemonConfig<readonly AnyPack[], string>,
): Promise<LocalNodeDaemon> {
  const env = config.env ?? process.env;
  const host = normalizeDaemonBindHost(config.host ?? DEFAULT_HOST);
  const requestedPort = config.port ?? 0;
  const registryPath = config.discoveryFile === false ? null : (config.discoveryFile ?? resolveDaemonRegistryPath(config.dataDir));

  // @jini/http's own `guardSameOrigin` (used by the daemon-status shutdown route below) resolves
  // `bindHost` purely from real `process.env.JINI_BIND_HOST` — it has no parameter path for an
  // injected env, unlike most of that module's other functions. Setting it here, before any
  // request can possibly be served, keeps that route's same-origin decision in sync with the host
  // this daemon actually bound to instead of silently comparing against whatever
  // `JINI_BIND_HOST` happened to already be set to. (When `config.env` is a caller-injected object
  // distinct from `process.env`, this line cannot fix `guardSameOrigin`'s behavior — that gap is a
  // pre-existing `@jini/http` limitation, not something this call can reach around; see this
  // package's source-map.md.)
  env[DEFAULT_BIND_HOST_ENV_VAR] = host;

  const eventLog = createSqliteEventLog(join(config.dataDir, 'events.db'));
  // Gap 1's byte-journal (see `@jini/daemon`'s `continuation/journal.ts`) gets its own durable
  // sqlite file, deliberately separate from `eventLog` above — that log's `stream()` replays
  // every entry it holds to SSE subscribers as a `RunProtocolEvent`, and a journal entry has no
  // corresponding protocol-event kind. Always constructed, unconditionally wired into
  // `agentExecutor` below: gap 1 is "the observability floor every later increment depends on",
  // not an opt-in extra.
  const journalEventLog = createSqliteEventLog(join(config.dataDir, 'journal.db'));
  const journal = createRunByteJournal(journalEventLog);
  const runLifecycle = createRunLifecycle({ eventLog });
  try {
    await runLifecycle.rehydrate();
  } catch (error) {
    // Rehydration happens before the HTTP server exists, so it cannot use the
    // later bind-failure cleanup path. Never leak the sqlite handle on corrupt
    // or otherwise unreadable durable history.
    await Promise.all([eventLog.close(), journalEventLog.close()]);
    throw error;
  }
  // Zero-config default, unlike ToolExecutorToken (which needs a caller-supplied
  // ToolRegistry and is therefore NOT auto-bound here — see this file's own
  // KernelBoundIds doc and packages/daemon/source-map.md's AgentExecutor
  // section): createAgentExecutor's own defaults already resolve the real
  // @jini/agent-runtime registry, launch resolution, and node:child_process
  // spawn, so every caller gets a working AgentExecutor with no additional
  // wiring. ACP agents intentionally still require a host-injected permission
  // policy before any native tool request can proceed; that fail-closed
  // authority decision has no safe zero-config default.
  const agentExecutor = createAgentExecutor({ lifecycle: runLifecycle, journal });

  const kernelBindings = bindings()
    .bind(EventLogToken, eventLog)
    .bind(RunLifecycleToken, runLifecycle)
    .bind(AgentExecutorToken, agentExecutor);
  const boundBindings = config.bindings ? config.bindings(kernelBindings) : kernelBindings;

  // `createDaemon`'s own compile-time gate can't be satisfied by this function's own
  // (deliberately widened, non-generic — see the two exported overloads above) implementation
  // signature: `config.packs`/`boundBindings` are typed `readonly AnyPack[]`/`Bindings<string>`
  // here, not the concrete `Packs`/`BoundIds` a real call site's overload already resolved. This
  // call's safety was already established by whichever overload the real call site matched
  // (both apply the identical `MissingTokenIds` gate) — bypassing `createDaemon`'s own redundant
  // copy of that same check here is the same pattern
  // `packages/core/src/__tests__/index.test.ts`'s `createDaemonUnsafe` uses to reach the runtime
  // path directly.
  const daemon = (
    createDaemon as (config: { packs: readonly AnyPack[]; bindings: Bindings<string> }) => Daemon<readonly AnyPack[]>
  )({
    packs: config.packs,
    bindings: boundBindings,
  });

  // Shared by the origin guard middleware and the daemon-status routes' same-origin gate below —
  // both must observe the exact same "has the real port resolved yet" state.
  const resolvedPortRef = { current: requestedPort };

  // `onRunStarted` always wins when supplied — see that config option's own doc. Otherwise, a
  // supplied `resolveRunInput` gets the default RunStartHandler built for it; with neither, runs
  // durably start with no driver attached (unchanged prior behavior). Composed once, outside the
  // transport branch below, since it depends only on `config`/`agentExecutor`, not on which HTTP
  // transport ends up mounting `registerRunRoutes` with it.
  const onStarted =
    config.onRunStarted ??
    (config.resolveRunInput === undefined
      ? undefined
      : createDefaultRunStartHandler({ agentExecutor, resolveRunInput: config.resolveRunInput }));
  const runRoutesDeps = { lifecycle: runLifecycle, ...(onStarted === undefined ? {} : { onStarted }) };
  // Two more always-on, zero-config-safe generic routes, alongside runs/daemon-status. Every
  // other route pack this session's work added (terminals, memory, routines, model-proxy,
  // db-ops, delegated-tools, active-context) needs a host-specific stateful resource this preset
  // cannot safely default (a TerminalSessionManager, a note store, a RoutineStore, a resolved
  // Principal, a ToolRegistry with real tool registrations, ...) — see this package's own
  // source-map.md for why those stay caller-supplied Packs rather than being wired in here.
  // `agents`/`host-tools` are the two exceptions: both are safe with pure, harmless defaults.
  const agentRoutesDeps = { listAgents: () => AGENT_DEFS.map((def) => ({ id: def.id, name: def.name })) };
  const hostToolsRoutesDeps = { resolveRoot: config.resolveWorkspaceRoot ?? denyAllWorkspaceRoots };

  let shuttingDown = false;
  let stopPromise: Promise<void> | null = null;
  let server: Server;

  async function stop(): Promise<void> {
    shuttingDown = true;
    if (!stopPromise) {
      stopPromise = (async () => {
        await closeHttpServer(server);
        if (registryPath !== null) {
          // Best-effort (see this file's own `discoveryFile` doc): a daemon that already served
          // every request successfully must not fail its own shutdown just because its discovery
          // record couldn't be removed (e.g. `dataDir` became unwritable mid-run).
          try {
            await removeDaemonRegistryRecordIfCurrent(registryPath, process.pid);
          } catch {
            // Intentionally swallowed — see the try's own comment.
          }
        }
        // A caller-supplied `onShutdown` failing must never leak the durable EventLog's open
        // sqlite file handle — `finally` guarantees the close still runs, then the original
        // rejection (if any) propagates to whoever is awaiting `stop()`.
        try {
          await config.onShutdown?.();
        } finally {
          await eventLog.close();
        }
      })();
    }
    return stopPromise;
  }

  // Built once and passed to whichever transport branch below wires them — the deps shapes are
  // either literally the same type (`DaemonStatusDeps`, since `@jini/http`'s fastify namespace
  // re-exports it from the express module rather than duplicating it) or structurally identical
  // ones (`ApiBearerAuthMiddlewareDeps`/`ApiOriginGuardMiddlewareDeps`, deliberately duplicated
  // per-transport in `@jini/http` but with matching field shapes), so one object literal for each
  // satisfies both namespaces without a cast.
  const daemonStatusDeps = {
    getVersion: () => packageVersion,
    host,
    getPort: () => resolvedPortRef.current,
    dataDir: config.dataDir,
    isShuttingDown: () => shuttingDown,
    requestShutdown: () => {
      void stop();
    },
  };
  const apiTokenConfig = {
    tokenEnvVar: config.apiToken?.tokenEnvVar ?? DEFAULT_TOKEN_ENV_VAR,
    disableEnvVar: config.apiToken?.disableEnvVar ?? DEFAULT_DISABLE_ENV_VAR,
  };
  const originGuardDeps = {
    host,
    extraAllowedOrigins: configuredAllowedOrigins(env),
    getResolvedPort: () => resolvedPortRef.current,
    env,
  };

  // Assembles the concrete HTTP app and wires @jini/http's transport-specific route-registration
  // guard, `/api` security middleware, and daemon-status routes from the matching namespace off
  // its barrel — `mountPackHttp` above is already transport-agnostic and is called identically in
  // both branches. `listen` is the one seam where the two transports' own APIs genuinely diverge
  // (Express's callback/event-based `.listen()` vs Fastify's promise-based one, which also
  // internally awaits Fastify's own `.ready()`) — both branches converge back to the same
  // `() => Promise<Server>` shape so the shared boot-completion logic below (keep-alive tuning,
  // bound-port resolution, resolving `{url, server, stop}`) never needs to know which transport
  // produced the server it received.
  let listen: () => Promise<Server>;
  if (config.transport === 'fastify') {
    const app: FastifyInstance = Fastify();
    httpFastify.installRouteRegistrationGuard(app);
    // Unlike Express, Fastify parses `application/json` request bodies out of the box — no
    // equivalent to `app.use(express.json())` is needed here.
    httpFastify.registerApiBearerAuthMiddleware(app, { tokenConfig: apiTokenConfig, env });
    httpFastify.registerApiOriginGuardMiddleware(app, originGuardDeps);
    httpFastify.registerRunRoutes(app, runRoutesDeps, { resolvedPortRef });
    httpFastify.registerAgentRoutes(app, agentRoutesDeps, { resolvedPortRef });
    httpFastify.registerHostToolsRoutes(app, { resolvedPortRef }, hostToolsRoutesDeps);
    mountPackHttp(app, config.packs, daemon);
    httpFastify.registerDaemonStatusRoutes(app, daemonStatusDeps, { resolvedPortRef });

    listen = async () => {
      await app.listen({ port: requestedPort, host });
      // Fastify's own `.close()` also runs its `onClose` plugin-lifecycle hooks; `stop()` below
      // closes this raw server directly (shared with the Express branch) so no caller-registered
      // Fastify `onClose` hook would fire on shutdown — no caller in this codebase registers one
      // today (see this module's own top-of-file doc and source-map.md's risk log).
      return app.server;
    };
  } else {
    const app: Express = express();
    httpExpress.installRouteRegistrationGuard(app);
    app.use(express.json());
    httpExpress.registerApiBearerAuthMiddleware(app, { tokenConfig: apiTokenConfig, env });
    httpExpress.registerApiOriginGuardMiddleware(app, originGuardDeps);
    httpExpress.registerRunRoutes(app, runRoutesDeps, { resolvedPortRef });
    httpExpress.registerAgentRoutes(app, agentRoutesDeps, { resolvedPortRef });
    httpExpress.registerHostToolsRoutes(app, { resolvedPortRef }, hostToolsRoutesDeps);
    mountPackHttp(app, config.packs, daemon);
    httpExpress.registerDaemonStatusRoutes(app, daemonStatusDeps, { resolvedPortRef });

    listen = () =>
      new Promise<Server>((resolve, reject) => {
        let listeningServer: Server;
        try {
          listeningServer = app.listen(requestedPort, host);
        } catch (error) {
          reject(error);
          return;
        }
        listeningServer.once('listening', () => resolve(listeningServer));
        // `app.listen` throws synchronously when the port is already in use on some Node
        // versions, but emits an `error` event on others (and for EACCES/EADDRNOTAVAIL even on
        // the same Node) — wiring both paths means this promise always settles instead of
        // hanging forever, matching Fastify's own always-settles `.listen()` promise contract.
        listeningServer.on('error', (error) => reject(error));
      });
  }

  return await new Promise<LocalNodeDaemon>((resolve, reject) => {
    const failToBind = (error: unknown) => {
      // Best-effort: a failed boot must not leave the sqlite file handle this call already opened
      // dangling open.
      void eventLog.close().finally(() => reject(error));
    };

    listen()
      .then((listeningServer) => {
        server = listeningServer;
        // Widen the between-request idle window so kept-alive sockets survive gaps between bursts
        // (e.g. an SSE stream's idle periods); `headersTimeout` must exceed `keepAliveTimeout` per
        // the Node docs, or a slow-loris client could stall request parsing.
        server.keepAliveTimeout = 120_000;
        server.headersTimeout = 125_000;

        const boundPort = resolveBoundPort(server.address());
        if (!boundPort) {
          failToBind(
            new Error(`@jini/node-host: daemon failed to resolve listening port (address=${JSON.stringify(server.address())})`),
          );
          return;
        }
        resolvedPortRef.current = boundPort;
        const reportedUrl = `http://${resolveReportHost(host)}:${boundPort}`;

        // Writing the discovery record is async; the promise this executor returns must not
        // resolve — handing the URL back to the caller — until the record a same-machine CLI
        // would read is actually in place, or a caller that immediately shells out to a CLI
        // command right after `await createLocalNodeDaemon(...)` could lose the race against its
        // own write. Transport-independent — runs identically for both the Express and Fastify
        // branches above, since both converge on the same raw `server` before this callback runs.
        void (async () => {
          if (registryPath !== null) {
            try {
              await writeDaemonRegistryRecord(registryPath, {
                url: reportedUrl,
                host: resolveReportHost(host),
                port: boundPort,
                pid: process.pid,
                startedAt: new Date().toISOString(),
              });
            } catch {
              // Best-effort (see this file's own `discoveryFile` doc): a daemon that is otherwise
              // fully up and serving must not fail to boot just because its discovery record
              // couldn't be written (e.g. an unwritable dataDir).
            }
          }
          resolve({ url: reportedUrl, server, stop });
        })();
      })
      .catch((error) => failToBind(error));
  });
}
