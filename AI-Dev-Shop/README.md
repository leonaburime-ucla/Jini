# AI Dev Shop Foundation

Drop this toolkit into a project and point your coding agent at `AGENTS.md`.

`AGENTS.md` is the runtime authority. `README.md` is setup and maintainer guidance only.

## Install

Copy the toolkit into your project root:

```bash
cp -r AI-Dev-Shop/ your-project/AI-Dev-Shop/
```

Add this line to the startup file your tool reads at the project root:

```md
Read `AI-Dev-Shop/AGENTS.md` for the AI Dev Shop multi-agent pipeline.
```

Common entry points:
- `CLAUDE.md` for Claude Code
- `GEMINI.md` or `CLAUDE.md` for Gemini CLI and Codex CLI
<!-- - `.cursor/rules/*.mdc` for Cursor -->
<!-- - `.github/copilot-instructions.md` for GitHub Copilot -->

## What This Is

AI Dev Shop Foundation is a drop-in multi-agent delivery framework for coding agents. It turns an open-ended "build this feature" request into a structured pipeline with explicit stages for analysis, spec writing, architecture, test design, implementation, review, security, and docs.

In practice, this gives a repo a repeatable way to move from idea to working code without relying on a single giant prompt or ad hoc agent behavior.

```text
[VibeCoder] -> [CodeBase Analyzer] -> [System Design] -> Spec
-> [Red-Team] -> Software Architect -> [Database] -> TDD
-> Programmer -> [QA/E2E] -> TestRunner -> Code Review
-> [Refactor] -> Security -> [DevOps] -> [Docs] -> Done
```

- `[VibeCoder]` is an optional starting point - say "switch to vibecoder" or `/agent vibecoder` to prototype fast, then promote to the full pipeline when ready
- `[Observer]` is passive and active across all stages when enabled
- `[...]` stages are optional; dispatched by Coordinator when spec/ADR triggers them or when you specifically ask for them

## Spec Providers

The toolkit now treats the upstream planning framework as a provider.

- Default provider: `speckit`
- Swappable provider profiles: `openspec`, `bmad`
- Active provider file: `framework/spec-providers/active-provider.md`
- Provider contract: `framework/spec-providers/core/provider-contract.md`

This keeps provider-specific planning assumptions in one folder instead of spreading Speckit-only rules through the whole toolkit.

Current status:
- `speckit` is validated in this repo
- `openspec` is scaffolded but not yet tested end-to-end in this repo
- `bmad` is scaffolded but not yet tested end-to-end in this repo

## Quick Overview

- **For**: teams and solo builders who want coding agents to work through a defined software-delivery process instead of improvising
- **Does**: routes work through specialized agents like Coordinator, Spec, Software Architect, TDD, Programmer, Code Review, and Security
- **Produces**: durable artifacts such as specs, ADRs, task lists, test certifications, review findings, and project memory
- **Fits**: existing codebases and greenfield projects; the toolkit lives alongside your app rather than replacing it, while project-owned state lives in a sibling `ADS-memory/` folder

## Why It Exists

Most agent workflows are strong at generating code but weak at preserving intent, surfacing risks, and keeping decisions auditable. This toolkit adds:

- a runtime contract in `AGENTS.md`
- a standard pipeline from request to implementation
- a clean split between toolkit source and project-owned writable state
- clear human approval points before architecture, implementation, and shipping

## How It Works

1. Install the toolkit into your repository.
2. Point your coding tool at `AI-Dev-Shop/AGENTS.md`.
3. Confirm or switch the active spec provider in `framework/spec-providers/active-provider.md`.
4. Start in Coordinator mode or invoke a pipeline command.
5. The framework routes work through the right agents and writes project-owned artifacts under a sibling `ADS-memory/` folder.

## At A Glance

```text
Idea/request
  -> Coordinator routes work
  -> Specialists produce specs, architecture, tests, code, and reviews
  -> Humans approve key checkpoints
  -> Repository gains both implementation and a paper trail
```

## Slash Commands

Claude Code can load the built-in slash command templates. Install is opt-in and
collision-checked so it never overwrites a command your host already has (e.g. an
existing `/code-review`):

```bash
# Preview what would change (NEW / IDENTICAL / CONFLICT), no writes:
bash AI-Dev-Shop/framework/operations/scripts/install-slash-commands.sh --check
# Install the safe ones; conflicts are skipped unless you pass --overwrite:
bash AI-Dev-Shop/framework/operations/scripts/install-slash-commands.sh --install
```

Other hosts do not support native slash commands. For those, open the matching file in `framework/slash-commands/` and paste its contents manually.

Built-in templates include staged delivery commands plus utility commands such as `/audit-work`, `/cowork`, and `/handoff`.

## First-Time Project Setup

The easiest path is to ask your coding agent to run setup for you:

```text
Run AI Dev Shop first-time setup. Show me what you will create before writing files.
```

The agent should then:

1. Run the setup script in dry-run mode.
2. Show you the planned files and folders.
3. Wait for your approval.
4. Run the real setup script for you.

You do not need to run the Bash commands yourself unless you prefer manual setup.

Manual fallback:

```bash
bash AI-Dev-Shop/framework/operations/scripts/setup-project-knowledge.sh --dry-run
bash AI-Dev-Shop/framework/operations/scripts/setup-project-knowledge.sh
```

The setup script:

- Confirms the active provider from [framework/spec-providers/active-provider.md](framework/spec-providers/active-provider.md).
- Creates `ADS-memory/` as a sibling directory of `AI-Dev-Shop/`.
- Creates the shared workspace folders for specs, governance, memory, reports, metadata, and local scratch.
- Copies [framework/templates/bootstrap/workspace-gitignore.template](framework/templates/bootstrap/workspace-gitignore.template) to `ADS-memory/.gitignore` so `.local-artifacts/` stays local by default.
- Creates `ADS-memory/governance/constitution.md` from [framework/templates/bootstrap/constitution-template.md](framework/templates/bootstrap/constitution-template.md) if no constitution exists.
- Creates starter project memory files under `ADS-memory/knowledge/` without overwriting existing files.

