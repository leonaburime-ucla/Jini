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

## 2026-07-22 addition — wiring audit: is everything this session's parallel-agent batch built actually reachable through `createLocalNodeDaemon`?

The batch of work that landed on `feat/http-routes-and-cli-commands` this session added roughly a
dozen new `@jini/http` route packs (`terminals.ts`, `memory.ts`, `routines.ts`, `model-proxy.ts`,
`db-ops.ts`, `delegated-tools.ts`, `active-context.ts`, `agents.ts`, `host-tools.ts`,
`cancel-owned-runs.ts`) and `@jini/daemon`'s gap-1 byte-journal / gap-3 continuation / gap-4
failure-classifier / gap-3-part-2 `.mcp.json` injection. This package is the one real entry point a
host actually calls to boot a working daemon, so "is it built" and "is it reachable" are different
questions — this section answers the second one honestly, checked by grepping every
`register*Routes` call site in the whole repo (not just this package), not by re-reading each
route pack's own claims.

**Confirmed reachable, unconditionally, before this addition:** `registerRunRoutes` and
`registerDaemonStatusRoutes` — both already hardwired directly in `createLocalNodeDaemon`, not
behind any pack. Gap 1's byte-journal is unconditionally wired into the zero-config
`AgentExecutor` this preset already constructs (`createAgentExecutor({ lifecycle, journal })`) —
every run this preset drives gets byte-journaled, no caller action needed.

**Confirmed NOT reachable, before this addition, from any real entry point in this repo:** every
one of the dozen route packs named above. A repo-wide grep for each `register*Routes` function
name found call sites only inside its own defining file, its own tests, and the `@jini/http`
barrel re-export — zero callers anywhere in `packages/node-host`, `apps/`, `examples/`, or
`integrations/`. No `Pack` object anywhere wraps any of them either, so even a consumer who wanted
to opt in via `config.packs` had no example to follow. Built, tested to 100% in isolation, and
completely orphaned from the one real boot path — exactly the failure mode this task's item 4(c)
asked to check for.

**Fixed this pass — wired in for real, not just documented:** `registerAgentRoutes` and
`registerHostToolsRoutes` are now unconditionally mounted in `createLocalNodeDaemon`, alongside
`registerRunRoutes`/`registerDaemonStatusRoutes`. Both are the only two of the dozen that are
genuinely safe with a zero-config, harmless default:

