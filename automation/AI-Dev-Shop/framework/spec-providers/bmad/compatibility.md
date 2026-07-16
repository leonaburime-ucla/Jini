# BMAD Compatibility Flow

This file is the canonical AI Dev Shop-local compatibility contract for the `bmad` provider.

It owns the planning artifact shape, provider-local asset paths, validation command, and the read sets that core workflow files must apply when `bmad` is active.

It is not upstream BMAD-METHOD documentation.

## Asset Paths

- Compatibility root: `<AI_DEV_SHOP_ROOT>/framework/spec-providers/bmad/`
- Planning templates: `<AI_DEV_SHOP_ROOT>/framework/spec-providers/bmad/templates/`
- Mechanical validator: `python3 <AI_DEV_SHOP_ROOT>/framework/spec-providers/bmad/validators/validate_bmad_package.py <output_folder>`
  (`python` or `py` may be used only when `python3` is not available)

## Track Selection

BMAD has two tracks. The Spec Agent must ask which track to use before writing artifacts.

- **Standard BMM**: Full planning pipeline — PRD, architecture, epics, stories. Use for features with significant scope, multiple stakeholders, or technical complexity.
- **Quick Dev**: Lightweight spec-first path — a single `spec-*.md` file. Use for small features, bug fixes, or refactors where full PRD/epic planning is overhead.

## Planning Artifacts — Standard BMM Track

All files below are created under the configured output folder. AI Dev Shop defaults this to `<ADS_MEMORY_ROOT>/specs/bmad/<feature-name>/`; upstream BMAD's native default is `_bmad-output/`.

| File | Required? | Notes |
|---|---|---|
| `planning-artifacts/product-brief.md` | Optional | Strategic framing — problem, solution, who it serves |
| `planning-artifacts/PRD.md` | Always on standard track | Requirements, scope, success metrics, user stories |
| `planning-artifacts/ux-spec.md` | Conditional | When the feature has a UI surface |
| `planning-artifacts/architecture.md` | Always before epics | Technical design decisions and constraints |
| `planning-artifacts/epics/*.md` | Always before dev loop | Epic and story breakdown with BDD acceptance criteria |
| `implementation-artifacts/sprint-status.yaml` | Always before story loop | Sprint sequencing and story state tracking |
| `project-context.md` | Optional but recommended | Project-specific implementation rules (constitution equivalent) |

## Planning Artifacts — Quick Dev Track

| File | Required? | Notes |
|---|---|---|
| `spec-<feature-name>.md` | Always | Lightweight spec: intent, boundaries, I/O matrix, tasks, verification |

## Spec Package Flow — Standard BMM Track

When `bmad` is the active provider and the standard track is selected:

1. Ask the user which track to use: standard BMM or quick dev.
2. Determine the project name and feature scope from the description.
3. Use `<ADS_MEMORY_ROOT>/specs/bmad/<feature-name>/` as the default output location unless the user explicitly selected another durable project-owned location.
4. Record `spec_provider: bmad`, `provider_mode: standard_bmm`, `provider_native_root: _bmad-output/`, `provider_output_root` (default `<ADS_MEMORY_ROOT>/specs/bmad/<feature-name>/`), `spec_entrypoint_path` (pointing to `PRD.md`), `spec_readiness_artifact: PRD + architecture + epics with per-story GWT + validator pass`, and `spec_support_paths` in `pipeline-state.md`.
5. Write `PRD.md` from the template. Fill: Product Overview, Problem Statement, Requirements (Functional and Non-Functional), User Stories, Success Metrics, Scope (in/out), Constraints, Dependencies.
6. Write `architecture.md` from the template if technical design decisions are needed.
7. Write epics with stories from the template. Use BDD format: "As a [role], I want [action], so that [benefit]." Acceptance criteria must follow Given/When/Then format.
8. Optionally write `product-brief.md` if strategic framing was part of the analysis phase.
9. Run the provider-local validator. Repair any failures before declaring readiness.
   If `python3` is unavailable, try `python` or `py`; if the validator runtime
   is still unavailable, stop unless a human approves a single-line
   `validator_manual_waiver` in `pipeline-state.md` with reviewer, timestamp,
   reason, and manual checks performed.

