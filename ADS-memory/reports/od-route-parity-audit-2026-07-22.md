# OD → Jini HTTP route parity audit — 2026-07-22

## Purpose

A ground-truth comparison of every real HTTP route Open Design's daemon (`apps/daemon/src/routes/*`) registers against every route `@jini/http` currently ports, to answer: what did the port forget, and what's correctly left out as OD-product?

This is route-*inventory* parity only — it does not check that ported routes are actually reachable/wired (that's a separate, already-tracked concern; see the wiring-fixes cloud task from tonight) or that request/response shapes match byte-for-byte.

## Methodology

OD's route list was pulled from a pre-built code-knowledge-graph (`codebase-memory-mcp`, project `Users-la-Desktop-Programming-OSS-Repos-open-design`, 286,862 nodes) via a Cypher query for `Route` nodes with a real HTTP method — 360 real endpoints, filtered from an 886-node raw match set that also contained sanitization regexes mislabeled as routes by the indexer's heuristic. Jini's route list was pulled by grepping `path: '...'` literals out of `packages/http/src/*.ts` directly (not from a graph — Jini isn't indexed there and changes too fast for it to be worth building one for this).

Both lists are real strings extracted from source, not summarized from docs or commit messages.

## Jini's current route inventory (as of `main` @ e5d5a8e7f, before tonight's fastify-merge/wiring-fix cloud tasks land)

```
GET/POST   /api/active
GET        /api/agents
POST       /api/delegated-tool-calls              (built, not exported from the http barrel — tracked in tonight's wiring-fix task)
GET        /api/daemon/status
POST       /api/daemon/shutdown
GET        /api/daemon/db
POST       /api/daemon/db/verify
POST       /api/daemon/db/vacuum
GET        /api/editors
POST       /api/resources/:resourceRef/open-in
GET/POST   /api/memory, /api/memory/tree(/:id), /api/memory/index, /api/memory/config,
           /api/memory/extractions(/:id), /api/memory/verifications(/:id), /api/memory/:id
POST       /api/proxy/anthropic/stream
POST       /api/proxy/openai/stream
POST/GET   /api/runs, /api/runs/:runId, /api/runs/:runId/cancel
GET/POST   /api/terminals, /api/terminals/:id, /api/terminals/:id/stdin,
           /api/terminals/:id/resize, /api/terminals/:id/kill
GET/POST   /api/routines, /api/routines/:id, /api/routines/:id/run, /api/routines/:id/runs
```

## Findings

### 1. Already known and already scheduled for tonight's fixes — not repeated here in detail

`delegated-tools.ts` unexported from the barrel, and the 6 route packs (memory/routines/terminals/model-proxy/db-ops/active-context) not auto-wired into `createLocalNodeDaemon` — both are the subject of the wiring-fix cloud task already running tonight. Not new findings, just confirming this parity pass didn't surface anything additional in that category.

### 2. New gaps found by this pass — real generic-engine capability, currently missing

- **Model-proxy provider coverage is partial.** OD proxies `anthropic`, `openai`, `azure`, `google`, `ollama`, plus a generic `/api/proxy/:provider/stream` catch-all (`apps/daemon/src/routes/*` → 6 proxy routes). Jini's `model-proxy.ts` only mounts `anthropic` and `openai` (confirmed by reading `registerModelProxyRoutes` directly — it hardcodes exactly two `app.post(...)` calls). Azure/Google/Ollama BYOK proxying is a generic capability, not OD-specific, and `packages/agent-runtime` already has the Anthropic/OpenAI wire-adapter pattern to extend. **Recommend porting the remaining 3 providers + the generic catch-all as a real follow-up**, not a documented exclusion — nothing about them is OD-specific.
- **No generic ops/health endpoints.** OD has `/api/health`, `/health`, `/api/ready`, `/api/version`, `/api/metrics`. Jini has `/api/daemon/status` (covers some of this) but no separate `/api/health`/`/api/ready`/`/api/metrics`. Worth a real decision: either document why `daemon/status` is judged sufficient, or port the missing ones — these are about as "generic engine" as it gets, this isn't OD product surface.
- **`/api/app-config` (generic daemon-level config get/set) has no Jini equivalent.** Needs a real look at what OD's `app-config.ts` actually stores — if it's daemon-level (not project-level) config, this is plausibly generic and currently just missing rather than excluded.
- **`/api/static-resource` (generic static-file serving) has no Jini equivalent.** Same category — worth checking whether this is a generic serving primitive or leans on OD's project/file model before deciding.
- **Connectors (`/api/connectors/*`, Composio etc.) have no HTTP exposure in Jini at all**, despite `packages/capability-providers` existing as the exact kind of abstraction this would plug into — and that package's own source-map already flags "zero consumers repo-wide" as an accepted gap. This route parity pass independently arrives at the same conclusion from the other direction: there's a real, named capability-provider abstraction with nothing wiring traffic to it.
- **`/api/runs/:id/agui` and the GenUI routes are mid-flight, not missing.** OD's `genui.ts` routes (`/api/runs/:runId/genui*`) map to `packages/agui`'s partial generalization, currently sitting on the *unmerged* `feat/fastify-http-backend` branch (the fastify-merge cloud task running right now brings this in). Not a new gap — just noting the parity check independently corroborates it's real, tracked work, not forgotten.

