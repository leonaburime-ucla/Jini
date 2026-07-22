# `@jini/node-host` — provenance

Origin: the generic bootstrap skeleton inside OD's `startServer()`
(`apps/daemon/src/server.ts`) plus `apps/daemon/src/daemon-startup.ts`, on the user's
`arch/server-startserver-endgame` branch (`leonaburime-ucla/open-design`), reference-only clone at
`/Users/la/Desktop/Programming/OSS-Repos/open-design` (branch not checked out there — read via
`git show arch/server-startserver-endgame:<path>`).

Per `docs/jini-port/extraction-plan.md` §2.4, `createLocalNodeDaemon` is the "host preset" that
lets a brand-new product boot a daemon by implementing zero interfaces — the single missing piece
that makes the whole engine runnable instead of a set of tested-in-isolation fragments (per the
root `AGENTS.md`'s ⚠️ PORT STATUS callout). Everything product-specific `startServer` also wires
(design-systems, plugins, marketplace, connectors, routines, media, live-artifacts, skills, orbit,
chat proxy routes, telemetry, project/artifact/upload routes, static SPA fallback) stays in OD;
only the generic Express-assembly-and-listen skeleton is ported here.

## File map

| Jini file | Origin file(s) | Transform |
|---|---|---|
| `src/host-bootstrap.ts` | `apps/daemon/src/daemon-startup.ts` | `normalizeDaemonBindHost`/`closeHttpServer`, logic verbatim (no OD env-var reads inside either function body). **Not ported**: `parseDaemonCliStartupArgs`/`DaemonCliStartupConfig`/`runDaemonCliStartup`/`startDaemonRuntime` — CLI-flag/env-var parsing for an `od <cmd>`-shaped CLI belongs to a future `@jini/cli` task, not this one. |
| `src/create-local-node-daemon.ts` | `apps/daemon/src/server.ts`'s `startServer()` — the bound-API-token boot guard (~line 1569-1590), the app-assembly block (~line 1592-1656), and the `.listen()` tail (~line 3295-3387) | New composition, not a lift: assembles `@jini/sqlite`'s `createSqliteEventLog` + `@jini/daemon`'s `createRunLifecycle`, binds them via `@jini/core`'s `bindings()`, extends via a caller-supplied customizer callback, assembles an Express app behind `@jini/http`'s `installRouteRegistrationGuard`/`registerApiBearerAuthMiddleware`/`registerApiOriginGuardMiddleware`, composes the caller's own packs via `@jini/core`'s `createDaemon`, mounts them via `@jini/http`'s `mountPackHttp`, registers `@jini/http`'s generic `registerDaemonStatusRoutes`, then listens and resolves `{url, server, stop}`. See "Design decisions" below for the compile-time-gate overload split and the two extracted pure helpers (`resolveBoundPort`, `resolveReportHost`). |
| `src/create-local-node-daemon.typecheck.ts` | *(new)* | Compile-time-only proof (mirrors `packages/core/src/compose.typecheck.ts`) that `createLocalNodeDaemon` preserves `createDaemon`'s "missing binding" gate through the wrapper, in both the "no `bindings` customizer" and "`bindings` customizer provided" directions. `tsc --noEmit` is its test runner; never exercised by vitest (excluded via `vitest.config.ts`). |
| `src/index.ts` | *(new)* | Root barrel. |

## Explicitly out of scope (per the porting task's own boundary)

- Every other route `startServer` wires — see the table above and
  `packages/http/source-map.md`'s `routes/` classification table (32 files, 2 GENERIC / 14 MIXED /
  16 OD-PRODUCT) for the full accounting of what those routes are and why none of them belong here.
- **`ToolExecutorToken` binding.** No sensible zero-config default exists — an empty
  `ToolRegistry` would silently fail every tool call. `ExecutionDelegate` injection into
  `mountPackHttp` is independently deferred per `packages/http/source-map.md`.
