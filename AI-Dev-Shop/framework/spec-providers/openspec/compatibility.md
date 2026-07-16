# OpenSpec Compatibility Flow

This file is the canonical AI Dev Shop-local compatibility contract for the `openspec` provider.

It owns the change folder shape, provider-local asset paths, validation command, and the read sets that core workflow files must apply when `openspec` is active.

It is not upstream OpenSpec documentation.

## Asset Paths

- Compatibility root: `<AI_DEV_SHOP_ROOT>/framework/spec-providers/openspec/`
- Change folder templates: `<AI_DEV_SHOP_ROOT>/framework/spec-providers/openspec/templates/`
- Mechanical validator: `python3 <AI_DEV_SHOP_ROOT>/framework/spec-providers/openspec/validators/validate_openspec_package.py <change_folder>`
  (`python` or `py` may be used only when `python3` is not available)

## Change Folder Files

All files below are created within a change folder under the AI Dev Shop OpenSpec root, default `<ADS_MEMORY_ROOT>/specs/openspec/changes/<change-name>/`. Template files live under `templates/`.

| File | Required? | Notes |
|---|---|---|
| `proposal.md` | Always | Change intent: why, what changes, capabilities, impact |
| `specs/<domain>/spec.md` | Always | Delta requirements — ADDED, MODIFIED, or REMOVED per domain |
| `design.md` | Conditional | Technical design — required by default `spec-driven` schema |
| `tasks.md` | Always before apply | Implementation checklist with checkbox items |
| `.openspec.yaml` | Only for expanded workflow | Change metadata and schema selection |

## Spec Package Flow

When `openspec` is the active provider:

1. Resolve the OpenSpec root: use the user's explicit durable project-owned location when provided, otherwise default to `<ADS_MEMORY_ROOT>/specs/openspec/`. Read `<resolved-openspec-root>/config.yaml` for project context if it exists.
2. Determine the change name from the feature description (kebab-case, e.g., `add-user-auth`).
3. Create the change folder: `<resolved-openspec-root>/changes/<change-name>/` and `<resolved-openspec-root>/changes/<change-name>/specs/`.
4. Record `spec_provider: openspec`, `provider_native_root: openspec/`, `provider_output_root` (the resolved OpenSpec root), `spec_entrypoint_path` (pointing to `proposal.md`), `spec_readiness_artifact: all apply-required artifacts present`, `provider_change_id: <change-name>`, and `spec_support_paths` in `pipeline-state.md`.
5. Write `proposal.md` from the template. Fill: Why (motivation), What Changes (concrete description), Capabilities (new and modified domain names), Impact (affected code, APIs, dependencies).
6. For each capability listed in the proposal, create a delta spec at `specs/<domain>/spec.md`. Use ADDED, MODIFIED, or REMOVED sections. Each requirement must use RFC 2119 keywords (SHALL, MUST, SHOULD, MAY) and have at least one Scenario with WHEN/THEN format.
7. Write `design.md` from the template if the feature involves technical decisions. Fill: Context, Goals/Non-Goals, Decisions, Risks/Trade-offs.
8. Write `tasks.md` from the template. Group tasks under numbered headings. Use checkbox format (`- [ ]`) for each task. Order by dependency.
9. Run the provider-local validator. Repair any failures before declaring readiness.
    If `python3` is unavailable, try `python` or `py`; if the validator runtime
    is still unavailable, stop unless a human approves a single-line
    `validator_manual_waiver` in `pipeline-state.md` with reviewer, timestamp,
    reason, and manual checks performed.

## Clarification Rules

OpenSpec does not use inline clarification markers. Clarification happens through iterative revision of `proposal.md` and delta specs.

- When ambiguity exists, note it in the proposal's "What Changes" section with a clear question.
- Present ambiguities to the human as structured questions.
- After clarification answers land, update the affected `proposal.md` sections and delta specs.
- Rerun the provider-local validator after changes.

## Software Architect Read Set

Before ADR work begins:

- read `proposal.md` for change intent and scope
- read every delta spec under `specs/` for requirements and scenarios
- read relevant baseline specs from `<resolved-openspec-root>/specs/` for modified capabilities
- read `design.md` when present for existing technical decisions
- do not treat `proposal.md` as sufficient by itself — the delta specs contain the actual requirements

## Task Generation Read Set

Before generating `tasks.md`:

- read `tasks.md` from the change folder for existing task structure (if already generated)
- read all delta specs under `specs/` for requirement coverage
- read `design.md` decisions for implementation constraints
- ensure every requirement with a Scenario has task coverage

## Planning Surface Gate

The OpenSpec compatibility gate is satisfied only when all of the following are true:

- `proposal.md` exists and has filled "Why" and "What Changes" sections
- at least one delta spec exists under `specs/` with at least one requirement and scenario
- `design.md` exists (required by default `spec-driven` schema; omit only with explicit justification in proposal.md)
- `tasks.md` exists with at least one checkbox item
- no template placeholders remain in any artifact
- the provider-local validator exits successfully, or a human-approved
  single-line `validator_manual_waiver` exists because the runtime was unavailable

## Maintainer Rule

If OpenSpec-specific workflow behavior changes, update this file and the provider-local assets here first. Core workflow files should only reference this contract, not become a second source of truth for OpenSpec behavior.
