# Jini — Directory Guide (agent entry point)

> **MANDATORY STARTUP — do this before anything else (blocking):**
> 1. Read **`AI-Dev-Shop/AGENTS.md`** and activate the AI Dev Shop multi-agent pipeline. It defines the agents, skills, and delivery workflow used to build this repo — do not proceed without loading it.
> 2. Then read **`docs/jini-port/START-HERE.md`** and **`docs/jini-port/extraction-plan.md`** for the locked architecture and the task list.
> Skipping step 1 is a blocker: the pipeline, personas, and skills that do the work live there.

**Read `docs/jini-port/START-HERE.md` first**, then `docs/jini-port/extraction-plan.md`. Those hold the locked architecture, the reasoning (every debate transcript), and the dependency-ordered task list. This file is the map; those are the authority.

## What Jini is

A general-purpose, reusable, headless, agent-drivable engine extracted from Open Design (OD). OD is one consumer of many; the engine core has **no OD tilt**. Consumers (OD, Open-Marketing, Tovu-Runner, Zana) live in their own repos and consume published `@jini/*` packages.

## Layout

- `packages/*` — **the engine** (`@jini/*`), product-neutral. Current: `protocol, core, daemon, agent-runtime, sqlite, http, cli, platform, sidecar, node-host, chat-core, chat-react, renderers-react, ui, media, capability-providers, deploy, desktop-host`. `protocol, core, daemon, agent-runtime, platform, sidecar, chat-core, media, capability-providers, deploy, desktop-host` have real implementations (`daemon`: `RunLifecycle`/`EventLog`/`ToolExecutor`; `agent-runtime`: both the `agent-protocol/` ACP+pi-rpc transport AND the `runtimes/` registry/detection/defs/stream-parsers are now ported — see `packages/agent-runtime/source-map.md`'s "Barrel merge" section); the rest are stubs pending extraction. `ui` (renamed from `components` 2026-07-16 — see `packages/ui/README.md`) holds generic, non-chat, non-OD-branded UI: primitives, feature-shaped domains, and their hooks/providers/ports — not just flat components. `media` (added 2026-07-18) is a **new addition, not yet in the locked §3 package set in `docs/jini-port/extraction-plan.md`** — a multi-provider image/video/audio generation gateway substrate (types, capability registry, video-request builder, task-store port, policy port, attachment-staging port, real vendor catalogue as reference data) ported/generalized from Open Design's `apps/daemon/src/media` + `media-adapters`. It needs Coordinator/Software-Architect sign-off before being folded into the locked list; see `packages/media/source-map.md` for full provenance and what's deferred (the actual per-vendor REST dispatch engine). `capability-providers` (added 2026-07-18) is **greenfield, no OD source, also not in the locked §3 set** — abstract auth/storage/payments/db/realtime provider ports (typed tokens + minimal in-memory reference stubs only), built speculatively per an explicit human decision with no current consumer and zero other package importing it; see `packages/capability-providers/source-map.md`. `deploy` (added 2026-07-16) is a **new addition, not yet in the locked §3 package set in `docs/jini-port/extraction-plan.md`** — it was only named in that doc's §10 roadmap-appendix prose ("Netlify / Vercel / GitHub Pages deploy targets"). It needs Coordinator/Software-Architect sign-off before being folded into the locked list; see `packages/deploy/source-map.md` for what it implements (`DeployTarget` many-token port + Vercel/Cloudflare Pages adapters) and what's deferred (GitHub Pages/Netlify targets, real `ToolExecutor` wiring for `deploy.publish`). `desktop-host` (added 2026-07-17) is, unlike `deploy`, already named in the locked §3 set — but §3 marks it `# deferred until a 2nd host exists`; it was built anyway per an explicit human decision to accelerate that deferral, scoped to the C7-recommended narrow slice (shell primitives, the `window.__jini__` bridge pattern, a `RenderService` port, and dual Electron/Tauri adapters). See `packages/desktop-host/source-map.md` for the full scope and what's still deliberately excluded (updater, deck-capture/pdf-export business logic).
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