- **`@jini/agent-runtime` wiring.** `CreateLocalNodeDaemonConfig.agents` is accepted in the type
  for forward-compat but not wired to anything — no registry-to-daemon integration exists anywhere
  in this codebase yet.
- **Additional streaming projections.** The generic lifecycle SSE run transport is mounted here;
  AGUI, terminal sessions, and product-specific stream families remain out of scope.

## Design decisions

**1. Two function overloads instead of one generic signature with a defaulted `BoundIds`.** The
task brief's literal shown signature was
`createLocalNodeDaemon<const Packs, BoundIds extends string = KernelBoundIds>(config: ...)`.
Empirically verified against this repo's TypeScript (5.9.3, `strict`) that this shape does not
actually preserve `createDaemon`'s compile-time "missing binding" gate: when a type parameter both
has a default *and* is referenced inside a conditional type in the same position where it also
needs inference from a nested callback's return type, TypeScript resolves it to the default
instead of inferring from the callback — silently defeating the gate on exactly the call shape
(`bindings` customizer provided) where it matters most. Fixed by splitting into two overloads — one
where `bindings` is absent and `BoundIds` is the concrete `KernelBoundIds`, one where `bindings` is
required and `BoundIds` is inferred fresh with no default — which sidesteps the inference conflict
entirely. Both directions (and an under-binding customizer, and a satisfied customizer) are proven
in `create-local-node-daemon.typecheck.ts`. Documented in full inline on the exported function.

**2. `resolveBoundPort`/`resolveReportHost` extracted as small pure, exported helpers.** The
origin's `.listen()` tail inlined both the "is `server.address()` actually usable" check and the
"substitute 127.0.0.1 for an all-interfaces bind host" substitution directly in the `'listening'`
callback. Pulling them out makes two genuinely-defensive branches (a `server.address()` that is
`null`/a Unix-socket-path string/a non-positive port — provably unreachable via any real TCP
listener once `'listening'` has fired, per the origin's own "belt-and-braces" framing) directly
unit-testable without mocking Express or the underlying socket at all.

**3. `@jini/core/internal`'s `AnyPack`/`RequiredTokenIds`/`MissingTokenIds` re-export.** Needed so
this package could re-derive `createDaemon`'s exact compile-time gate rather than duplicate the
type-level logic. See `packages/core/src/internal.ts`'s own module doc and
`packages/core/src/daemon.ts` — these three types are now `export`ed there (previously
module-private) but deliberately *not* re-exported from `@jini/core`'s public `index.ts` (which
switched from a `daemon.js` wildcard re-export to an explicit named list for exactly this reason).

**4. `createDaemon`'s own compile-time gate is bypassed (via a cast) inside
`createLocalNodeDaemon`'s implementation body**, the same way
`packages/core/src/__tests__/index.test.ts`'s `createDaemonUnsafe` reaches `createDaemon`'s runtime
path directly: `Packs`/`BoundIds` are still abstract, unresolved type parameters inside a generic
function body, so `createDaemon`'s own conditional gate can never collapse to a definite branch
there regardless of which overload the real call site matched. Safety was already established by
this function's own equivalent gate (present on both exported overloads) at the real call site.

**5. `stop()` always closes the durable `EventLog`, even when the caller's `onShutdown` hook
rejects** — `try { await config.onShutdown?.() } finally { await eventLog.close() }` — so a
caller-supplied hook failing can never leak an open sqlite file handle; the original rejection
still propagates to whoever awaited `stop()`.