### 3. Correctly excluded — genuine OD product surface, not engine gaps

The large majority of the 360 OD routes are OD's actual creative product, not neutral engine surface, and should stay out of `@jini/http` per `AGENTS.md`'s no-OD-tilt boundary:

- **Project noun entirely**: `/api/projects/*` (CRUD, files, folders, export, tabs, conversations, duplicate, figma-import, deployments) — Jini deliberately has no `Project`/`Workspace` noun, using `resourceRef` instead (already documented in `packages/http/src/workspace-root.ts`'s own doc).
- **Plugin/marketplace *content* routes**: `/api/plugins/*`, `/api/marketplaces/*`, `/api/applied-plugins/*` — distinct from the *plugin host infrastructure* gap already tracked in the original extraction-plan status table; these specific routes are OD's marketplace UI/content management, not the host runtime itself.
- **Design-AI product surface**: `/api/design-systems/*`, `/api/design-templates`, `/api/atoms`, `/api/craft`, `/api/skills/*`, `/api/prompt-templates/*`, `/api/critique/*` — this is OD's actual creative product.
- **Asset/brand tooling**: `/api/library/*` (Figma clipper/asset library), `/api/brands/*` (brand extraction).
- **Branding/marketing**: `/api/social-share`, `/api/attribution/*`, `/api/whats-new`, `/api/github/open-design*`, `/api/community/discord`, `/api/codex-pets/*`, `open-design-public-metadata.ts`.
- **Third-party product integration**: `/api/integrations/vela/*` (OD-specific wallet/analytics integration).
- **Project-scoped handoff/deploy UI**: `/api/projects/:id/handoff`, `/api/projects/:id/deploy*` — the underlying deploy *capability* is ported as `packages/deploy`; these specific routes are OD's project-scoped UI over it.

### 4. Unclear — needs a follow-up look, not classified with confidence here

Graph queries for these were slow/noisy and I stopped short of a confident read rather than guess:

- `/api/orbit/*` — backed by `apps/daemon/src/orbit.ts`, a real, substantial file, but I didn't get a clean read on what it does. Name suggests it could be anything from a background-sync subsystem to a UI feature; check before deciding if it's generic or product.
- `/api/research/search` — could be a generic web-research tool capability or an OD-specific feature; unresolved.
- `/api/xai/oauth/*`, `/api/amr/models`, `/api/provider/models`, `/api/test/connection` — plausibly generic (provider auth/model-listing/connection-testing), but currently each is tied to xAI-specific or OD-specific call sites in OD's source; worth a real look at whether the underlying logic generalizes before deciding either way.
- `/api/mcp/install*`, `/api/mcp/servers`, `/api/mcp/oauth/*` — OD's MCP *client-management UI* routes, distinct from `@jini/mcp` (which is a protocol *host*, a different thing entirely) — likely OD-specific UI over MCP config, but not fully verified.
- `/api/dir-exists`, `/api/recent-dirs`, `/api/system/open-external`, `/api/dialog/open-folder` — look like desktop/Electron-bridge capabilities. Jini has `packages/desktop-host` for exactly this kind of thing via a different consumption pattern (`window.__jini__` bridge, not raw HTTP) — plausibly already covered there in a different shape, not actually missing. Worth a quick cross-check against `packages/desktop-host`'s actual surface rather than assuming.

## Bottom line

No large, structurally-forgotten route cluster turned up — the port's existing exclusion boundaries (no Project noun, no plugin-host content routes, no design-AI product surface) hold up under this ground-truth check. The real, actionable findings are narrower and concrete: multi-provider model-proxy coverage is incomplete (3 providers + catch-all missing, no excuse not to port), a handful of generic ops/config endpoints (health/ready/metrics/app-config/static-resource) have no Jini equivalent and no documented reason why not, and `packages/capability-providers` has zero real consumers despite `connectors` being the obvious route-level use case for it. Five items need a closer look before they can be classified either way (listed in §4) rather than guessed at here.
