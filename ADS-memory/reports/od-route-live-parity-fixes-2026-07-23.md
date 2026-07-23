# OD → Jini HTTP route live-parity fixes — 2026-07-23

## Purpose

Continuation of the OD-parity backlog left open by the 2026-07-22 session
(see `ADS-memory/reports/od-route-parity-audit-2026-07-22.md` and the
handoff at `ADS-memory/.local-artifacts/handoff/20260723T042339Z-handoff.md`):
three routes that existed in `@jini/http` but had only ever been reviewed
statically, never diffed against a real running Open Design daemon —
`health.ts`, `research.ts`, `xai.ts`. This pass boots the real OD daemon
from the full clone at `/Users/la/Desktop/Programming/OSS-Repos/open-design`
for each route and fixes every genuine behavioral divergence found.

## Methodology

Same as the 2026-07-22 provider-parity work (Ollama/Google/OpenAI/Azure):
boot `apps/daemon/bin/od.mjs --no-open` (or the built `dist/cli.js`) from
the real OD checkout, hit the real endpoints with `curl`, and diff the
actual wire behavior against Jini's port — not just static code reading.
Each route was tested by an independent agent so daemon boots could run
concurrently; one process/port collision occurred between two agents and
was self-resolved (see "Process note" below) with no effect on either
result.

## Findings

### 1. `health.ts` — `packages/http/src/health.ts`

Real OD behavior (`apps/daemon/src/server.ts:2624-2642`,
`apps/daemon/src/app-version.ts:12-18,138-151`), all curl-confirmed against
a live daemon on `localhost:7456`:

- `GET /api/health` → `200 {"ok":true,"version":"0.15.1"}`
- `GET /api/ready` → `200 {"ok":true,"ready":true,"version":"0.15.1"}` (503
  `{ok:false,ready:false,version}` while `daemonShuttingDown`)
- `GET /api/version` → `200 {"version":{"version","channel","packaged",
  "platform","arch"}}` — the full `AppVersionInfo` object nested under
  `version`, not a bare string
- No bare (non-`/api`) `/health`/`/ready`/`/version` routes exist in OD at
  all (confirmed via live 404s)
- No CORS/origin headers on any of the three

**Fixed:** `livenessRoute` and `readinessRoute` were both missing `version`
in their response bodies; `readinessRoute` was also missing the `ready`
boolean. Both added, sourced from `deps.getVersion()`.

**Deliberately left divergent, documented in the module docstring:**
`/version`'s response stays a flat `{version: string}` rather than OD's
nested `AppVersionInfo` object — `channel`/`packaged`/`platform`/`arch`
aren't wired anywhere in Jini today (`@jini/node-host`'s
`create-local-node-daemon.ts` only supplies a plain string); filling that
in is a host-level architecture decision outside this file's scope. The 503
error body also stays on this package's generic `{error:{code,message,
details}}` envelope rather than OD's ad hoc flat shape — existing
whole-package convention, not a gap.

**Verification:** `pnpm --filter @jini/http typecheck` clean;
`health.test.ts` 13/13; `@jini/node-host` suite 78/78 (consumer of
`getVersion`, unaffected); `pnpm guard` zero violations.

### 2. `research.ts` — `packages/http/src/research.ts`

This was the most significant finding of the pass — not a missing field,
but a **wrong response shape entirely**.

Real OD behavior, confirmed live against `POST /api/research/search`
(`apps/daemon/src/routes/media.ts:668` → `apps/daemon/src/research/
index.ts#searchResearch`), including a genuine success response via a local
mock Tavily backend (no live Tavily key was available):

- Success → `ResearchFindings`: `{query, summary, sources, provider,
  depth, fetchedAt}` — confirmed live with a real response body.
- Zero sources → `404 {"error":{"code":"NO_RESEARCH_SOURCES","message":
  "no sources found"}}`, even when the underlying Tavily call itself
  succeeded.
- `maxSources` is floored then clamped to `[1,20]` before being sent to
  Tavily — confirmed live (`2.7` → `max_results:2` on the wire).
- Query is trimmed and capped at 1000 chars before being sent to Tavily —
  confirmed live with a 1112-char padded query arriving as exactly 1000
  trimmed chars server-side.
- `providers[0]` must be `'tavily'` or absent; non-array `providers` is
  silently ignored; anything else → `400 UNSUPPORTED_RESEARCH_PROVIDER` —
  confirmed live both ways.
- Missing key → `400 TAVILY_API_KEY_MISSING`; env precedence
  `['OD_TAVILY_API_KEY','TAVILY_API_KEY']`.

**Fixed**, all five confirmed live before the fix landed:

1. Response shape was `{answer, sources}` — the shape of OD's internal
   *raw Tavily client* (`tavily.ts`), not the actual HTTP route contract.
   The port had conflated the two. Rebuilt to assemble the real
   `ResearchFindings` shape, including a ported `synthesizeFallbackSummary`
   for when Tavily returns no `answer`.
