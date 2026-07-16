# Maintainers

This folder is for **toolkit maintenance work**, not normal project feature delivery.

Use this area when you are changing the AI Dev Shop framework itself:
- evolving agent instructions or format standards
- running migrations/refactors of framework structure
- documenting framework-level rollout plans and historical decisions

Do **not** use this area for:
- feature specs for an app/project
- runtime pipeline outputs
- normal delivery artifacts

## Folder Map
- `guides/`
  - Maintainer implementation guides
  - Integration/migration writeups
  - Historical design rationale for framework changes
- `skill-md-format/`
  - Instruction-format standards
  - Agent overlays and rollout gates
  - Rewrite drafts and execution tracking for skill format changes

## Runtime vs Maintainer Boundary
- Runtime authority stays in:
  - `AGENTS.md`
  - `agents/`
  - `skills/`
  - `framework/`
  - `project-knowledge-template/` (repo-local template of the workspace surface: governance, memory, reports, meta, tmp, local artifacts)
- Maintainer authority for framework evolution stays in:
  - `harness-engineering/maintainers/`

If you are unsure: if the change affects how the toolkit itself behaves across projects, it belongs here.