## Spec Package Flow — Quick Dev Track

When `bmad` is the active provider and the quick dev track is selected:

1. Ask the user which track to use: standard BMM or quick dev.
2. Determine a short feature name (kebab-case).
3. Use `<ADS_MEMORY_ROOT>/specs/bmad/<feature-name>/` as the default output location unless the user explicitly selected another durable project-owned location.
4. Record `spec_provider: bmad`, `provider_mode: quick_dev`, `provider_native_root: _bmad-output/`, `provider_output_root` (default `<ADS_MEMORY_ROOT>/specs/bmad/<feature-name>/`), `spec_entrypoint_path` (pointing to `spec-<feature-name>.md`), `spec_readiness_artifact: spec with Intent + Boundaries + Tasks + Verification + GWT + validator pass`, and `spec_support_paths` in `pipeline-state.md`.
5. Write `spec-<feature-name>.md` from the quick-dev template. Fill: Intent (Problem/Approach), Boundaries (Always/Ask First/Never), I/O & Edge-Case Matrix, Code Map, Tasks & Acceptance (with Given/When/Then), Verification commands.
6. Run the provider-local validator. Repair any failures before declaring readiness.
   If `python3` is unavailable, try `python` or `py`; if the validator runtime
   is still unavailable, stop unless a human approves a single-line
   `validator_manual_waiver` in `pipeline-state.md` with reviewer, timestamp,
   reason, and manual checks performed.

## Clarification Rules

BMAD does not use inline clarification markers. Clarification happens through workflow conversation and artifact revision.

- On the standard track, add ambiguities to an "Open Questions" section at the end of `PRD.md`. Each question must have an owner.
- On the quick dev track, add ambiguities to the "Design Notes" section of `spec-*.md`.
- Present ambiguities to the human as structured questions.
- After clarification answers land, update the affected artifact sections.
- Rerun the provider-local validator after changes.

## Software Architect Read Set

Before ADR work begins:

- **Standard track**: read `PRD.md`, `architecture.md` if it exists, `product-brief.md` if it exists, `project-context.md` if it exists
- **Quick dev track**: read `spec-*.md`
- do not treat the entrypoint file as sufficient by itself — read all supporting artifacts listed in pipeline state

## Task Generation Read Set

Before generating `tasks.md`:

- **Standard track**: read epic files under `planning-artifacts/epics/`, read `architecture.md` for implementation constraints, ensure every story with acceptance criteria has task coverage
- **Quick dev track**: read the Tasks & Acceptance section in `spec-*.md`

## Planning Surface Gate — Standard BMM Track

The BMAD standard-track compatibility gate is satisfied only when all of the following are true:

- `PRD.md` exists and has filled Requirements and User Stories sections
- `architecture.md` exists with technical decisions
- at least one epic file exists under `planning-artifacts/epics/` with stories
- all stories have acceptance criteria in Given/When/Then format
- no template placeholders remain in any artifact
- the provider-local validator exits successfully, or a human-approved
  single-line `validator_manual_waiver` exists because the runtime was unavailable

## Planning Surface Gate — Quick Dev Track

The BMAD quick-dev compatibility gate is satisfied only when all of the following are true:

- `spec-*.md` exists with filled Intent, Boundaries, Tasks & Acceptance, and Verification sections
- acceptance criteria follow Given/When/Then format
- no template placeholders remain
- the provider-local validator exits successfully, or a human-approved
  single-line `validator_manual_waiver` exists because the runtime was unavailable

## Maintainer Rule

If BMAD-specific workflow behavior changes, update this file and the provider-local assets here first. Core workflow files should only reference this contract, not become a second source of truth for BMAD behavior.
