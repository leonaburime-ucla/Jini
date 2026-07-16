# Project Knowledge

`ADS-memory/` is the project-owned workspace for AI Dev Shop. It is where forward specs, retained project artifacts, memory, reports, decisions, workflow notes, and handoff context should live when the toolkit is used in a real repo.

A project needs this shared workspace so multiple people or agents can see the durable work that has already happened: approved specs, architecture decisions, review findings, benchmark results, session notes, and other context that should survive beyond one chat or one local run.

## How To Use This Template

- Keep `project-knowledge-template/` pristine and committed. Treat it as the shipped template and example surface for downstream users.
- Create a writable `ADS-memory/` workspace from this template when using the toolkit in a real repo. `ADS-memory/` will then be a sibling directory of `AI-Dev-Shop/`.
- In exceptional local setups, a repo-root `ADS-memory/` is acceptable as long as it stays ignored by git.
- Use `ADS-memory/` for retained project-owned specs, artifacts, memory, and workflow notes. Only edit this committed template when you intentionally want to change the default scaffold for future workspaces.

## Folders

- `governance/`: project-governance template surface, including the default constitution and future project-specific overrides
- `knowledge/`: live project knowledge files only (`project_memory.md`, `learnings.md`, `project_notes.md`, `memory-store.md`)
- `sessions/`: per-conversation session records (date/time, user, model(s), summary, Q&A, decisions)
- `specs/`: provider-native forward specs and planning artifacts for new feature work
- `reports/`: retained writable artifacts, benchmarks, audits, continuity logs, and pipeline outputs
- `specs_as_built/`: curated current-state implementation knowledge generated from reverse-spec and post-implementation capture
- `.local-artifacts/`: ignored local-only scratch output for toolkit maintenance and local runs
- `meta/`: workspace metadata, workflow notes, and future migration/version markers

Static toolkit-control docs no longer belong here. They live under:

- `framework/` for runtime rules, routing, governance, operations, templates, and examples
- `harness-engineering/` for validators, maintainer docs, quality policies, and skills-inbox curation machinery