2. Zero sources returned `200` with an empty array instead of `404`. Fixed.
3. Fractional `maxSources` (e.g. `2.7`) wasn't floored before being
   forwarded to Tavily's real API. Fixed:
   `Math.max(1, Math.min(Math.floor(...), 20))`.
4. Query wasn't trimmed or length-capped. Fixed: trim + `slice(0, 1000)`.
5. `providers` field wasn't validated at all — a caller sending
   `providers:["bing"]` would silently route through Tavily instead of a
   clean `400`. Fixed: added `validateRequestedProvider`, replicating OD's
   exact semantics.

**Deliberately left divergent, documented in the module docstring:**
missing-key status stays `503 NOT_CONFIGURED` (vs. OD's `400
TAVILY_API_KEY_MISSING`) — this package's own consistent SEC-005/
error-code convention, applied uniformly across every route pack, not a
port oversight. The `OD_TAVILY_API_KEY` env-var fallback was **not**
added — doing so would violate this repo's own `AGENTS.md` boundary rule
banning `OD_`-prefixed strings in `packages/@jini/**`.

**Verification:** `research.test.ts` 21/21 (6 new tests added, 3 updated
for the new response shape); `pnpm --filter @jini/http typecheck` clean;
`pnpm guard` zero violations. Full-package run shows 6 pre-existing
failures in `model-proxy.test.ts`, confirmed via `git stash` to fail
identically without this change (unrelated, pre-existing).

**Residual risk:** the real Tavily API's actual response shape/fields
beyond what OD's own code already assumes (`answer`,
`results[].title/url/content/published_date`) was never independently
verified against a live Tavily account — no real API key was available.
The mock server only proves the parsing code handles the *assumed* shape
correctly, not that Tavily's real API still matches those field names
today.

### 3. `xai.ts` — `packages/http/src/xai.ts`

Real OD behavior, confirmed live including a genuine outbound OAuth call to
`https://auth.x.ai/oauth2/token` (got a real `invalid_grant` from xAI's
actual server) via a daemon booted on `127.0.0.1:7456`:

- `POST /api/xai/oauth/start` → `200` with `authorizeUrl/state/callback`,
  opens a real loopback listener (verified via `lsof`).
- `GET /api/xai/auth/status` when disconnected → `{"connected":false,
  "listening":false}` — `expiresAt`/`scope`/`savedAt` keys are **omitted**,
  not null.
- OD's route handler trims `state`/`code`/`query` server-side before use
  (`routes/xai.ts:154-157, 258`).
- Error copy uses mixed-case "xAI" and SuperGrok-specific 401 text.

**Fixed:** `nonEmptyString()` validated the *trimmed* length but returned
the *untrimmed* value — so a whitespace-padded `state`/`code`/`query`
would fail in Jini where OD's real server succeeds. Live-proven: a
whitespace-padded real pending state resolved correctly against the real
`auth.x.ai` endpoint on OD, which Jini's prior code would have rejected as
"state not found." Fixed (trim-then-check-then-return); 3 regression tests
added.

**Confirmed already fixed, no rework needed:** two findings from a prior
2026-07-22 external audit (commit `32d98c109`) — the OAuth-complete error
classification (already tightened to an exact-prefix match) and the
loopback-listener-not-closed-on-`stop()` leak (already fixed in
`packages/node-host/src/create-local-node-daemon.ts`).

**Deliberately left divergent, documented in the module docstring:** the
auth/status null-vs-omitted field shape (a consistent Jini typed-envelope
choice) and the "xai"/"xAI" capitalization difference (sourced from
generic `@jini/agent-runtime` code, out of this file's scope to
special-case).

**Verification:** `xai.test.ts` 47/47 (44 original + 3 new); `pnpm
--filter @jini/http typecheck` clean; whole-package run 883/889 (6
failures isolated to the same pre-existing, unrelated `model-proxy.test.ts`
gap noted above).

**Residual risk:** no real xAI account was available to complete an actual
OAuth grant, so token-exchange success/refresh and the real `x_search`
response shape remain mock-verified only.

## Process note

Two of the three parity agents booted OD daemons concurrently. One agent
found and killed a stray daemon process on a port it didn't expect to be
occupied, which turned out to belong to the other concurrent agent's own
boot; that agent's daemon was restarted as part of its own normal retry
flow with no effect on its final result (confirmed by both agents' own
clean-shutdown verification and by the correctness of both agents' final
findings).

## Bottom line

All three routes had real, live-confirmed divergences from OD, now fixed
and tested. `research.ts`'s was the most severe (a structurally wrong
response shape, not just a missing field) and is the strongest evidence
yet that static-only porting without a live daemon comparison misses real
bugs, not just polish gaps. Not yet pushed — held per explicit instruction
pending later review. Still not live-tested from the original backlog:
`connectors.ts` (no OD equivalent to compare against — different concept,
see the 2026-07-23 handoff), desktop-host additions (Electron/Tauri host
capabilities, hard to boot the same way), and the baseline daemon routes
that predate this session (`runs.ts`, `agents.ts`, `run-stream.ts`,
`terminals.ts`, `routines.ts`, `host-tools.ts`, `memory.ts`, `db-ops.ts`).