**6. `env[JINI_BIND_HOST]` is set before serving any request — a documented, only-partially-fixable
wrinkle.** `@jini/http`'s own `guardSameOrigin` (used by `registerDaemonStatusRoutes`' shutdown
route) resolves `bindHost` purely from real `process.env.JINI_BIND_HOST`, with **no parameter path**
of its own — unlike most of that module's other functions, it never accepts an injected `env`.
`createLocalNodeDaemon` sets `env[JINI_BIND_HOST] = host` (where `env` is `config.env ??
process.env`) before returning, which correctly fixes the common case (no `env` override — the
default, real `process.env` gets the right value). When a caller *does* inject a distinct `env`
object for full test isolation, this line cannot make `guardSameOrigin`'s hardwired real-`process.env`
read reflect it — a pre-existing `@jini/http` limitation this call cannot reach around without
editing `origin.ts` itself (out of scope here, same reasoning as the origin-validation duplication
flagged in `packages/http/source-map.md`).

## Tests

`src/__tests__/host-bootstrap.test.ts` (unit, no server needed) and
`src/__tests__/create-local-node-daemon.test.ts` (real bound server on `port: 0` + `fetch()`,
mirroring `packages/platform/src/__tests__/index.test.ts`'s established real-socket pattern — no
`supertest` dependency). `createSqliteEventLog` is the one thing spied on (not replaced) in a
handful of tests, specifically to observe that `stop()` really calls the returned `EventLog`'s
`close()` — reopening the same sqlite file afterward succeeds regardless of whether the original
handle was closed (`better-sqlite3` in WAL mode permits two concurrently open handles on one file
within a single process, verified empirically before relying on it), so that assertion alone would
not have proven anything. The bearer-auth 401 case is gated behind
`it.skipIf(lanAddress == null)` — the middleware unconditionally exempts loopback peers by design,
so observing a real 401 requires a genuine non-loopback TCP connection; the underlying branch logic
already has full unit coverage in `packages/http/src/__tests__/api-security-middleware.test.ts`
regardless of whether this particular integration test can run in a given sandbox. 100% coverage
on all 4 metrics (statements/branches/functions/lines), 49 tests, 3 test files.

## Dependencies

`@jini/core` (workspace) — `bindings`/`createDaemon`/`Bindings`/`Daemon` plus
`AnyPack`/`MissingTokenIds` via the `./internal` subpath. `@jini/daemon` (workspace) —
`createRunLifecycle`/`EventLogToken`/`RunLifecycleToken`. `@jini/sqlite` (workspace) —
`createSqliteEventLog`. `@jini/http` (workspace) — the route-pack registrar, the two security
middlewares, the route-registration guard, `configuredAllowedOrigins`, and the generic daemon-status
routes. `express` (`^4.21.0`) + `@types/express` (devDependency) — this package's own composition
root creates the real Express app.

## 2026-07-19 addition — lifecycle HTTP vertical slice and restart recovery

`createLocalNodeDaemon` now awaits `RunLifecycle.rehydrate()` immediately after
opening its SQLite event log and before it accepts HTTP traffic. That rebuilds
the lifecycle's process-local status/idempotency indexes from durable records;
an interrupted non-terminal run is conclusively recorded as a resumable
failure because its child process cannot survive a host restart. If rehydration
itself fails, the SQLite handle is closed before boot rejects.

The composition root registers `@jini/http`'s generic run transport:
`POST /api/runs`, `GET /api/runs/:runId`,
`POST /api/runs/:runId/cancel`, and `GET /api/runs/:runId/events` (SSE with
`Last-Event-ID` replay). `CreateLocalNodeDaemonConfig.onRunStarted` is an
optional host-owned driver hook invoked only after the lifecycle has durably
started a run. This keeps agent selection, prompt construction, working-root
resolution, and capability policy in the consuming host rather than making
the Node preset a product runtime. The integration test exercises create,
live SSE, reconnect, idempotency, cancel, stop/restart, and durable replay
over real sockets.

## 2026-07-21 addition — local daemon-registry discovery record (`discoveryFile`)

