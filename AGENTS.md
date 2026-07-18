# Jini — Directory Guide (agent entry point)

> **MANDATORY STARTUP — do this before anything else (blocking):**
> 1. Read **`AI-Dev-Shop/AGENTS.md`** and activate the AI Dev Shop multi-agent pipeline. It defines the agents, skills, and delivery workflow used to build this repo — do not proceed without loading it.
> 2. Then read **`docs/jini-port/START-HERE.md`** and **`docs/jini-port/extraction-plan.md`** for the locked architecture and the task list.
> Skipping step 1 is a blocker: the pipeline, personas, and skills that do the work live there.

> **⚠️ PORT STATUS — how much is actually left (read before trusting "done"):**
> Jini is **early, not near-complete.** The `@jini/*` list below is real, tested
> code — but it is a set of *fragments*, and **there is no runnable daemon.** The
> entire backend service spine (`server.ts`, `cli.ts` bootstrap, `routes/`,
> `mcp.ts`, `start-chat-run.ts`, `db.ts` schema, `plugins/` host) — **~49K lines** —
> is **absent**, and `@jini/node-host`'s `createLocalNodeDaemon` assembly does not
> exist. Measured 2026-07-18: **~73.5K lines ported** (of which ~15K frontend is
> *unaudited*), **~93K generic still to port** (the ~49K backend spine is the
> load-bearing gap), and **~364K of OD is *product*** that must stay out of the
> neutral engine. **Do not read the package list below as "the engine is mostly
> built."** Full breakdown: **`ADS-memory/reports/od-port-status-2026-07-18.md`**
> and `ADS-memory/reports/daemon-full-gap-map-2026-07-18.md`.

**Read `docs/jini-port/START-HERE.md` first**, then `docs/jini-port/extraction-plan.md`. Those hold the locked architecture, the reasoning (every debate transcript), and the dependency-ordered task list. This file is the map; those are the authority.

## What Jini is

A general-purpose, reusable, headless, agent-drivable engine extracted from Open Design (OD). OD is one consumer of many; the engine core has **no OD tilt**. Consumers (OD, Open-Marketing, Tovu-Runner, Zana) live in their own repos and consume published `@jini/*` packages.

## Layout

- `packages/*` — **the engine** (`@jini/*`), product-neutral. Current: `protocol, core, daemon, agent-runtime, sqlite, http, cli, platform, sidecar, node-host, chat-core, chat-react, renderers-react, ui, deploy, registry, memory, media, capability-providers, desktop-host`. `protocol, core, daemon, agent-runtime, platform, sidecar, chat-core, deploy, registry, memory, media, capability-providers, desktop-host` have real implementations (`daemon`: `RunLifecycle`/`EventLog`/`ToolExecutor`; `agent-runtime`: both the `agent-protocol/` ACP+pi-rpc transport AND the `runtimes/` registry/detection/defs/stream-parsers are now ported — see `packages/agent-runtime/source-map.md`'s "Barrel merge" section); the rest are stubs pending extraction. `ui` (renamed from `components` 2026-07-16 — see `packages/ui/README.md`) holds generic, non-chat, non-OD-branded UI: primitives, feature-shaped domains, and their hooks/providers/ports — not just flat components. `deploy` (added 2026-07-16), `registry` and `memory` (both added 2026-07-18), `media` and `capability-providers` (both added 2026-07-18), and `desktop-host` (added 2026-07-17) are **new additions, not yet in the locked §3 package set in `docs/jini-port/extraction-plan.md`** (except `desktop-host`, which §3 already names but marks `# deferred until a 2nd host exists` — built anyway per an explicit human decision to accelerate that deferral). `deploy` was only named in that doc's §10 roadmap-appendix prose ("Netlify / Vercel / GitHub Pages deploy targets"); `registry`/`memory`/`media`/`capability-providers` weren't named there at all. All need Coordinator/Software-Architect sign-off before being folded into the locked list; see each package's `source-map.md` for what it implements and what's deferred/skipped (`packages/deploy/source-map.md`: `DeployTarget` many-token port + Vercel/Cloudflare Pages adapters, deferred GitHub Pages/Netlify targets + real `ToolExecutor` wiring; `packages/registry/source-map.md`: pluggable static/GitHub/database registry backends; `packages/memory/source-map.md`: a generic frontmatter note-store + extraction-attempt log + self-verify scorecard enforcer, with the OD-specific connector-mining/coding-agent-CLI/heuristic-regex/prompt-composition pieces explicitly left un-ported; `packages/media/source-map.md`: a multi-provider image/video/audio generation gateway substrate ported/generalized from Open Design's `apps/daemon/src/media` + `media-adapters`, deferring the actual per-vendor REST dispatch engine; `packages/capability-providers/source-map.md`: greenfield, no OD source, abstract auth/storage/payments/db/realtime provider ports built speculatively per an explicit human decision with no current consumer; `packages/desktop-host/source-map.md`: shell primitives, the `window.__jini__` bridge pattern, a `RenderService` port, and dual Electron/Tauri adapters, still deliberately excluding updater and deck-capture/pdf-export business logic).
- `integrations/open-design/` — the OD adapter (strangler daemon lands here; keeps OD's file tree so upstream fixes `format-patch` in). `reference/od-web-src.orig/` is the real OD web tree for later frontend extraction.
- `apps/reference-web/` — Vite reference host (fake transport). `examples/minimal-host/` — imports ONLY `@jini/*`; the neutrality CI gate.
- `AI-Dev-Shop/` — the declarative pipeline toolkit (vendored, agents/skills/routing), read-only during normal feature work.
- `ADS-memory/` — durable decisions/specs/reports (project-owned workspace, sibling to `AI-Dev-Shop/`).
- `automation/` — the AI dev control-plane's executable half (separate concern from the engine; never imported by `@jini/*`). `project-runner/` (the execution runtime to build — minimal SQLite ledger first) lives here.
- `docs/jini-port/` — all architecture docs, recon, and debate transcripts from the 2026-07-16 design session.
- `scripts/` — `guard.ts`, `check-engine-boundaries.ts`, `check-protocol-purity.ts`.

## Hard boundaries (enforced by scripts/guard.ts)

- `packages/@jini/**` MUST NOT import `apps/**`, `integrations/**`, `examples/**`, `automation/**`, or `AI-Dev-Shop/**`.
- `@jini/protocol` MUST NOT import any OD DTO (downward-only edge).
- No product-identity strings (`Open Design`, `OD_`, `--od-stamp`, `/tmp/open-design`) in `packages/@jini/**`.
- `automation/**` MUST NOT share domain types with the engine (vocabulary firewall: engine {Run, Agent, Tool} vs automation {PipelineRun, WorkItem, JobAttempt, Persona}). It MAY consume `@jini/agent-runtime` only as a pinned leaf subprocess library.

## Commands

```
pnpm install
pnpm guard        # boundary + neutrality checks
pnpm typecheck
```

## Provenance

Apache-2.0 (inherited from OD). See `NOTICE` and per-package `source-map.md`. Backups of the pre-extraction `integrated` OD trunk are in `../jini-backups/`.
