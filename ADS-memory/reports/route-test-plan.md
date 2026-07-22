# Jini HTTP route test plan (living document)

Tracks every route `@jini/http` should serve, its wiring status, and what a real end-to-end test for it needs to cover. Source of truth for the eventual e2e route test suite (see `od-route-parity-audit-2026-07-22.md` for how this list was derived). Update this file whenever a route lands, gets wired, or gets excluded with a real reason — don't let it drift from the code.

**Status legend**: `wired` = reachable from `createLocalNodeDaemon`'s default boot today. `built-not-wired` = route pack exists, not auto-mounted. `gap` = should exist, doesn't yet. `excluded` = deliberately OD-product, not engine surface. `needs-decision` = ambiguous, not yet investigated to a real conclusion.

## runs.ts

| Method | Path | Status | Test scenarios needed |
|---|---|---|---|
| POST | /api/runs | wired | valid create, missing contextRef, contextRef wrong type, onStarted composition fires |
| GET | /api/runs | wired | list empty, list populated, pagination if any |
| GET | /api/runs/:runId | wired | found, not-found 404, malformed id |
| POST | /api/runs/:runId/cancel | wired | valid cancel, cancel already-terminal run, cancel unknown run |
| GET | /api/runs/:runId/events (SSE) | wired | connect + replay from cursor, Last-Event-ID reconnect, backpressure/overflow drop, client disconnect cleanup |

## agents.ts

| Method | Path | Status | Test scenarios needed |
|---|---|---|---|
| GET | /api/agents | wired | returns only {id,name} projection, never leaks full RuntimeAgentDef |

## host-tools.ts

| Method | Path | Status | Test scenarios needed |
|---|---|---|---|
| GET | /api/editors | wired | lists only installed editors, platform-dependent behavior |
| POST | /api/resources/:resourceRef/open-in | wired | denyAllWorkspaceRoots default (404), resolver configured + known/unknown resourceRef, editor not installed (409/400), spawn failure surfaces real error |

## daemon-status.ts / db-ops.ts

| Method | Path | Status | Test scenarios needed |
|---|---|---|---|
| GET | /api/daemon/status | wired | real version/host/port/dataDir/pid fields |
| POST | /api/daemon/shutdown | wired | graceful stop, idempotent double-call |
| GET | /api/daemon/db | wired | real table/status info |
| POST | /api/daemon/db/verify | wired | integrity report shape, corrupt-db path |
| POST | /api/daemon/db/vacuum | wired | real vacuum result, ToolExecutor deny-by-default gate |

## memory.ts, routines.ts, terminals.ts, model-proxy.ts, db-ops.ts, active-context.ts, delegated-tools.ts

Route-level detail intentionally deferred — these are mid-flight in tonight's wiring-fix cloud task (unwired → wired, some getting real default construction). Once that lands, expand this section with the same per-route table shape as above, keyed off the final wired/not-wired state.

## model-proxy.ts — provider coverage gap

| Method | Path | Status | Test scenarios needed |
|---|---|---|---|
| POST | /api/proxy/anthropic/stream | wired | valid stream, bad apiKey, bad model, SSE decode |
| POST | /api/proxy/openai/stream | wired | same shape as anthropic |
| POST | /api/proxy/azure/stream | gap | port needed — see parity audit |
| POST | /api/proxy/google/stream | gap | port needed |
| POST | /api/proxy/ollama/stream | gap | port needed |
| POST | /api/proxy/:provider/stream | gap | generic catch-all, port needed |

## Generic ops/config — gaps, no Jini equivalent yet

| Method | Path | Status | Test scenarios needed |
|---|---|---|---|
| GET | /api/health, /health | gap | should be trivial, unauthenticated, always-200-if-process-alive |
| GET | /api/ready | gap | should reflect real readiness (event log open, not shutting down) |
| GET | /api/metrics | gap | real metrics shape TBD |
| GET/PUT | /api/app-config | needs-decision | confirm generic vs OD-specific before building |
| GET | /api/static-resource | needs-decision | confirm generic vs OD-specific before building |

## connectors — capability-providers has no HTTP consumer

| Method | Path | Status | Test scenarios needed |
|---|---|---|---|
| GET | /api/connectors, /api/connectors/status, /api/connectors/:id | gap | design + build a route pack over packages/capability-providers |
| POST | /api/connectors/:id/connect, .../disconnect | gap | same |

## Needs-decision (unresolved in the 2026-07-22 parity audit)

- /api/orbit/* — unclear what `orbit.ts` does, investigate before deciding.
- /api/research/search — generic tool vs OD-specific, unresolved.
- /api/xai/oauth/*, /api/amr/models, /api/provider/models, /api/test/connection — plausibly generalizable, tied to OD-specific call sites today.
- /api/mcp/install*, /api/mcp/servers, /api/mcp/oauth/* — likely OD's MCP client-management UI, distinct from @jini/mcp (a protocol host); not fully verified.
- /api/dir-exists, /api/recent-dirs, /api/system/open-external, /api/dialog/open-folder — possibly already covered by packages/desktop-host's window.__jini__ bridge in a different shape; cross-check before assuming missing.

## Confirmed excluded (OD product surface, not engine — do not port)

Project noun (`/api/projects/*` CRUD/files/folders/export/tabs/conversations), plugin/marketplace content routes, design-AI product surface (design-systems/templates/atoms/craft/skills/prompt-templates/critique), asset/brand tooling (library/brands), branding/marketing routes (social-share/attribution/whats-new/github-open-design/community/codex-pets/open-design-public-metadata), vela integration, project-scoped handoff/deploy UI. See the parity audit for the full reasoning per cluster.
