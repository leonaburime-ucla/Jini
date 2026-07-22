# `@jini/http` — provenance

Origin: fork `leonaburime-ucla/open-design`, branch `refactor/http-capability-barrel`
(cloned to `/tmp/od-source` for this task), `apps/daemon/src/http/` (the
"capability barrel" module: `core/`, `request/`, `response/`, `origin/`,
`compat/`, `adapter/` subdirectories + a root barrel). Per the task brief this
branch's own test suites (barrel-imports 24/24, guard 79/79, daemon's
`tests/http` suite 23/23) were independently verified clean before this task
started and were trusted rather than re-verified.

Per extraction-plan.md §3: `@jini/http` is "HTTP/SSE transport + route-pack
registrar + injects `ExecutionDelegate`". This task ports the JSON-route
transport half (the capability-barrel module) and adds a route-pack registrar
that plugs into `@jini/core`'s existing `Pack`/`createDaemon` composition
contract. The generic lifecycle SSE projection was added in the 2026-07-19
vertical-slice pass; `ExecutionDelegate` injection remains explicitly deferred
— see "Explicitly deferred" below.

## File map

| Jini file | Origin file(s) | Transform |
|---|---|---|
| `src/types.ts` | `apps/daemon/src/http/core/types.ts` | `Result`/`ok`/`err`/`RouteInputContext`/`InputParser`/`Handler`/`HttpMethod`/`JsonRouteSpec`, logic verbatim. `ApiError` import switched from `@open-design/contracts` to `@jini/protocol` (see "Dependencies" below). |
| `src/request.ts` | `apps/daemon/src/http/request/parse.ts` | `rawInput`/`validationError`, logic verbatim. `createApiError`/`ApiError` switched to `@jini/protocol`; the `issues` parameter type switched from an inline `Array<{path,message}>` to `Pick<ApiValidationIssue, 'path' \| 'message'>[]` against `@jini/protocol`'s existing `ApiValidationIssue` shape (structurally identical, now a named reusable type). |
| `src/response.ts` | `apps/daemon/src/http/response/response.ts` | `sendJson`/`sendApiError`/`statusForError`, logic verbatim. `ERROR_STATUS_BY_CODE` dropped four OD-product-only codes with no `@jini/protocol` equivalent (`PROJECT_NOT_FOUND`, `FILE_NOT_FOUND`, `ARTIFACT_NOT_FOUND`, `AGENT_UNAVAILABLE` — all product/domain-specific 404/503 mappings, not generic transport concerns) and added mappings for `@jini/protocol`'s existing `TOOL_TOKEN_MISSING`/`TOOL_TOKEN_INVALID`/`TOOL_TOKEN_EXPIRED` → 401, `TOOL_ENDPOINT_DENIED`/`TOOL_OPERATION_DENIED` → 403, `TOOL_NOT_AVAILABLE` → 503 (these generic tool-boundary codes already existed in `@jini/protocol`'s `GENERIC_ERROR_CODES` before this task but had no status mapping anywhere yet). Codes with no explicit entry still fall back to 500, unchanged. |
| `src/origin-validation.ts` | `apps/daemon/src/origin-validation.ts` (daemon-source root, one level above `http/` — a dependency `origin/origin-guard.ts` reaches via `../../origin-validation.js`, not a file inside `http/` itself) | Ported the framework-independent same-origin/allow-list logic verbatim (`parseHostHeader`, `isPrivateIpv4`, `isIpLiteralHostname`, `isLoopbackOrPrivateLanHost`, `isAllowedBrowserHost`, `isAllowedBrowserOrigin`, `isLocalSameOrigin`, `configuredAllowedOrigins`, `configuredAllowedHosts`, `allowedBrowserPorts`, `headerValue`). **Identity-stripped**: env var names `OD_ALLOWED_ORIGINS` → `JINI_ALLOWED_ORIGINS`, `OD_WEB_PORT` → `JINI_WEB_PORT`, `OD_BIND_HOST` → `JINI_BIND_HOST` (all three contain the `OD_` substring the root `AGENTS.md` hard boundary bans). **Not ported**: `isZeroConfigClipperLibraryRequest` and its JSDoc — a bypass predicate for the OD-desktop-specific "OD Clipper" browser extension's probe/ingest routes (`/library/clipper-probe`, `/library/ingest`), a real OD product feature with no generic-transport meaning, not "pure HTTP/SSE transport plumbing." |
| `src/origin.ts` | `apps/daemon/src/http/origin/origin-guard.ts` | `guardSameOrigin`/`OriginContext`, logic verbatim; imports the sibling `origin-validation.ts` above (was two directories up in OD, now a sibling file — both are inside this package). `createApiError` switched to `@jini/protocol`. |
| `src/compat.ts` | `apps/daemon/src/http/compat/api-errors.ts` | `createCompatApiError`/`createCompatApiErrorResponse`/`sendApiError`, logic verbatim. Types switched to `@jini/protocol`. |
| `src/adapter.ts` | `apps/daemon/src/http/adapter/adapter.ts` | `defineJsonRoute`/`mountJsonRoute`/`AdapterContext`, logic verbatim (only import paths flattened from `../request/index.js` etc. to sibling `./request.js` etc., since this package has no subdirectories). `createApiError` switched to `@jini/protocol`. |
| `src/pack-http.ts` | *(new)* | `mountPackHttp` — the route-pack registrar. See "Design decisions" below. |
| `src/index.ts` | `apps/daemon/src/http/index.ts` | Root barrel, re-export set unchanged in kind (adds `mountPackHttp`). Flattened to reference sibling files directly instead of subdirectory barrels, since this package has no subdirectories (the capability-barrel *pattern* — foundation/leaf/orchestration layering — is preserved in the module's internal dependency shape even though the directory nesting was collapsed). |
| `src/daemon-status.ts` | `apps/daemon/src/routes/daemon.ts` (`GET /api/daemon/status`, `POST /api/daemon/shutdown` only — see the routes-classification table below for the rest of that file's verdict) | *(port/backend-routes task, added after the above)* Fully dependency-injected rewrite, not a lift: `getVersion`/`host`/`getPort`/`dataDir`/`isShuttingDown`/`requestShutdown` are all supplied by the caller rather than read from `db`/`env`/process globals the way the origin did. Dropped the origin's `installedPlugins` (a raw `SELECT COUNT(*) FROM installed_plugins` — an OD-product table), a product-specific config-dir field, and a sandbox-mode flag — none of those concepts exist in the engine kernel. The shutdown route reuses the existing `requireSameOrigin: true` `JsonRouteSpec` flag (the same gate `origin.ts`/`guardSameOrigin` already provides) instead of inventing a parallel "local daemon request" gate — this is the pre-existing mechanism, not a new one. `requestShutdown` stays a plain injected callback (not this module calling `process.emit('SIGTERM')` itself) because whether that terminates the process depends on a listener the *caller* registers; preserved the origin's respond-then-`setImmediate`-then-shutdown ordering so the HTTP response is always written before the shutdown callback runs. |
| `src/runs.ts` | `apps/daemon/src/routes/runs.ts`'s thin lifecycle delegations plus new transport design | **New generic transport seam, not a lift.** `POST /api/runs`, `GET /api/runs/:runId`, `POST /api/runs/:runId/cancel`, and `GET /api/runs/:runId/events` project only `RunLifecycle`; no project, conversation, plugin, or artifact semantics cross this boundary. The SSE endpoint uses the canonical `RunProtocolEvent` envelope and `Last-Event-ID`/`afterCursor` reconnect cursors. `RunStartHandler` is deliberately host-owned: after the start record is durable, a host attaches its chosen driver; the route never makes an agent/tool policy decision itself. |

Every file the origin module's barrel actually exported has a Jini equivalent
exporting the same name (`compat`'s `sendApiError` is still re-exported as
`sendCompatApiError` for the same collision-avoidance reason documented in the
origin `README.md`).

### `tool-request-auth.ts` — not found, not ported

The task brief's file list named `tool-request-auth.ts` alongside
`adapter.ts`/`api-errors.ts`/`origin-guard.ts`/`parse.ts`/`response.ts`. It
does not exist anywhere in this repository — verified with
`find . -iname "*tool-request-auth*"` across the entire `open-design` clone
(both on `refactor/http-capability-barrel` and `main`), zero matches. The
task brief's file list also predates the capability-barrel refactor (it
describes a flat `http/` directory of 6 files, which is exactly what the
branch's own `README.md` says the directory looked like *before* this
refactor — see "What changed" in that README). Treated as a stale/approximate
recon list; the actual directory contents on the named branch were used as
ground truth.

## Design decisions

**1. `compat.ts` was ported despite having no current Jini call site.** OD's
`compat/api-errors.ts` exists only because `server.ts`'s routes — written
before `JsonRouteSpec` existed — call error helpers with a different argument
shape than the rest of the module; Jini's `@jini/http` has no such legacy
call sites of its own. It was kept anyway for two reasons: (a) the task brief
explicitly named `api-errors.ts` in its file list, and (b) extraction-plan.md
§4's OD-sync mechanism (hollow re-exports + patch canary) depends on Jini's
port carrying the *same public surface* as the OD module it patch-routes
against — dropping an exported symbol here would be exactly the kind of
silent divergence that mechanism exists to catch. A future host application
with its own legacy hand-mounted routes (mirroring OD's `server.ts`) is the
plausible real consumer; until then it is inert, imported-but-unused code,
which is an acceptable cost for sync fidelity in a package whose whole
purpose is to be a faithful patch target.

**2. `mountPackHttp` (route-pack registrar) is new, not a lift.** OD's
`http/` module has no concept of "packs" — it predates `@jini/core`'s typed
DI-token composition contract entirely; `server.ts` mounts every route by
hand. Per extraction-plan.md §3's description of `@jini/http` as containing
a "route-pack registrar," and per the task brief's explicit instruction to
check `packages/core/src/pack.ts` and compose with it rather than inventing a
separate pattern, `mountPackHttp(app, packs, daemon)` was built fresh: it
iterates the same `packs` array passed to `createDaemon` and calls each
pack's optional `Pack.http(app, services)` registrar (declared in
`@jini/core`'s `pack.ts` with `app` deliberately typed `unknown` so the
kernel never depends on Express) with the *same* Express `app` and the
*same* composed `services` object `@jini/cli`'s eventual CLI registrar would
receive via `Pack.cli` — satisfying extraction-plan.md §2.3's "both
transports call one shared app-service" invariant. Packs with no `http`
registrar are silently skipped (a CLI-only or headless pack is not an error).

**3. `ExecutionDelegate` injection is explicitly out of scope, not
overlooked.** Extraction-plan.md §3 describes `@jini/http` as also
"injects `ExecutionDelegate`" (§2.5's tool-execution-boundary confirm/authorize
callback pair, transport-specific by design). `ToolExecutor` now exists in
`@jini/daemon`, but the external CLI stream currently reports a tool use after
the CLI has executed it; it is not a pre-execution request/response protocol.
This transport therefore does not pretend to inject a post-hoc callback as an
authorization gate. A controlled agent protocol is a real, named follow-up.

**4. `ERROR_STATUS_BY_CODE` was re-scoped to `@jini/protocol`'s codes, not
copied 1:1.** See the `src/response.ts` file-map row above for the exact
additions/removals. This keeps the status-mapping table honest about which
codes are actually reachable through `@jini/protocol`'s `ApiErrorCode` type
(an open string type — a pack's own codes still type-check and simply fall
back to the conservative 500 default, same as OD's unmapped-code behavior).

## Explicitly deferred (not part of this port)

- **Additional streaming projections.** The lifecycle SSE run transport now
  exists, but AGUI mapping, terminal sessions, and product-specific stream
  families remain out of scope.
- **`ExecutionDelegate` injection.** See Design decision 3 above.
- **The OD-sync patch-router** (extraction-plan.md §4.3's "a patch touching a
  `delegated-to-jini` path fails CI until the equivalent package patch
  lands"). Depends on task 1 (harnesses + sync-ownership manifest), which per
  `packages/platform/source-map.md`'s own "Explicitly deferred" note has not
  been done yet anywhere in this repo. Not attempted here for the same
  reason.

## Dependencies

`@jini/core` (workspace) — `Pack`/`Daemon` types for `mountPackHttp`.
`@jini/protocol` (workspace) — `ApiError`/`ApiErrorCode`/`ApiErrorResponse`/
`ApiValidationIssue`/`createApiError`/`createApiErrorResponse`, replacing
OD's `@open-design/contracts` import throughout (that package's DTOs are
OD-product-coupled per `docs/jini-port/recon/r2-packages.md` §1;
`@jini/protocol/src/errors.ts` already independently defines the same
generic error shapes this module needs — matched 1:1 by name and field
shape, so the switch was a mechanical import-source change with one field
narrowing noted in the `src/request.ts` row above, not a redesign).
`express` (`^4.21.0`, new runtime dependency) + `@types/express`
(devDependency) — this package is Express-typed by design; no HTTP
framework dependency previously existed anywhere in the Jini workspace.

## 2026-07-18 addition — resolving the `http/` recon discrepancy + `local-daemon-request.ts`

Tonight's task brief flagged a discrepancy: `docs/jini-port/recon/r1-daemon.md`'s
TASK 1 table lists a 10-file `http/` directory (`adapter.ts`, `api-errors.ts`,
`origin-guard.ts`, `parse.ts`, `response.ts`, `tool-request-auth.ts`, "plus 4
more") as GENERIC-ENGINE, which doesn't match this package's already-merged
file list (`adapter.ts`, `compat.ts`, `index.ts`, `origin-validation.ts`,
`origin.ts`, `pack-http.ts`, `request.ts`, `response.ts`, `types.ts`, from
branch `port/http-sqlite-platform-protocol-plus`). Investigated by cloning
the real `leonaburime-ucla/open-design` fork fresh (`/tmp/od-source`) and
comparing three branches' `apps/daemon/src/http/` directories directly (not
relying on either port's prior write-up):

- **`main`** and **`refactor/http-capability-barrel`** (this package's actual
  origin per the "File map" table above) — 7-file flat / capability-barrel-
  subdivided forms of the same six logical modules (`adapter`/`api-errors`/
  `origin-guard`/`parse`/`response`/`types` + `index`). Byte-diffed the flat
  files on `main` against `refactor/web-memory-slice` (see next bullet) —
  **identical**. Diffed `web-memory-slice`'s flat `api-errors.ts` against
  `http-capability-barrel`'s refactored `compat/api-errors.ts` — differs only
  by added JSDoc comments, logic byte-identical. **Verdict: already covered,
  no action** — these six modules are the same underlying source at different
  points in its own capability-barrel refactor history, and this package
  already ports the post-refactor, better-documented version.
- **`refactor/web-memory-slice`** — the recon's actual scope (stated at the
  top of `r1-daemon.md`) — has a **genuinely different, still-10-file**
  flat `http/` directory: the same six shared files above, **plus**
  `local-daemon-request.ts`, `oauth-result-page.ts`, and `tool-request-auth.ts`
  (10 total, matching the recon's count exactly — the prior port's source-map
  claim of "zero matches for `tool-request-auth.ts`... across the entire
  clone (both on `refactor/http-capability-barrel` and `main`)" is accurate
  for the two branches it checked, but did not check `web-memory-slice`,
  which is where the recon's file list actually came from).

Of those three additional files:

- **`local-daemon-request.ts`** — genuinely separate, generic, zero OD
  coupling (loopback-peer/Host/Origin validation + a CORS-header-setting
  Express middleware; no product nouns). **Ported** — see below.
- **`tool-request-auth.ts`** — generic-shaped bearer-token middleware
  (`createToolRequestAuth`, `bearerTokenFromRequest`), but its only
  real dependency, `../tool-tokens.js` (`ToolTokenRegistry`), is
  **OD-product-coupled**: `CHAT_TOOL_ENDPOINTS`/`CHAT_TOOL_OPERATIONS`
  hardcode OD feature endpoints (`/api/tools/live-artifacts/*`,
  `/api/tools/design-systems/read`, `/api/tools/media/generate`,
  `/api/tools/library/*`, `/api/tools/connectors/*`), and its opaque token
  prefix is literally `odtt_`. This isn't a thin coupling to strip — it's
  the whole registry's reason to exist. **Not ported.** This module's
  generic shape (bearer-token-gated tool endpoints) is exactly what
  extraction-plan.md §8 task 6 (`ToolExecutor` boundary, §2.5) will need to
  build as a real engine port when that task starts — a future port should
  design that port's shape fresh against `ToolExecutor`'s actual contract
  rather than reusing this OD-coupled registry.
- **`oauth-result-page.ts`** — pure OD-branded product HTML (an MCP-OAuth
  callback landing page; literal "Open Design" text in its `<title>`/body
  copy, a `BroadcastChannel('open-design-mcp-oauth')` channel name). **Not
  ported** — no generic core to extract; a future MCP-OAuth-flow port (out
  of scope for this task) would need its own neutral result-page template.

### `local-daemon-request.ts` — ported

| Jini file | Origin file | Transform |
|---|---|---|
| `src/local-daemon-request.ts` | `apps/daemon/src/http/local-daemon-request.ts` (on `refactor/web-memory-slice`) | `normalizeLocalAuthority`/`isLoopbackHostname`/`isLoopbackPeerAddress`/`localOriginFromHeader`/`validateLocalDaemonRequest`/`requireLocalDaemonRequest`, logic verbatim except one dead-code removal — see below. Import switched from the origin's own `./api-errors.js` (`sendApiError(code, message, init)`, separate-arguments call shape) to this package's `./compat.js` `sendApiError`, which is the exact same call shape already ported here (see the original "File map" table's `src/compat.ts` row) — a mechanical import-source change, not a redesign. |

**One dead-code removal (behavior-preserving, coverage-proven):**
`normalizeLocalAuthority`'s origin body had
`if (!hostname || parsed.username || parsed.password || parsed.pathname !== '/') return null;`.
Empirically proved unreachable-as-written before removing anything:
`trimmed` is already rejected one line earlier by
`/[\s/@]/.test(trimmed)` whenever it contains `/` or `@` — the two
characters required for a URL to ever produce a non-root `pathname` or a
non-empty `username`/`password` — so those three sub-conditions can never
be true when this line executes. Verified with a standalone probe against
Node's actual `URL` parser (not just reasoning about the grammar) before
simplifying to `if (!hostname) return null;` (the fourth condition, `!hostname`,
*is* reachable — e.g. `trimmed === '.'` parses to `parsed.hostname === '.'`,
which becomes `''` after the trailing-dot strip — and is kept, with a test).
This is the same category of fix Phase 6.5's coverage-driven loop calls a
"dead branch... refactor it away behaviorally-safely," applied narrowly and
proven, not assumed.

## Tests

`src/local-daemon-request.test.ts`, written fresh for this port. Also
backfilled two coverage gaps in the **pre-existing** (not authored by this
task) `origin-validation.ts` while getting this package's aggregate to the
Phase 6.5 bar: `parseHostHeader` had zero tests before tonight (added a
`describe` block covering array-header/empty-array/catch-branch cases), and
`isAllowedBrowserOrigin`/`isLocalSameOrigin`/`isPrivateIpv4`/
`isLoopbackOrPrivateLanHost` had a handful of untested branches (non-http(s)
origin scheme, missing Host header, default 80/443 origin ports, a
completely headerless request, falsy-hostname fallbacks); added
`isIpLiteralHostname` tests (previously untested despite being exported).
Also added `src/index.test.ts` (the barrel had no direct test, so v8 counted
it as 0% covered even though every symbol it re-exports is exercised via its
own file's tests).

## Dependencies

No new dependency — `local-daemon-request.ts` uses only `node:net` plus this
package's own `compat.ts` export and `express`'s existing `Request`/
`Response`/`NextFunction` types (already a dependency of this package).
---

## `routes/` classification (32 files) — backend-routes port task

Scope note on branch: `docs/jini-port/recon/r1-daemon.md` TASK 1 counts `routes/` at
32 files, but `main`/`refactor/http-capability-barrel` on
`leonaburime-ucla/open-design` only have 29 — three files
(`attribution.ts`, `whats-new.ts`, `project/cancel-owned-runs.ts`) exist only on
`refactor/web-memory-slice`, which is the branch r1-daemon.md was actually reconned
against. This table was built against `refactor/web-memory-slice` (cloned to
`/tmp/od-source` for this task) to match the recon's 32-file scope. Every file was
read in full (directly or via a dedicated research subagent, each independently
verified against the source) before classification; line numbers below refer to that
branch.

Key: **GENERIC** = ports cleanly, no product meaning. **OD-PRODUCT** = Open Design
domain end to end, not portable without a rewrite. **MIXED** = a real generic
sliver exists alongside OD-specific logic that would need to become an injected
port, not a lift.

| # | File | Lines | Verdict | Reasoning |
|---|---|---|---|---|
| 1 | `active-context.ts` | 129 | MIXED | Generic in-memory TTL-store + route-mount scaffold; the one real coupling is `handleGetActive` calling `deps.getProject` (OD project store) to resolve a display name. Renaming `projectId`/`fileName` to a generic "resource ref" would make the whole file portable. All-sync handlers, no async risk. |
| 2 | `automation.ts` | 126 | GENERIC (route file only — **see blocker below**) | The route file itself has zero OD imports beyond a type-only `AutomationProposalStatus`. But its two real dependencies, `automation-proposals.ts` and `automation-ingestions.ts`, are **not** self-contained: `automation-proposals.ts` imports `deleteMemoryEntry/readMemoryEntry/upsertMemoryEntry` from OD's `memory.ts` store. So a direct port would drag in the memory subsystem too — this is a real dependency-chain finding the file-level read alone would miss (flagged explicitly so it isn't silently swallowed the way the audit warned about). Not ported this round; see "Explicitly deferred" below. |
| 3 | `routine.ts` | 348 | MIXED | Generic routine CRUD/schedule/run-tracking engine (a "cron for agent prompts"), minus `target.mode === 'reuse'` validating an OD `projectId` via `getProject`. Real risk: `GET/DELETE /api/routines/:id` and `GET .../runs` have **no try/catch** unlike every sibling handler in the same file — an inconsistency worth a targeted test if ever ported. |
| 4 | `memory.ts` | 690 | MIXED | The large majority (config, entries, extraction pipeline, SSE change/extraction/verify events, connector suggest/extract, system-prompt composition) is generic agent-memory infra with no design/brand nouns. One handler, `POST /api/memory/rules/suggest`, is OD-specific (canvas/deck-annotation shape: `targetLabel`/`filePath`/`selectionKind`/`htmlHint`). Real risk: read-modify-write race on `PATCH /api/memory/config` (no lock between read and write — concurrent patches can lose an update) and a fire-and-forget background extraction whose failure is only `console.warn`'d, never surfaced. Also requires SSE (deferred capability, see below). |
| 5 | `chat.ts` | 2267 | MIXED | Mostly generic BYOK chat/model-proxy plumbing (SSE framing, Anthropic/OpenAI/Azure/Google/Ollama wire adapters, tool-schema translation) — genuinely the largest reusable surface in the whole 32-file set. OD-specific slices: the feedback route's hardcoded design-system-flavored reason-code allowlist + Langfuse sink; two "Critique Theater" routes; a BYOK media tool-loop that writes into OD's project folder; and one **hard boundary violation** — a literal `'X-Title': 'Open Design'` / `opendesign.dev` referrer header sent to OpenRouter (line ~1029), which must be parameterized before any port. Real bug found: the tool-loop variants of the SSE turn-runner (`runTurn`/`runAnthropicToolTurn`/`runGeminiToolTurn`) send a duplicate SSE `end` event on role-marker-guard contamination — the non-tool-loop streamers correctly guard against a double-send with a local `ended` flag; the tool-loop ones don't. Requires SSE (deferred). `ctx.design`/`ctx.chat`/`ctx.validation`/`ctx.lifecycle` are declared in the deps type but never actually used anywhere in the file — the recon's worry about a design-system coupling here does not hold on this branch. |
| 6 | `runs.ts` | 1489 | MIXED, ~85% OD-weighted | Only `GET /api/runs/:id`, `GET /api/runs/:id/events`, `POST /api/runs/:id/cancel` are thin, near-pure delegation to an injected run service. `POST /api/runs` (766 of the file's 1489 lines) is dominated by plugin-snapshot resolution, project/tool-bundle validation, design-system-selection resolution, and a huge inline OD-analytics-event-construction block. `GET /:id/result-package` and `GET /:id/agui` are entirely OD artifact-manifest/AGUI-wire-protocol logic. Real risk: a large unguarded segment of `POST /api/runs` (after the response is already sent) has no try/catch — a synchronous throw there is an unhandled rejection in the async handler with nothing to catch it. All SSE (deferred). |
| 7 | `project/index.ts` | 3957 | OD-PRODUCT | 42 endpoints, all keyed to OD's `projects` SQLite row and its `metadata.baseDir`/design-system/brand/plugin/template subsystems — confirmed no generic "workspace/session CRUD" sliver survives extraction; only isolated *techniques* (Range/ETag revalidation, dual multipart/JSON upload) are reusable, and each is fused to project-specific hooks anyway. Real risk: `POST /api/projects` and `design-system-copy` use manual multi-step DB+filesystem cleanup instead of a transaction — a crash mid-sequence can orphan a DB row or directory. |
| 8 | `project/comments.ts` | 91 | MIXED | Generic preview-comment CRUD; the only OD tie is the `/api/projects/:id/...` path segment and an `updateProject(db, id, {})` call used purely to bump a timestamp. Renaming the parent to a generic workspace/session id would make this portable as-is. `DELETE` lacks the try/catch its POST/PATCH siblings have. |
| 9 | `project/conversations.ts` | 219 | MIXED, leans OD-PRODUCT | Conversation/message CRUD + fork/seed semantics is a plausible generic "chat/run history" shape, but as written it's entangled with `@open-design/contracts`' `ChatSessionMode` (includes the OD-specific `'design'` mode), OD's brand-extraction transcript backfill, and analytics/telemetry reporting. Real risk: `DELETE /conversations/:cid` awaits `cancelRunsOwnedBy(...)` with no try/catch — an unhandled-rejection path (see #10). |
| 10 | `project/cancel-owned-runs.ts` | 33 | GENERIC | A single helper (`cancelRunsOwnedBy`), not a route registrar — defines its own minimal structural `RunCancellationService` interface, no OD imports. Only naming ties to "project" (`{conversationId?, projectId?}` scope), trivially generalizes. Its `runs.list(...)` call is unguarded and is the concrete origin of the unhandled-rejection risk propagating through `conversations.ts` above. |
| 11 | `terminal.ts` | 109 | MIXED | Generic PTY/SSE session transport (list/create/stream/stdin/resize/kill), wrapped in `ctx.projectStore.getProject`/`ctx.projectFiles.resolveProjectDir` purely to resolve a spawn cwd. Would port cleanly once a generic "workspace root resolver" port exists. Requires SSE (deferred). No lock between a `kill` and a concurrent `stdin`/`resize` on the same session id. **Update 2026-07-21**: both blockers this row named are now resolved as standalone prerequisites — `src/sse.ts` (a generic SSE channel) and `src/workspace-root.ts` (a generic workspace-root resolver), see their own 2026-07-21 addition sections below — but `terminal.ts` itself has not been ported; wiring it to these two primitives remains future work. |
| 12 | `daemon.ts` | 173 | MIXED — **partially ported this round, see below** | `GET /api/daemon/status` and `POST /api/daemon/shutdown` are genuinely generic once the OD-specific `installedPlugins`/`mediaConfigDir`/`sandboxMode` fields are dropped. `GET/POST /api/daemon/db*` (SQLite inspect/verify/vacuum) are generic in shape and were originally deferred pending a separate `storage/db-inspect.ts` port — **that port now exists (`@jini/sqlite`'s `db-inspect.ts`) and the three DB routes were ported 2026-07-21 as `src/db-ops.ts`, see its own addition section below.** `POST /api/agents/:agentId/oauth-launch` (hardcoded to `agentId === 'antigravity'`) and `GET /api/critique/conformance` are OD-product and excluded entirely. Real risk: `process.emit('SIGTERM')` only fires *existing* listeners — it doesn't send a real signal — so the shutdown route is a no-op unless something elsewhere registered a handler; preserved as an injected `requestShutdown` callback in the port rather than assumed. |
| 13 | `telemetry.ts` | 180 | OD-PRODUCT (recon's "plausibly generic" guess does not hold) | Only the bare `POST /api/observability/event` passthrough route shape is schema-agnostic; every dependency it's built on (`@open-design/sidecar-proto`, `@open-design/contracts/analytics`, a Langfuse run-feedback bridge, an installer-migration telemetry bootstrap, PostHog wired to OD's consent model) is OD-specific. Also: this module unconditionally installs process-level `uncaughtException`/`unhandledRejection` handlers that call `process.exit(1)` as a side effect of route registration — an architectural smell to flag, not something to port as-is. |
| 14 | `design-system-tool.ts` | 104 | OD-PRODUCT | Single tool-token route resolving a project's *active design system* by id; no generic sliver. |
| 15 | `design-systems.ts` | 473 | OD-PRODUCT | 19 routes, all design-system generation/revision/token-contract/showcase/craft. `@open-design/contracts` `Project`/`ProjectFile` import is a direct product dependency. Two small pure utilities (`sanitizeArchiveFilename`, the showcase asset-URL rewriter's traversal guard) are algorithmically generic but embedded, not separable routes. |
| 16 | `deploy.ts` | 261 | OD-PRODUCT | Every route resolves an OD project's file tree (`buildDeployFileSet`, `prepareDeployPreflight` — exactly the reference-walking family `packages/deploy/source-map.md` documents as deliberately **not** ported) and maintains a project-scoped SQLite deployment ledger. The provider-adapter core it delegates to (Vercel/Cloudflare HTTP calls, reachability polling) is already ported in `@jini/deploy`; this route file is the OD-side caller of that logic, not a duplicate of it. Real risk: concurrent `POST /:id/deploy` calls race on `prior.deploymentCount` with no lock. |
| 17 | `media.ts` | 655 | OD-PRODUCT | Media-generation catalog/config plus unrelated OD features bundled in (Orbit, desktop dialogs, linked-dir recents, research search) — broader grab-bag than the filename suggests. Real risk: `.then/.catch/.finally` chain in the fire-and-forget generate call can throw inside the `.then`/`.catch` callbacks themselves with nothing to catch that — unhandled rejection. |
| 18 | `genui.ts` | 211 | OD-PRODUCT | Human-in-the-loop "genui surface" pattern is conceptually generic, but this implementation is fused to OD's plugin/diff-review/devloop system and raw `genui_surfaces` SQL — would need a fresh design, not a lift. |
| 19 | `handoff.ts` | 176 | OD-PRODUCT | Synthesizes a "resume this chat" prompt from an OD conversation transcript; BYOK upstream call is well-guarded (a model of correct `AbortController`/`finally` cleanup, not a risk). |
| 20 | `plugins/index.ts` | 304 | OD-PRODUCT | OD's plugin/marketplace/atom pipeline; one route path is a literal `/contribute-open-design` product-identity string (guard-script-banned pattern). |
| 21 | `plugins/assets.ts` | 287 | OD-PRODUCT | Plugin-manifest-namespaced (`manifest.od.*`) asset serving. Real risk: the `/preview` and `/example/:name` routes have a weaker symlink TOCTOU guard than the `/asset/*splat` route serving conceptually the same kind of content — worth a security note independent of porting. |
| 22 | `plugins/marketplaces.ts` | 121 | OD-PRODUCT | Thin wrapper over OD's plugin-marketplace subsystem; cleanest error-handling of the three plugin files. |
| 23 | `host-tools.ts` | 380 | MIXED — **partially ported this round, see below** | The editor catalogue + `$PATH`/mac-bundle probing + guarded detached-spawn machinery (`CATALOGUE`, `resolveEntry`, `launchHostTool`, `resolveHostToolLaunchPlan`, `applicableForPlatform`) has zero OD dependency and is well-hardened (a documented, fixed race on spawn-vs-error ordering). `GET /api/editors` uses only that machinery. `POST /api/projects/:id/open-in` additionally calls OD's `projectStore.getProject`/`projectFiles.resolveProjectDir` to resolve a working directory — that route is not ported until a generic workspace-root port exists. (A first-pass automated read of this file called it fully GENERIC; on closer reading the POST route's project-store dependency is real and the file is classified MIXED here instead.) |
| 24 | `library.ts` | 692 | MIXED, OD-leaning | OD's browser-extension "clipper" capture + Figma-import + "edit as page" (creates a new OD project) pipeline. The plumbing underneath (content-addressed storage, MIME sniffing, SSE fan-out, throttled-reconcile-with-shared-in-flight-promise) is reusable in shape but entangled with OD nouns throughout. Real risk: a `force=true` reconcile call arriving while a `force=false` reconcile is in-flight silently returns the stale non-forced promise instead of forcing a fresh one; also an unguarded `fetch()` with no timeout in the remote-asset ingest path. |
| 25 | `static-resource.ts` | 898 | MIXED, OD-leaning | HTTP surface for OD's skill/design-template/design-system/prompt-template/Codex-pets content taxonomy — not generic static-file serving despite the filename. Confirms the recon's note that the OD content-directory taxonomy (`SKILLS_DIR`/`DESIGN_SYSTEMS_DIR`/etc.) is baked into the shared `ServerContext.paths` type itself. Two literal product-identity strings found (`'Open Design Example'` in a page title, `'cannot import Open Design runtime data'` in an error message) — direct boundary-rule violations if ported as-is. Real risk: several TOCTOU races between `fs.existsSync` and a later `readFile` in the multi-step example-resolution fallback chain. |
| 26 | `vela.ts` | 494 | OD-PRODUCT | Vela/AMR vendor integration; hardcoded `amr-api.open-design.ai` domain. Error handling here is unusually mature (explicit comments documenting prior race-condition fixes) — a model file for hardening patterns, not a risk source. |
| 27 | `xai.ts` | 422 | MIXED, OD-leaning | The OAuth start/complete/status/cancel/disconnect shape is a recognizable generic pattern, but this file is fused to a transitional xAI PoC arrangement (a bespoke loopback-port listener tied to xAI's own client_id, an OD-internal credential-cascade referencing another OD system by name, and a vendor-specific `/search` feature route bundled into the same file as auth). Real risk: `activeListener` is process-wide mutable state with no lock — two near-simultaneous OAuth starts can leak an open listener socket. No token-refresh-on-expiry logic exists anywhere in this file (a real gap, not just an untested path). |
| 28 | `attribution.ts` | 354 | OD-PRODUCT | Install/download attribution + growth analytics; hardcoded `download.open-design.ai` domain and an `OD_ATTRIBUTION_LEDGER_*` env var pair (the `OD_` prefix `AGENTS.md`'s guard bans in `packages/@jini/**`). |
| 29 | `social-share.ts` | 31 | OD-PRODUCT | Single route whose *default* share kind is the literal `'open-design-repo'` — the default behavior itself is OD-branded, not just an import. |
| 30 | `whats-new.ts` | 23 | MIXED | The version-lookup + changelog-by-channel shape is generic; the coupling is at the type/wiring level (`@open-design/contracts`' `WhatsNewResponse`, OD-local `app-version.ts`/`services/whats-new.ts`), not literal branding. Worst error-handling posture of any file in the whole set: **zero try/catch** around two awaited calls — a rejection here means no response is ever sent to the client. |
| 31 | `open-design-public-metadata.ts` | 74 | OD-PRODUCT | Confirmed by content, not just filename: hardcoded `nexu-io/open-design` repo name and a specific Discord invite code. No generic abstraction to salvage. |
| 32 | `live-artifact.ts` | 317 | OD-PRODUCT | No `@open-design/contracts` import and no branding literals anywhere — the OD coupling here is architectural (every dependency is OD's project/tool-grant model), not string-based. Real, independent finding: the plain `GET/PATCH/DELETE /api/live-artifacts/:artifactId*` routes have no `authorizeToolRequest`/ownership check at all (only the `/api/tools/live-artifacts/*` routes enforce tool-grant scoping) — a genuine access-control gap worth flagging to OD regardless of the porting question. |

**Tally: 2 GENERIC, 14 MIXED, 16 OD-PRODUCT** (of 32).

### What got ported this round vs. deferred

Only **`daemon.ts`'s status + shutdown pair** was ported this round, as a new
`src/daemon-status.ts` — see its own docblock for the design (fully
dependency-injected: caller supplies `getVersion`/`host`/`getPort`/`dataDir`/
`isShuttingDown`/`requestShutdown`; the OD-specific `installedPlugins`/
`mediaConfigDir`/`sandboxMode` fields were dropped, not carried over). This directly
answers `packages/cli/source-map.md`'s daemon status/stop question — **except that
file does not exist in this repository**: `packages/cli/src/index.ts` is a one-line
placeholder (`// @jini/cli — placeholder.`) with no source-map.md anywhere under
`packages/cli/`. There is no "UNCLEAR row" to resolve because no CLI port has
happened yet on this branch. The finding stands on its own regardless: a generic,
tested, dependency-injected daemon status+shutdown pair now exists in `@jini/http`
for whichever task builds `@jini/cli` for real to consume.

Everything else classified above — including the other five files the task brief
named as "plausibly generic" (`chat.ts`, `runs.ts`, `terminal.ts`, `telemetry.ts`,
`memory.ts`) — is **explicitly deferred**, not silently dropped:

- **`automation.ts`**: route file is clean, but its dependency chain reaches OD's
  memory store (`automation-proposals.ts` → `memory.ts`) — needs that store ported
  or stubbed first. Real, valuable finding; not attempted this round.
- **`chat.ts`, `runs.ts`, `terminal.ts`, `memory.ts`**: all require SSE, which
  `@jini/http`'s adapter (`adapter.ts`/`mountJsonRoute`) does not support yet — this
  package is JSON-route-only by design so far (per this file's own "Explicitly
  deferred" section above, written on a prior task). Porting any of them before an
  SSE primitive exists in this package would mean inventing that primitive
  unilaterally inside a routes-porting task, which is out of scope here.
- **`telemetry.ts`**: turned out OD-PRODUCT on inspection, contradicting the recon's
  guess — not a deferral, a corrected verdict.
- **`daemon.ts`'s remaining routes** (`db`/`db/verify`/`db/vacuum`): generic in
  shape but depended on a `storage/db-inspect.ts` port not built this round. **Update
  2026-07-21**: that port now exists (`@jini/sqlite`'s `db-inspect.ts`) and these three
  routes were ported as `src/db-ops.ts` — see its own addition section below.
- **`host-tools.ts`'s generic sliver** (catalogue/probe/launch machinery, `GET
  /api/editors`): identified as portable and well-hardened, but not ported this
  round for time — a good next-task candidate, smaller in scope than the SSE-bound
  files above.
- **`project/comments.ts`, `project/conversations.ts`, `active-context.ts`,
  `routine.ts`**: each has a real generic core, but every one needs the same
  not-yet-built generic "workspace/session" port (recon's PORT #2) to stand in for
  OD's project store before extraction — building that port was out of scope for a
  routes-classification-and-port task.

This is a partial port by design, not an incomplete one: the 32-file classification
above is complete and is this task's primary deliverable regardless of how much
porting followed it.

## 2026-07-19 addition — `api-security-middleware.ts` + `route-registration-guard.ts` (node-host keystone task)

Ported as part of `@jini/node-host`'s `createLocalNodeDaemon` keystone task (see
`packages/node-host/source-map.md`) — these two files are the security/inventory middleware
`createLocalNodeDaemon` assembles onto its Express app, but they live here rather than in
`node-host` because they are pure `@jini/http` transport concerns (Express middleware, no daemon
composition logic), consistent with this package's existing role as "HTTP/SSE transport + route-
pack registrar." Origin: `apps/daemon/src/http/api-security-middleware.ts` and
`apps/daemon/src/route-registration-guard.ts` on the user's `arch/server-startserver-endgame`
branch (`leonaburime-ucla/open-design`, reference-only clone at
`/Users/la/Desktop/Programming/OSS-Repos/open-design`), read via `git show` (branch not checked
out there).

| Jini file | Origin file | Transform |
|---|---|---|
| `src/api-security-middleware.ts` | `apps/daemon/src/http/api-security-middleware.ts` (new file on the barrel branch) | `registerApiBearerAuthMiddleware`/`registerApiOriginGuardMiddleware`, genericized. Bearer-auth config (`ApiTokenAuthEnvConfig`) is injectable, consuming `@jini/core`'s `isApiTokenMiddlewareEnabled`/`apiTokenFromEnv`. The origin guard reuses this package's **own** `origin-validation.ts` (not `@jini/core`'s separate copy — see "Known duplication" below). **Dropped** (all OD-product-specific, no generic meaning): the project-preview-scope GET exemption, the zero-config "OD Clipper" browser-extension bypass, the live-artifacts-preview bypass, and the `Origin: null` safe-GET allow-list regex (`_NULL_ORIGIN_SAFE_GET_RE`, which named literal OD routes) — `Origin: null` is therefore now always rejected, not conditionally allowed. |
| `src/route-registration-guard.ts` | `apps/daemon/src/route-registration-guard.ts` (already generic) | `installRouteRegistrationGuard`/`getRouteRegistrationInventory`/`guardedRouteKey`, logic verbatim. The origin's hardcoded 2-route `guardedRouteKeys` Set (`POST /api/projects/:id/export/pdf`, `.../media/generate` — both OD product routes) is now an injectable `ReadonlySet<string>` parameter, default empty. `guardedRouteKey` additionally takes the guarded set as an explicit third parameter (was a closure-captured module-level Set in the origin) so it stays a pure, independently unit-testable function. |

**Known duplication, not fixed here (flagged as follow-up):** `@jini/core` has its own
`origin-validation.ts` (a separately-injectable-`env`-config variant), ported on a different task
than this package's own `origin-validation.ts`. `api-security-middleware.ts` deliberately uses
*this* package's copy (`allowedBrowserPorts`/`isAllowedBrowserOrigin` from the sibling file) rather
than `@jini/core`'s, so the new middleware stays consistent with `guardSameOrigin`/`adapter.ts`'s
existing behavior instead of introducing a second, independently-configurable origin decision into
the same request path. Consolidating the two copies is real, valuable follow-up work — out of
scope here since it would mean editing already-tested `adapter.ts`/`origin.ts` internals for a
different task's blast radius.

Tests: `src/__tests__/api-security-middleware.test.ts`, `src/__tests__/route-registration-guard.test.ts`
— 100% coverage on all 4 metrics, no new dependencies (both files use only this package's existing
exports plus `express`, already a dependency).

## 2026-07-21 addition — `cancel-owned-runs.ts` (backlog pass, `feat/http-routes-and-cli-commands`)

Ported the routes-classification table's row **#10 `project/cancel-owned-runs.ts` (GENERIC)**,
the one route-adjacent file the table already called out as fully generic despite living in the
otherwise-OD-PRODUCT `routes/project/` directory. Verified against
`leonaburime-ucla/open-design`, branch `refactor/web-memory-slice` (the branch this table's
routes-classification section was built against), via `git show
refactor/web-memory-slice:apps/daemon/src/routes/project/cancel-owned-runs.ts` — unchanged from
what the table describes: a single 33-line helper (`cancelRunsOwnedBy`), no route registrar, no
OD import.

| Jini file | Origin file | Transform |
|---|---|---|
| `src/cancel-owned-runs.ts` | `apps/daemon/src/routes/project/cancel-owned-runs.ts` (`refactor/web-memory-slice`) | `cancelRunsOwnedBy`, re-scoped rather than lifted verbatim — see below. |

**Re-scoping, not a straight lift.** OD's version takes a `{conversationId?, projectId?}` scope
object and calls `runs.list({...scope, status: 'active'})` — both the two-field scope shape and
the `status: 'active'` list-filter argument are OD nouns/API shape, not kernel concepts. Per
extraction-plan §2.1, `@jini/daemon`'s real `RunLifecycle` keys every run on one opaque
`contextRef: string` (see `packages/daemon/src/run-lifecycle.ts`'s `StartRunInput`/`list`), and
its `list(contextRef?: string): Promise<readonly RunStatus[]>` has no server-side status filter at
all. So this port: (1) takes a single `contextRef: string` in place of the two-field scope object
— the kernel has no separate "conversation" or "project" identity, only the caller's opaque
reference; (2) calls `list(contextRef)` unfiltered and filters non-terminal runs client-side with
`@jini/protocol`'s existing `isTerminalRunState`, since the real `RunLifecycle` has nowhere to push
a `status` argument down to. The per-run-swallowed-cancellation-failure behavior (`.catch(() =>
{})`) and the "safe to call unconditionally, races with a naturally-finishing run harmlessly"
property are both preserved unchanged from the origin.

**Kept structural, not typed against `@jini/daemon`'s `RunLifecycle` directly** (`RunCancellationService`
in the new file) — mirrors the origin's own stated reason ("kept structural so it is satisfied by
the real `design.runs` without depending on the daemon's loose `ServerContext.design: any` type").
In Jini, `RunLifecycle` is already a real, precisely-typed interface rather than a loose `any`, so
the structural cut here is instead about test-double simplicity: a caller can satisfy
`RunCancellationService` with a two-method fake with no need to stub the rest of `RunLifecycle`'s
surface (`rehydrate`/`start`/`get`/`onCancelRequested`/`finish`/`waitForTerminal`). The real
`RunLifecycle.list`/`cancel` return types (`Promise<readonly RunStatus[]>`,
`Promise<RunStatus>`) are both structurally assignable to this file's narrower
`RunCancellationService` (return-type covariance), so passing a real `RunLifecycle` in works with
no adapter.

Not (yet) wired into a route: this port is the reusable helper only, matching the source-map's own
classification of file #10 as "a single helper... not a route registrar." No delete-conversation
or delete-project route exists anywhere in this repo yet for it to be called from (both `#8
project/comments.ts` and `#9 project/conversations.ts` remain deferred per this table's own
"What got ported this round vs. deferred" section — they need a not-yet-built generic
workspace/session port first). `cancelRunsOwnedBy` is exported from the package barrel
(`src/index.ts`) so whichever future workspace/session-delete route lands can call it directly.

Tests: `src/__tests__/cancel-owned-runs.test.ts` — 100% coverage on all 4 metrics (cancels only
non-terminal runs, no-op on an all-terminal or empty run list, swallows a per-run cancellation
rejection without the aggregate promise rejecting). No new dependency — uses only this package's
existing `@jini/protocol` dependency.

## 2026-07-21 addition — `host-tools.ts`'s GENERIC slice (backlog pass, `feat/http-routes-and-cli-commands`)

Ported the routes-classification table's row **#23 `host-tools.ts` (MIXED — "partially ported
this round" caveat)** — specifically the piece that row's own reasoning already identified as
"zero OD dependency and... well-hardened": the editor catalogue, `$PATH`/mac-bundle probing, and
guarded detached-spawn machinery (`CATALOGUE`, `resolveEntry`, `launchHostTool`,
`resolveHostToolLaunchPlan`, `applicableForPlatform`), plus `GET /api/editors`, the one route that
uses only that machinery. Verified against `leonaburime-ucla/open-design`, branch
`refactor/web-memory-slice`, via `git show refactor/web-memory-slice:apps/daemon/src/routes/host-tools.ts`
— 380 lines, matching the table's line count and verdict exactly.

| Jini file | Origin file | Transform |
|---|---|---|
| `src/host-tools.ts` | `apps/daemon/src/routes/host-tools.ts` (`refactor/web-memory-slice`) | `CATALOGUE`/`currentPlatform`/`applicableForPlatform`/`pathDirs`/`probeCommandOnPath`/`probeMacBundle`/`resolveEntry`/`resolveHostToolLaunchPlan`/`launchHostTool`/`listAvailableEditors` (the origin's inline `GET /api/editors` handler body, extracted into its own named, directly-testable function) ported. `HostEditorId`/`HostEditor`/`HostEditorsResponse`/`OpenProjectInEditorResponse` types switched from `@open-design/contracts` to local, non-branded equivalents (`HostEditorId` narrowed to a plain `string` — the catalogue's own id literals are the only real constraint, and pinning a closed union here would make a future catalogue addition a breaking type change for no benefit). `createCommandInvocation` switched from `@open-design/platform` to this repo's own already-ported `@jini/platform` (new dependency on this package, see below) — same signature, mechanical import-source change. **Not ported**: `POST /api/projects/:id/open-in` (needs `ctx.projectStore.getProject`/`ctx.projectFiles.resolveProjectDir` to resolve a working directory — exactly the not-yet-built generic workspace-root port this table's own row #23 note anticipated) and the`server-context.js` `RouteDeps`-based `registerHostToolsRoutes(app, ctx)` registrar shape (replaced with a dependency-free `registerHostToolsRoutes(app, adapter)` mounting only the one ported route). |

**Redesigned for testability, not lifted verbatim — same discipline as `packages/media/src/dispatch/context.ts`.**
The origin reads `process.env`/`process.platform` and calls real `fs.access`/`child_process.spawn`
directly inside `pathDirs`/`probeCommandOnPath`/`probeMacBundle`/`launchHostTool`. Every probing
function here instead takes an injectable `HostToolProbeEnv` (`{access, env, platform}`, defaulting
to `defaultProbeEnv()` which wires the real ones), and `launchHostTool` takes an injectable
`spawnImpl` (defaulting to the real `node:child_process` `spawn`). This is what makes every
platform branch (darwin/win32/linux/unknown), every found/missing outcome (CLI shim on `$PATH`,
mac app bundle, direct absolute-path access), and both directions of `launchHostTool`'s
`'spawn'`/`'error'` settle-race exercisable from one Linux CI runner without a real filesystem or
subprocess — the exact problem a straight lift would have hit immediately (this repo's CI has no
macOS/Windows runner and no installed copies of any catalogue entry).

**One proven dead-branch removal, not carried forward** (same category as `local-daemon-request.ts`'s):
`resolveEntry`'s return type was a discriminated union (`{available: true, resolvedPath, launch} |
{available: false}`) rather than the origin's one-shape-with-optionals, because `resolvedPath` and
`launch` are only ever set together in both of the origin's own "found" branches, never
independently — the origin's `resolveHostToolLaunchPlan` unavailable-branch spread
(`...(probe.resolvedPath ? {resolvedPath} : {})`) was therefore dead code carried forward
unexamined. Making the type a discriminated union (a) makes the impossible state
unrepresentable instead of merely untested, and (b) was required anyway once `exactOptionalPropertyTypes`
flagged assigning a possibly-`undefined` value to the `available: true` variant's non-optional
`resolvedPath` field.

Tests: `src/__tests__/host-tools.test.ts` — 100% coverage on all 4 metrics (every platform branch,
every probe found/missing outcome including the win32 suffix loop and the mac-bundle
array-of-candidate-names case, the real `CATALOGUE` `finder` entry's own `commandArgs` closure
specifically — not just an equivalent inline fixture, `launchHostTool`'s settle-race in both
directions plus a non-`Error` `'error'` payload, and the mounted `GET /api/editors` route).

## Dependencies (updated)

`@jini/platform` (workspace, new) — `createCommandInvocation`, used by `host-tools.ts`'s
`launchHostTool`. Already a dependency-free, well-tested port (see `packages/platform/source-map.md`);
this is its first consumer inside `@jini/http`.

## 2026-07-21 addition — `GET /api/runs` list route (CLI backlog pass, `feat/http-routes-and-cli-commands`)

Not a port from OD (the original `src/runs.ts` "File map" row above already notes `runs.ts` is "a
new generic transport seam, not a lift"). Added while building `@jini/cli`'s `run list` command
(see `packages/cli/source-map.md`): `@jini/daemon`'s `RunLifecycle.list(contextRef?)` already
existed and had no HTTP projection at all, which would have made `run list` either impossible to
build or forced into guessing at a contract. `runListRoute` (`GET /api/runs`, optional
`?contextRef=` query parameter, no same-origin requirement — matching `runStatusRoute`'s read-only
posture) is a thin, direct projection of that existing kernel method: `parseRunList` validates the
query parameter is a non-empty string when present, `handle` calls `lifecycle.list(contextRef)`
and wraps the result as `{ runs }`. Added to `registerRunRoutes` alongside the other three JSON
routes. Tests: `src/__tests__/runs.test.ts` (parse: absent/present/empty/non-string contextRef;
handle: unscoped list, scoped list, empty-result list; mount: route inventory, cross-origin GET
allowed, end-to-end through the real `createRunLifecycle`). No new dependency.

## 2026-07-21 addition — `active-context.ts` (backlog pass, `feat/http-routes-and-cli-commands`)

Ported the routes-classification table's row **#1 `active-context.ts` (MIXED)** — the one row the
table already called "the one real candidate that needs neither SSE nor a workspace/session port."
Verified against the real source first, per this branch's own discipline, rather than trusting the
table's characterization blind: fetched `leonaburime-ucla/open-design`'s
`refactor/web-memory-slice` branch (`git show
refactor/web-memory-slice:apps/daemon/src/routes/active-context.ts`, via a local clone at
`/Users/la/Desktop/Programming/Open-Marketing`, remote-fetched under ref `lucla/refactor-web-memory-slice`).
The read **confirmed the table's characterization** in every respect: an in-memory
`ActiveContextStore` gated by a `ACTIVE_CONTEXT_TTL_MS` (5-minute) staleness check, two fully
synchronous handlers (`handlePostActive`/`handleGetActive` — no `await` anywhere in the origin
file), and exactly one real OD coupling — `handleGetActive` calling `deps.getProject(deps.db,
current.projectId)` purely to resolve a `project?.name` display string. One immaterial
discrepancy found and not worth correcting in the table: the origin file is 128 lines by `wc -l`,
not the table's 129 — a trivial off-by-one in whatever line-counting the original recon used, not
a substantive error.

| Jini file | Origin file | Transform |
|---|---|---|
| `src/active-context.ts` | `apps/daemon/src/routes/active-context.ts` (`refactor/web-memory-slice`) | `ActiveContext`/`ActiveContextStore`/`parsePostActive`→`parseSetActive`/`handlePostActive`→`handleSetActive`/`handleGetActive`/`postActiveRoute`→`setActiveRoute`/`getActiveRoute`/`registerActiveContextRoutes`, logic verbatim modulo the field-renaming and DI changes below. `createApiError` switched from `@open-design/contracts` to `@jini/protocol` (mechanical, same as every other file in this package). |

**Field renaming, per the table's own suggestion.** The origin's `projectId: string` becomes
`resourceRef: string` (an opaque identifier with no project-specific meaning) and `fileName:
string | null` becomes `detail: string | null` (a generic sub-locator within that resource — a
file path was one instance of this, not the concept itself). `GetActiveOutput`'s `projectName:
string | null` becomes `resourceName: string | null`, still resolved the same way (nullish-coalesced
from the resolved resource's own optional `name` field).

**`deps.getProject` becomes an injected `resolveResource`, matching this branch's established DI
convention** (`daemon-status.ts`/`host-tools.ts`: real collaborators supplied by the caller via a
deps object, not read from a global store). The origin's two-argument `getProject(db, projectId)`
signature existed only because OD's project store itself takes a `db` handle; since this package
has no database dependency at all, the port collapses that to a single-argument
`resolveResource(resourceRef): ActiveContextResource | null | undefined` — the caller closes over
whatever store/db it actually has. The origin's `db: unknown` field is dropped from deps entirely
(nothing in the ported file needs it once `getProject` is closed over by the caller instead of
being handed `db` at call time).

**`now` stays an internal testability seam, not a caller-mandatory dependency** — the origin wires
`now: () => Date.now()` inside `registerActiveContextRoutes` itself (not sourced from `ctx`), so
this port makes `ActiveContextDeps.now` optional, defaulting to `Date.now` when the caller omits
it (`deps.now ?? (() => Date.now())`), while still being fully injectable for tests. This is a
narrower dependency surface than `getProject`/`resolveResource`, which is why it lives in the same
`ActiveContextDeps` type but as an optional field rather than being promoted to its own concept.

**Both routes share one in-memory store per `registerActiveContextRoutes` call**, unchanged from
the origin: the store is constructed fresh inside the registrar and closed over by both the
`POST`/`GET` route deps, so a `POST /api/active` is visible to a subsequent `GET /api/active` on
the same mounted instance — this state-sharing is the one behavior a route-level (not just
handler-level) test had to prove, since it is invisible if each route's `handle` is only tested in
isolation.

Not wired into a route pack (no `Pack.http` composition calls `registerActiveContextRoutes` yet)
— matching this file's own precedent (`cancel-owned-runs.ts`'s 2026-07-21 addition: ported and
exported from the barrel, not yet consumed by a concrete pack). `registerActiveContextRoutes` is
exported from `src/index.ts` for whichever future pack needs an active-resource-focus channel.

Tests: `src/__tests__/active-context.test.ts` — 100% coverage on all 4 metrics (27 tests: `parse`
branches for clear/set/missing-resourceRef/non-string-resourceRef/empty-resourceRef/non-string-
detail/empty-detail/null-body; `handle` branches for clear, set, no-current, TTL-expired,
exact-TTL-boundary-still-active, and all four `resolveResource` return shapes — named object,
`{}`, `null`, `undefined`; `registerActiveContextRoutes` mount inventory, cross-route store sharing
for both a set and a clear, `now` default-vs-injected, and same-origin enforcement on both
routes). No new dependency — uses only this package's existing `@jini/protocol`/`adapter.ts`/
`types.ts` exports.

## 2026-07-21 addition — `agents.ts` (`GET /api/agents`, built while wiring `@jini/mcp`'s `list_agents` tool)

Not a port from OD — a new generic transport seam, same category as this file's own `GET
/api/runs` addition above ("`@jini/daemon`'s `RunLifecycle.list(contextRef?)` already existed and
had no HTTP projection at all"). While porting `@jini/mcp`'s stdio MCP tool-hosting mechanism
(`packages/mcp/source-map.md`'s 2026-07-21 addition) and deciding whether to build its `list_agents`
tool, the investigation found `@jini/agent-runtime`'s barrel already exports `AGENT_DEFS:
RuntimeAgentDef[]` (`packages/agent-runtime/src/registry.ts`'s `BASE_AGENT_DEFS`, 24 built-in
adapter defs) — real, static, in-memory registration data with no HTTP projection anywhere in this
package.

`agentListRoute` (`GET /api/agents`) projects that list down to `{id, name}` pairs — deliberately
not `@jini/agent-runtime`'s full `RuntimeAgentDef` (which carries CLI-spawn internals like `bin`,
`buildArgs`, `env`, `listModels` that no HTTP caller should see). `AgentsHttpDeps.listAgents: () =>
readonly AgentSummary[]` is injected rather than this module importing `@jini/agent-runtime`
directly and reading `AGENT_DEFS` itself — matching `daemon-status.ts`/`active-context.ts`'s DI
convention (a real collaborator supplied by the caller, not read from a global), and keeping
`@jini/http` from taking on a new package dependency for a two-field projection. A future pack's
`http(app, services)` composition supplies `listAgents: () => AGENT_DEFS.map(d => ({id: d.id, name:
d.name}))` (or a filtered/curated subset) at wiring time.

**Deliberately static, not a live probe.** OD's own `/api/agents` route (referenced from
`apps/daemon/src/mcp.ts`'s `listAgents`, `packages/mcp/source-map.md`'s "The `list_agents`
decision") returns an `available: boolean` field per agent, computed by actually probing whether
each agent's binary is installed/reachable at request time, plus `installUrl` for
not-installed agents and a `modelsCount`/truncated-`models` projection. None of that was built
here: live detection needs a real design decision (per-agent timeout, caching, concurrency), which
is exactly the kind of judgment call the `@jini/mcp` task brief said not to force for a
small-and-clean addition. This route answers a narrower, unambiguous question — "what agents has
this host registered" — not "what's actually usable right now."

No same-origin requirement (`requireSameOrigin` unset), matching `runListRoute`/`runStatusRoute`'s
posture: a read-only, side-effect-free GET with no per-request state.

Tests: `src/__tests__/agents.test.ts` — 100% coverage on all 4 metrics (7 tests: `parse` requires
no input; `handle` wraps the injected list as `{agents}`, reflects an empty registry without
erroring, and calls `listAgents` fresh on every `handle` rather than caching; `registerAgentRoutes`
mount inventory, an end-to-end request through the mounted handler, and cross-origin GET allowed).
No new dependency.

## 2026-07-21 addition — `sse.ts` (generic SSE channel prerequisite, `feat/http-routes-and-cli-commands`)

Not a port from OD — a generalization of machinery that already existed inline inside this
package's own `runs.ts` (`registerRunEventStream`'s bounded-queue, backpressure-aware
`res.write`/`'drain'` state machine with `Last-Event-ID` replay support, itself a 2026-07-19
addition). Every "requires SSE (deferred)" verdict against `chat.ts`/`terminal.ts`/`memory.ts` in
the routes-classification table above named this exact gap: `@jini/http`'s adapter was JSON-route-only,
so porting any SSE-shaped OD route meant either inventing a one-off streaming helper per route or
building the shared primitive first. `createSseChannel<E extends SseEvent>(res, options)` is that
primitive: `enqueue`/`open`/`isClosed`/`end`/`abandon`/`onClose`, generalized over any event type
(not just `RunProtocolEvent`) so a route only has to describe *what* to stream, not *how*. OD's own
precedent is `ctx.http.createSseResponse`, an Express-request-scoped helper both
`apps/daemon/src/routes/runs.ts` and `apps/daemon/src/routes/terminal.ts` receive via dependency
injection and call themselves — this file is the Jini equivalent of that shared role, not an
invented-from-scratch design.

`runs.ts` was refactored to call this primitive (`import { createSseChannel, requestedAfterCursor }
from './sse.js'`) rather than keep its own private copy of the same state machine — the same
"one implementation, one set of tests for the mechanism itself" discipline this package already
applies to `origin-validation.ts`/`compat.ts`. `requestedAfterCursor(req)` (reads `Last-Event-ID`,
falling back to an `afterCursor` query parameter) was extracted alongside it, also now shared rather
than duplicated per SSE route.

**This unblocks, but does not itself port,** `terminal.ts`/`chat.ts`/`memory.ts` (routes-classification
table rows #11/#5/#4) — those routes still need their own product-neutral rewrites; only the shared
transport primitive they'd all depend on now exists.

Tests: `src/__tests__/sse.test.ts` — 100% coverage on all 4 metrics (27 tests: wire-format framing
including a custom `formatEvent` override, queue-overflow disconnect at the configured
`maxQueuedEvents` ceiling, backpressure (`write() === false` → `'drain'` → resumed flush), a
mid-flush `res.write` throw calling `onWriteError` and ending the channel without throwing back
through the producer, `isEndEvent`-triggered auto-close, `enqueue` before `open` still replaying on
first flush, idempotency of `open`/`end`/`abandon`, client-disconnect via the response's `'close'`
event observed before `open` is ever called, `onClose` firing exactly once regardless of which cause
closes the channel first and firing immediately if registered after closure already happened, and
`requestedAfterCursor`'s header-then-query-then-null precedence). No new dependency — only
`express`'s existing `Response` type.

## 2026-07-21 addition — `workspace-root.ts` (generic workspace-root resolution prerequisite, `feat/http-routes-and-cli-commands`)

Not a port from OD — a generalization of a dependency several routes-classification rows named by
hand: "given some opaque resource reference, what filesystem directory does a spawned process or
launched editor run in?" OD answers that with `ctx.projectStore.getProject` +
`ctx.projectFiles.resolveProjectDir` (a project-store lookup plus a metadata-driven directory
resolver, both OD-product-specific) — named explicitly as the reason `POST /api/projects/:id/open-in`
(row #23 `host-tools.ts`) and the interactive-terminal spawn route (row #11 `terminal.ts`) were not
ported earlier. The kernel has no concept of "project," so it cannot hardcode that lookup, but it
also must not silently invent a directory (guessing `process.cwd()` or an OS temp dir would let one
request's resource reference leak into an unrelated working directory).

`WorkspaceRootRequest` (`{resourceRef, detail?}`, matching `active-context.ts`'s `resourceRef`/`detail`
naming) plus a host-injectable `WorkspaceRootResolver` callback are resolved by
`resolveWorkspaceRoot(request, options)`. Follows the same explicit-injection, conservative-default
shape already established by `@jini/cli`'s `resolveDaemonUrl` and `db-ops.ts`'s
`denyAllDaemonDbPolicy`: the built-in default (`denyAllWorkspaceRoots`) resolves nothing for every
request, and `resolveWorkspaceRoot` throws a `WorkspaceRootDeniedError` rather than ever falling back
to a guessed path — a host must explicitly opt in with its own resolver before any route can act on
a real directory.

**This unblocks, but does not itself port,** `POST /api/projects/:id/open-in` (row #23) or
`terminal.ts`'s spawn routes (row #11) — those still need to be written to call
`resolveWorkspaceRoot` with a caller-supplied resolver; only the shared port they'd depend on now
exists, exported from the barrel (`denyAllWorkspaceRoots`, `resolveWorkspaceRoot`,
`WorkspaceRootDeniedError`) for whichever future task wires a consumer.

Tests: `src/__tests__/workspace-root.test.ts` — 100% coverage on all 4 metrics (11 tests: the default
resolver denies every request; an explicit resolver's resolved path is returned; `null`/`undefined`/
empty-string resolver results all throw `WorkspaceRootDeniedError` carrying the original
`resourceRef`; a synchronous resolver and an async/`Promise`-returning resolver both work;
`detail` is optional and passed through unmodified when present). No new dependency.

## 2026-07-21 addition — `db-ops.ts` (`GET/POST /api/daemon/db*`, `feat/http-routes-and-cli-commands`)

Ports the routes-classification table's row **#12 `daemon.ts`**'s remaining slice: `GET
/api/daemon/db`, `POST /api/daemon/db/verify`, `POST /api/daemon/db/vacuum` (SQLite
inspect/integrity-check/vacuum). That row originally deferred these three routes pending a separate
`storage/db-inspect.ts` port; that port now exists as `@jini/sqlite`'s `db-inspect.ts`
(`inspectSqliteDatabase`/`verifySqliteIntegrity`). `db-ops.ts` itself does **not** depend on
`@jini/sqlite` or `better-sqlite3` at all — `DaemonDbOperations` is a plain injected interface,
structurally identical to `@jini/sqlite`'s return shapes so a caller can wire those in with zero
adapter code, matching `daemon-status.ts`/`host-tools.ts`'s existing "caller supplies the real
collaborator" convention in this package.

**Routed through the tool-execution boundary, not a plain route handler.** All three operations
reveal internal schema/row-count/file-size information (`inspect`/`verify`) or rewrite the database
file in place (`vacuum`) — real security stakes. Per this repo's tool-execution-boundary precedent
(`packages/deploy/src/tool.ts`'s `deploy.publish`, `packages/daemon/src/delegated-tool-bridge.ts`),
`createDaemonDbToolRegistrations` builds three `{descriptor, handler, policy}` triples a host
registers against `@jini/core`'s `ToolRegistry`; the actual work only runs inside a `ToolHandler`
that `@jini/daemon`'s `ToolExecutor.execute` invokes after `ToolPolicy.authorize` allows it — never
directly from `registerDaemonDbRoutes`'s route handlers. `denyAllDaemonDbPolicy` (every call denied,
unconditionally) is the default policy for all three tools, matching `@jini/deploy`'s
`denyAllDeployPublishPolicy` precedent — a host must explicitly opt in with its own policy (role-gated,
same-principal-as-daemon-owner, etc.) rather than getting a working DB inspector for free merely by
registering the tools. OD's own origin left `GET /api/daemon/db` completely ungated and only guarded
`verify`/`vacuum` behind `requireLocalDaemonRequest` — a real pre-existing gap, not carried forward
here. All three routes additionally keep `requireSameOrigin: true` (matching `daemon-status.ts`'s
shutdown route) as defense in depth, not a substitute for the tool-execution boundary.

Failed/timed-out/cancelled tool executions are redacted the same way `runs.ts`'s
`RunInternalErrorContext`/SEC-005 discipline already established: the client only ever sees a generic
`INTERNAL_ERROR` with a correlation id; the real exception (which can embed schema names, file paths,
or a raw SQLite error message) goes only to a host-owned `onInternalError` sink (defaulting to
`console.error`). `ToolExecutor.execute`'s own `'failed'` status already reduces a caught exception
down to `err.message` (a string) before this route ever sees it — `ToolExecutionResult.error` has no
room for the original `Error` object, so this route's SEC-005 discipline is "never widen that string
back out to the client," not "preserve the original exception," which the test suite asserts against
directly rather than assuming.

Tests: `src/__tests__/db-ops.test.ts` — 100% coverage on all 4 metrics (32 tests). Includes the
load-bearing proof that the `ToolExecutor` authorization gate is actually in the call path and not
bypassable: a dedicated `makeDenyByDefaultDeps` helper wires the tools' real production default
policy (`denyAllDaemonDbPolicy` — no policy override at all) through a real `ToolExecutor`/
`ToolRegistry` (no route-level mock) and asserts the injected `DaemonDbOperations` method itself is
never invoked when denied — proven for `inspect` (asserting the 403-equivalent `TOOL_OPERATION_DENIED`
result) and separately for `verify`/`vacuum`. Also covers: `createDaemonDbToolRegistrations`
registering exactly the three documented tool ids and defaulting every one to
`denyAllDaemonDbPolicy`; a caller-supplied policy overriding the default for all three; confirmation
denial reported identically to a policy denial; `failed`/`timed-out`/`cancelled` `ToolExecutionResult`
statuses all redacted to a correlation-id-bearing `INTERNAL_ERROR` (the timed-out/cancelled cases
driven through a minimal fake `ToolExecutor` that resolves synchronously, rather than racing a real
`setTimeout`-based abort against a handler that — like all three of `db-ops.ts`'s own handlers —
has no way to forward `ctx.signal` into `DaemonDbOperations`, since that interface has none: the real
collaborator it documents itself as wiring, `@jini/sqlite`'s synchronous `better-sqlite3` calls,
cannot be cooperatively cancelled mid-flight regardless); `verify`'s query-parameter parsing
(non-string/repeated `quick` rejected, absent defaults to `false`, `'1'`/`'true'`/`'TRUE'` parsed
true, everything else false); and `registerDaemonDbRoutes`'s route inventory, same-origin enforcement
blocking all three routes before the tool executor ever runs, and an end-to-end mounted request for
each of the three routes (including the vacuum route specifically, to exercise its trivial `parse`
through the real HTTP-adapter path rather than only via a direct `.handle()` call). No new
dependency.

Not wired into a route pack (no `Pack.http` composition calls `registerDaemonDbRoutes` yet), matching
this file's established precedent for freshly-added, barrel-exported-but-unconsumed route registrars
(`active-context.ts`, `cancel-owned-runs.ts`).