Closes the gap `packages/cli/source-map.md`'s own 2026-07-21 investigation named: "nothing
persists that URL anywhere a *separate* CLI process could find it (no IPC status server, no port
file, no pidfile)." `createLocalNodeDaemon` now writes a small, atomically-written JSON record
(`{url, host, port, pid, startedAt}`) once it is actually listening, via `@jini/sidecar`'s new
`daemon-registry.ts` primitives (`writeDaemonRegistryRecord`/`removeDaemonRegistryRecordIfCurrent`/
`resolveDaemonRegistryPath`) — see that package's own matching source-map.md entry for the
low-level design (atomic write, guarded removal, pid-liveness verification).

**Why `dataDir`-scoped, not a single machine-wide well-known path.** The task's own open question
was whether multiple daemons on one machine is a real scenario here. It is not a *new* scenario
this feature had to invent support for — it already exists structurally: two `createLocalNodeDaemon`
calls already require two different `dataDir`s (each opens its own `<dataDir>/events.db`; sharing
one would already corrupt sqlite state). Scoping the registry record to
`resolveDaemonRegistryPath(dataDir)` (`<dataDir>/daemon.json`, a sibling of `events.db`) inherits
that same isolation for free — two daemons on one machine get two non-colliding records with zero
new configuration, and there is no single global path to argue over or collide on. This mirrors
`resolveDaemonUrl`'s own "conservative default, fully host-overridable" pattern: `discoveryFile`
defaults to the `dataDir`-derived path, accepts an explicit override string, or `false` to disable
writing a record at all.

**New `CreateLocalNodeDaemonConfig.discoveryFile?: string | false`.** The write happens inside the
`'listening'` event handler, *before* `createLocalNodeDaemon`'s own returned promise resolves — a
caller that immediately shells out to a CLI command right after `await createLocalNodeDaemon(...)`
must not lose a race against this module's own write. `stop()` removes the record via
`removeDaemonRegistryRecordIfCurrent(registryPath, process.pid)` — the pid guard (matching
`json-file.ts`'s pre-existing `removePointerIfCurrent` pattern) means a slow-shutting-down old
daemon can never delete a newer daemon's already-written record on a reused `dataDir`.

**Both the write and the removal are best-effort by explicit design, not an oversight.** Wrapped in
try/catch and silently swallowed on failure: the discovery record is a convenience for automatic
CLI discovery, not a correctness requirement for the daemon itself (a caller can always fall back
to an explicit `--daemon-url`/env var), so an unwritable `dataDir` must not fail daemon boot, and a
failed cleanup must not fail an otherwise-successful graceful shutdown. Proven with a real,
deterministic failure (an `ENOTDIR`-forcing blocker file in the registry path's ancestor directory
— privilege-independent, unlike a chmod-based test, which does not actually deny access when tests
run as root, per `packages/sidecar/source-map.md`'s own note on the same issue) rather than an
environment-dependent permission trick.

**Not built.** No change to `resolveDaemonUrl` itself (that lives in `@jini/cli` and already had its
injection point); no attempt to also expose the record over `@jini/sidecar`'s NDJSON-IPC surface
(`json-ipc.ts`) — a flat JSON pointer file is sufficient for "read this once to get a URL" and
avoids standing up a long-lived IPC server just for discovery. See `@jini/cli`'s own source-map.md
for the reader side (`local-daemon-discovery.ts`).

**Tests**: 8 new cases appended to `src/__tests__/create-local-node-daemon.test.ts`'s existing
real-socket suite (default path + content shape, resolves before the daemon's own promise does,
custom `discoveryFile`, `discoveryFile: false`, `stop()` removes the record, two dataDirs on one
"machine" get two non-colliding records, write-failure-is-best-effort via the ENOTDIR trick,
removal-failure-is-best-effort via mocking `@jini/sidecar`'s export). 100/100/100/100 coverage
maintained across the whole package (60 tests, 3 files) — `pnpm --dir packages/node-host exec
vitest run --coverage`.

## Dependencies (updated)

Adds `@jini/sidecar` (workspace) — `writeDaemonRegistryRecord`/`removeDaemonRegistryRecordIfCurrent`/
`resolveDaemonRegistryPath`.
