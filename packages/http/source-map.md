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
contract. SSE and `ExecutionDelegate` injection are explicitly **not** part of
this port — see "Explicitly deferred" below.

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
callback pair, transport-specific by design). No `ToolExecutor` or
`ExecutionDelegate` exists anywhere in this codebase yet — that boundary is
task 6 in extraction-plan.md §8's ten-task list and has not been started. This
task builds only the transport plumbing and the pack registrar; delegate
injection is a real, named follow-up for whichever task builds the
`ToolExecutor` boundary itself, not something this port could sensibly stub
without inventing the boundary's shape unilaterally.

**4. `ERROR_STATUS_BY_CODE` was re-scoped to `@jini/protocol`'s codes, not
copied 1:1.** See the `src/response.ts` file-map row above for the exact
additions/removals. This keeps the status-mapping table honest about which
codes are actually reachable through `@jini/protocol`'s `ApiErrorCode` type
(an open string type — a pack's own codes still type-check and simply fall
back to the conservative 500 default, same as OD's unmapped-code behavior).

## Explicitly deferred (not part of this port)

- **SSE.** Extraction-plan.md §3 names "HTTP/**SSE**" as part of this
  package's eventual scope. The `http/` module ported here is entirely
  request/response JSON routing; OD's SSE streaming lives elsewhere in
  `apps/daemon` (the runs/stream routes) and was not part of the
  capability-barrel module this task was scoped to. A future task should
  extract SSE transport into this package alongside `adapter.ts`, likely
  keyed on `@jini/daemon`'s `EventLog`/replay-cursor port.
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
| 11 | `terminal.ts` | 109 | MIXED | Generic PTY/SSE session transport (list/create/stream/stdin/resize/kill), wrapped in `ctx.projectStore.getProject`/`ctx.projectFiles.resolveProjectDir` purely to resolve a spawn cwd. Would port cleanly once a generic "workspace root resolver" port exists. Requires SSE (deferred). No lock between a `kill` and a concurrent `stdin`/`resize` on the same session id. |
| 12 | `daemon.ts` | 173 | MIXED — **partially ported this round, see below** | `GET /api/daemon/status` and `POST /api/daemon/shutdown` are genuinely generic once the OD-specific `installedPlugins`/`mediaConfigDir`/`sandboxMode` fields are dropped. `GET/POST /api/daemon/db*` (SQLite inspect/verify/vacuum) are generic in shape but depend on a separate `storage/db-inspect.ts` port not built this round. `POST /api/agents/:agentId/oauth-launch` (hardcoded to `agentId === 'antigravity'`) and `GET /api/critique/conformance` are OD-product and excluded entirely. Real risk: `process.emit('SIGTERM')` only fires *existing* listeners — it doesn't send a real signal — so the shutdown route is a no-op unless something elsewhere registered a handler; preserved as an injected `requestShutdown` callback in the port rather than assumed. |
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
  shape but depend on a `storage/db-inspect.ts` port not built this round.
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