After setup, customize and approve:

- `ADS-memory/governance/constitution.md`
- `ADS-memory/knowledge/project_memory.md`

For team projects, commit `ADS-memory/` to the host repo so other programmers and agents can see the same durable project context: specs, architecture decisions, review findings, reports, workflow notes, and memory. Do not commit `ADS-memory/.local-artifacts/`; it is local scratch space.

Optional for live website debugging: follow [framework/templates/bootstrap/playwright-mcp-setup.md](framework/templates/bootstrap/playwright-mcp-setup.md) to register the current browser-automation provider with your client. This is host setup, not a repo dependency.

After setup, start with the Coordinator in Review Mode, or run `/spec` once slash commands are installed.

Forward spec packages go under `ADS-memory/specs/` by default. Retained pipeline artifacts go under `ADS-memory/reports/`. Local scratch goes under `ADS-memory/.local-artifacts/`.

## Optional Live Browser Analysis

AI Dev Shop can use a host-configured browser automation provider to open a running app, inspect the rendered UI, and verify fixes against real browser behavior.

- Capability name: `browser_automation`
- Current provider mapping: Playwright MCP
- Ownership model: the user installs the MCP server in their client; the repo detects and uses it when present

This keeps the framework modular. If a better browser provider replaces Playwright later, the capability can stay the same while the provider mapping changes.

## Key Files

- [AGENTS.md](AGENTS.md): runtime contract, modes, routing rules
- [framework/spec-providers/active-provider.md](framework/spec-providers/active-provider.md): active planning provider and switch rules
- [framework/spec-providers/core/provider-contract.md](framework/spec-providers/core/provider-contract.md): provider boundary used by the pipeline
- [framework/operations/scripts/setup-project-knowledge.sh](framework/operations/scripts/setup-project-knowledge.sh): first-time workspace setup helper
- [framework/workflows/multi-agent-pipeline.md](framework/workflows/multi-agent-pipeline.md): detailed stage execution rules
- [framework/workflows/conventions.md](framework/workflows/conventions.md): file placement and writable/read-only rules
- [framework/spec-providers/speckit/provider.md](framework/spec-providers/speckit/provider.md): default provider mapping and current Speckit compatibility shims
- [framework/templates/adr-template.md](framework/templates/adr-template.md): ADR template used by Software Architect
- [harness-engineering/README.md](harness-engineering/README.md): harness layer, validators, rollout plan, and local source notes

Agent roster note: the toolkit is extensible. `AGENTS.md` lists the current default agents, not a fixed maximum count.

## Repository Architecture

This toolkit keeps its engine files grouped while preserving a clean split between framework source and project-owned state:

- **The Engine (Read-Only):** `agents/`, `skills/`, `framework/`, and `harness-engineering/` are the toolkit control surface. They stay read-only during normal host-project work so ADS can be updated independently without mixing framework logic with project state.
- **The Workspace Template (Repo-Local):** `project-knowledge-template/` is the committed template for the writable workspace shape. It ships defaults, examples, and bootstrap-ready files for specs, governance, memory, reports, metadata, local artifacts, and project-owned workflow notes.
- **The Project Workspace (Writable):** `ADS-memory/` is the project-owned sibling workspace. Agents write forward specs to `ADS-memory/specs/`, retained artifacts to `ADS-memory/reports/`, memory to `ADS-memory/knowledge/`, the real constitution to `ADS-memory/governance/constitution.md`, local scratch to `ADS-memory/.local-artifacts/`, and future workspace metadata to `ADS-memory/meta/`.

For the host application itself, keep app-specific product docs in the host repo, not in the toolkit internals. `AI-Dev-Shop/` ships the engine and templates; `ADS-memory/` is where the toolkit stores project-owned state that should travel with the host repo.

## Architecture Defaults

- Default macro shape: modular monolith.
- Feature ownership: vertical slices when boundaries matter.
- Use hexagonal boundaries where external I/O or business-critical logic justify them.
- Use Orc-BASH for React frontends.
- Do not force architecture ceremony onto trivial CRUD, scripts, or short-lived work.

## Design Philosophy

This toolkit is a portable, self-contained set of markdown files, templates, and agent instructions that can be dropped into a repository to standardize AI behavior and project governance without external databases or complex setup. The current default planning provider is Speckit, but provider selection is now isolated under `framework/spec-providers/` so the upstream planning surface can be swapped without rewriting the rest of the pipeline.

Furthermore, this framework is built on **Harness Engineering** principles. Rather than relying purely on prompt engineering to make an AI model smarter, this toolkit provides a deterministic "harness" (state machines, durable memory files, strict routing, and validation loops) that wraps the non-deterministic LLM. It treats the agent as the Model + the Harness.

## Maintainers

- Normal feature work should not edit `agents/`, `skills/`, `framework/spec-providers/`, `framework/templates/`, `framework/workflows/`, or `framework/slash-commands/`.
- If the user explicitly asks to maintain or upgrade the toolkit itself, treat that as framework maintainer work.
- Maintainer-only rollout notes and design history live under [harness-engineering/maintainers/README.md](harness-engineering/maintainers/README.md).
- Bootstrap-only scaffolding lives under [framework/templates/bootstrap/README.md](framework/templates/bootstrap/README.md).
- Archived audit artifacts live under [harness-engineering/archive/README.md](harness-engineering/archive/README.md).
