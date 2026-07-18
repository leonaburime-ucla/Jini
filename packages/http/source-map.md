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
