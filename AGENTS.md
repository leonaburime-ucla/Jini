# Jini — Directory Guide (agent entry point)

> **MANDATORY STARTUP — do this before anything else (blocking):**
> 1. Read **`automation/AI-Dev-Shop/AGENTS.md`** and activate the AI Dev Shop multi-agent pipeline. It defines the agents, skills, and delivery workflow used to build this repo — do not proceed without loading it.
> 2. Then read **`docs/jini-port/START-HERE.md`** and **`docs/jini-port/extraction-plan.md`** for the locked architecture and the task list.
> Skipping step 1 is a blocker: the pipeline, personas, and skills that do the work live there.

**Read `docs/jini-port/START-HERE.md` first**, then `docs/jini-port/extraction-plan.md`. Those hold the locked architecture, the reasoning (every debate transcript), and the dependency-ordered task list. This file is the map; those are the authority.

## What Jini is

A general-purpose, reusable, headless, agent-drivable engine extracted from Open Design (OD). OD is one consumer of many; the engine core has **no OD tilt**. Consumers (OD, Open-Marketing, Tovu-Runner, Zana) live in their own repos and consume published `@jini/*` packages.

## Layout

- `packages/*` — **the engine** (`@jini/*`), product-neutral. Current: `protocol, core, daemon, agent-runtime, sqlite, http, cli, platform, sidecar, node-host, chat-core, chat-react, renderers-react, components`. All are stubs pending extraction.
- `integrations/open-design/` — the OD adapter (strangler daemon lands here; keeps OD's file tree so upstream fixes `format-patch` in). `reference/od-web-src.orig/` is the real OD web tree for later frontend extraction.
- `apps/reference-web/` — Vite reference host (fake transport). `examples/minimal-host/` — imports ONLY `@jini/*`; the neutrality CI gate.
- `automation/` — the AI dev control-plane (separate concern from the engine; never imported by `@jini/*`). `AI-Dev-Shop/` (declarative pipeline, vendored) + `ADS-memory/` (durable decisions) + `project-runner/` (the execution runtime to build — minimal SQLite ledger first).
- `docs/jini-port/` — all architecture docs, recon, and debate transcripts from the 2026-07-16 design session.
- `scripts/` — `guard.ts`, `check-engine-boundaries.ts`, `check-protocol-purity.ts`.

## Hard boundaries (enforced by scripts/guard.ts)

- `packages/@jini/**` MUST NOT import `apps/**`, `integrations/**`, `examples/**`, or `automation/**`.
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
