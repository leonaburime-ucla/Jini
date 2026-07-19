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
- **SSE.** `@jini/http`'s adapter is JSON-route-only so far (see that package's own "Explicitly
  deferred" section) — nothing here changes that.

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
already has full unit coverage in `packages/http/src/express/__tests__/api-security-middleware.test.ts`
regardless of whether this particular integration test can run in a given sandbox. 100% coverage
on all 4 metrics (statements/branches/functions/lines). Test-count/file-count is stated fresh in
the "2026-07-19" section below, since the Fastify transport split added a second integration suite
after this section was first written.

## Dependencies

`@jini/core` (workspace) — `bindings`/`createDaemon`/`Bindings`/`Daemon` plus
`AnyPack`/`MissingTokenIds` via the `./internal` subpath. `@jini/daemon` (workspace) —
`createRunLifecycle`/`EventLogToken`/`RunLifecycleToken`. `@jini/sqlite` (workspace) —
`createSqliteEventLog`. `@jini/http` (workspace) — the route-pack registrar, the two security
middlewares, the route-registration guard, `configuredAllowedOrigins`, and the generic daemon-status
routes, from either its `express` or `fastify` namespace (see below). `express` (`^4.21.0`) +
`@types/express` (devDependency), and `fastify` (`^5.10.0`) — this package's own composition root
creates the real Express or Fastify app depending on `transport`.

## 2026-07-19 — `transport: 'express' | 'fastify'` switch

`CreateLocalNodeDaemonConfig.transport` (default `'express'`, for drop-in compatibility with every
existing caller) picks which of `@jini/http`'s two transport namespaces (`express`/`fastify`, see
that package's own source-map.md "Fastify transport split" section) assembles the HTTP app. Both
branches wire the matching namespace's route-registration guard, `/api` bearer-auth and
origin-guard middleware, and daemon-status routes; `mountPackHttp` is already transport-agnostic
(see `@jini/http`'s `pack-http.ts`) and is therefore called once, outside the branch, not
duplicated per transport.

**Where the two transports converge vs. diverge, concretely:** everything from bound-port
resolution (`resolveBoundPort`) through `stop()`'s graceful shutdown is one shared, transport-
agnostic implementation — both branches produce the same raw `node:http` `Server` (Fastify exposes
its own internal one via `app.server`) before that shared tail runs. The one place the two
transports' own APIs genuinely do not converge is `listen()`: Express's `http.Server#listen` throws
synchronously for some errors (e.g. an out-of-range port) and emits an async `'error'` event for
others (e.g. `EADDRINUSE`, on this Node/OS combination) — both paths are wired into one `Promise`
inside the Express branch's `listen` closure. Fastify's own `app.listen({port, host})` is
promise-based end to end and always settles its returned promise for either failure shape, needing
no such dual wiring. `stop()` closes the shared raw `Server` directly rather than calling Fastify's
own `app.close()`, so a Fastify-transport daemon skips Fastify's own `onClose` plugin-lifecycle
hook run on shutdown — a known, accepted gap since no caller in this codebase registers one today.

**`mountPackHttp` being transport-agnostic does not make a pack's own `http(app, services)`
registrar portable across transports** — this is documented in full in `@jini/http`'s own
`pack-http.ts` module doc and its source-map.md, and is why this package's two integration test
files (`create-local-node-daemon.test.ts` for Express, `create-local-node-daemon.fastify-transport.test.ts`
for Fastify) deliberately use two different `makePingPack()` fixtures rather than sharing one — an
Express-shaped handler calling `res.json(...)` throws (surfaced as a 500) when mounted on a raw
Fastify instance, since Fastify's `reply` has no `.json()` method.

### Coverage gaps closed in this pass (Part A completion, 2026-07-19)

The Fastify integration suite originally shipped as a smaller "smoke coverage" pass (see that
file's own prior module doc) that explicitly named three gaps left for a follow-up. All three are
now closed:

1. **The loopback-vs-non-loopback bearer-401 branch, at the assembled-pipeline level.** The
   Express suite's `it.skipIf(lanAddress == null)`-gated test (a real non-loopback TCP connection is
   needed to observe the 401, since the middleware unconditionally exempts loopback peers) now has
   a Fastify equivalent in `create-local-node-daemon.fastify-transport.test.ts`, gated the same way.
   The underlying unit-level branch itself already had 100% coverage in
   `packages/http/src/fastify/__tests__/api-security-middleware.test.ts` before this pass — this
   closes the *integration*-level gap specifically, mirroring the Express suite's own stated
   rationale for why that level of proof matters independently.
2. **Fastify's own `.listen()` rejection paths.** Two new tests
   (`rejects rather than handing when a second Fastify instance boots on a port already in use
   (EADDRINUSE)`, `propagates an out-of-range port from Fastify app.listen() as a rejection`) prove
   the Fastify branch's `listen` closure actually propagates a real Fastify listen failure into the
   shared `failToBind` tail — previously only the Express branch's dual sync-throw/`'error'`-event
   path had been independently exercised for this.
3. **No saved dual-boot smoke-test artifact existed.** Added
   `packages/node-host/scripts/dual-boot-smoke.ts` — a standalone (non-vitest, not coverage-counted)
   script that boots `createLocalNodeDaemon` twice, once per transport, and for each: fetches a
   caller-defined pack route, fetches `GET /api/daemon/status`, confirms the bearer-401 branch via a
   real non-loopback connection (gracefully skipped with a printed note on a fully loopback-only
   sandbox), and confirms `stop()` closes the listener. Run via
   `pnpm --filter @jini/node-host exec tsx scripts/dual-boot-smoke.ts`. Its last captured output is
   in the Part A completion report (this task's handoff), reproduced in full for posterity — both
   transports passed every check on the machine this port was verified on.

Test suite is now 60 tests across 4 files (was 57/4 before this pass — the Fastify suite gained the
3 tests above), still 100% coverage on all 4 metrics.