- **`GET /api/agents`** — `listAgents` is satisfied by projecting `@jini/agent-runtime`'s own
  `AGENT_DEFS` registry (`AGENT_DEFS.map(def => ({id: def.id, name: def.name}))`) — read-only, no
  security-sensitive content (agent *availability*, not capability), no host-specific resource
  needed. This adds `@jini/agent-runtime` as a new dependency of this package (both are §3-locked
  packages — no `UNLOCKED.md` entry needed, matching `check-engine-boundaries.ts`'s R7 rule).
- **`POST /api/resources/:resourceRef/open-in`** (+ `GET /api/editors`) — `HostToolsOpenInDeps`'s
  `resolveRoot` already defaults to `denyAllWorkspaceRoots` inside `host-tools.ts` itself; mounting
  it with no resolver configured means the route exists and is reachable but denies every call with
  `404`, never fabricating a path — safe by construction. A new optional
  `resolveWorkspaceRoot?: WorkspaceRootResolver` config field lets a real host wire a working
  resolver in without needing its own `Pack`.

**Left genuinely NOT wired, with the specific reason each one needs — not a bare "future work"
note:** `terminals.ts` (needs a live `TerminalSessionManager` — a stateful, node-pty-backed
subsystem — plus a resolved `Principal` and a `ToolExecutor` bound to a real `ToolRegistry` with
`terminal.*` tools actually registered; none of those exist zero-config), `memory.ts` (needs a
frontmatter note-store rooted at a real directory a host chooses), `routines.ts` (needs a
`RoutineStore` plus the scheduler engine's own persistence), `model-proxy.ts` (needs a
BYOK-caller-supplied `apiKey`/`model` per request, which the route already handles per-call — but
optional server-side tool-loop execution, `anthropicExecuteTool`/`openaiExecuteTool`, needs a
`ToolExecutor` the same way `terminals`/`db-ops` do), `db-ops.ts` (needs a `DaemonDbOperations`
implementation a host constructs against its own database), `delegated-tools.ts` (needs a
`resolvePrincipal` callback — deliberately mandatory, no default identity, matching gap 3's own
human-in-the-loop-authority decision), `active-context.ts` (needs a `resolveResource` callback —
this preset has no `Project`/`Workspace` noun to resolve a display name from), `cancel-owned-runs.ts`
(a helper function, not a route pack, invoked by a caller's own shutdown/context-teardown logic —
never meant to be auto-wired). Every one of these needs a caller-supplied stateful resource or
security-authority decision a zero-config preset cannot safely default (unlike `agents`/
`host-tools`, whose defaults are provably harmless: an empty-but-real read, and a deny-everything
gate). This matches the *established* pattern already on this interface — `continuation`/
`mcpJsonInjection` in `@jini/daemon`'s `agent-executor.ts` are opt-in for the identical reason (see
that package's own source-map.md). `classifyFailure` was the same story until 2026-07-22 — see this
file's own dated entry below, `defaultClassifyFailure` is now this preset's zero-config default,
the same way `agents`/`host-tools` already are. The honest fix for each of these dozen-
minus-two is a new optional `CreateLocalNodeDaemonConfig` field mirroring that same pattern (a
caller-supplied `TerminalSessionManager`, note-store, `RoutineStore`, etc.) — real, scoped,
individually-testable follow-up tasks, not one that can be safely rushed alongside an already-large
integration-verification pass. Left here as a precise, actionable list rather than a vague "wire
the rest of it later" note.

**Verified, personally, this session:** `pnpm --dir packages/node-host exec tsc --noEmit`: clean.
`pnpm --dir packages/node-host exec vitest run --coverage`: **65/65 tests pass** (62 pre-existing +
3 new tests exercising `GET /api/agents` and both the default-deny and configured-resolver paths of
`POST /api/resources/:resourceRef/open-in` end-to-end against a real booted daemon on a real
socket, matching this file's own established "real integration test, not a mock" convention), all
3 touched/added files **100/100/100/100**. Root `pnpm typecheck` and root `pnpm guard`: both clean.

## 2026-07-22 addition — wire `defaultClassifyFailure` as the zero-config retry-classifier default (audit fix)

**Gap found by independent audit**: `createLocalNodeDaemon`'s `createAgentExecutor({lifecycle,
journal})` call never supplied a `classifyFailure` — `@jini/daemon`'s gap 4 port was fully built and
tested, and `decideSafeRunRetry` (`run/core/retry.ts`) was fully built and tested, but nothing in
the codebase ever connected them, so every real daemon booted by this preset hardcoded
`resumable: false` on every failed run regardless of cause.

**The fix**: `@jini/daemon` gained a real, honestly-scoped default classifier this same day —
`defaultClassifyFailure` (see `packages/daemon/source-map.md`'s own dated entry for the full
derivation of what it can and cannot classify from `{code, signal}` alone, and why). This file's
`createAgentExecutor` call now reads `createAgentExecutor({lifecycle, journal, classifyFailure:
defaultClassifyFailure})` — a third zero-config-safe default alongside `agents`/`host-tools`
(the comment immediately above that call site is updated to reflect this). Unlike
`ToolExecutorToken`/the six route packs this file documents as caller-supplied-only, this default
carries no security-authority decision and no host-specific stateful resource — it is a pure
function of the process-exit signal every close handler already has in hand, so it is safe to wire
unconditionally the same way the `AgentExecutor` construction itself already is.

**Verified, personally, this session**: `pnpm --dir packages/node-host exec tsc --noEmit`: clean.
`pnpm --dir packages/node-host run test:coverage`: **65/65 tests pass**, `create-local-node-daemon.ts`
**100/100/100/100** (unchanged — the wiring is a one-line call-site addition with no new branch of
its own; `defaultClassifyFailure`'s own branches are covered directly in `@jini/daemon`'s test
suite, not re-tested here).
