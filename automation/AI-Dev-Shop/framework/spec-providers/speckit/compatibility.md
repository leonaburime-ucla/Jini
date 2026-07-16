# Speckit Compatibility Flow

This file is the canonical AI Dev Shop-local compatibility contract for the `speckit` provider.

It owns the strict package shape, provider-local asset paths, validation command, and the read sets that core workflow files must apply when `speckit` is active.

It is not upstream Spec Kit documentation.

## Asset Paths

- Compatibility root: `<AI_DEV_SHOP_ROOT>/framework/spec-providers/speckit/`
- Strict package templates: `<AI_DEV_SHOP_ROOT>/framework/spec-providers/speckit/templates/spec-system/`
- Mechanical validator: `python3 <AI_DEV_SHOP_ROOT>/framework/spec-providers/speckit/validators/validate_spec_package.py <spec_folder_dir>`
  (`python` or `py` may be used only when `python3` is not available)

## Strict Package Files

All files below are created in the provider-owned feature spec folder. AI Dev Shop defaults that folder to `<ADS_MEMORY_ROOT>/specs/<NNN>-<feature-name>/`. Template files live under `templates/spec-system/`.

| File | Required? | Notes |
|---|---|---|
| `feature.spec.md` | Always | Primary requirements entrypoint |
| `api.spec.md` | Conditional | Needed when the feature exposes or consumes an API |
| `state.spec.md` | Conditional | Needed when the feature manages durable or stateful data |
| `orchestrator.spec.md` | Conditional | Needed when the feature has coordinator or orchestration logic |
| `ui.spec.md` | Conditional | Needed when the feature has a UI surface |
| `errors.spec.md` | Conditional | Needed when the feature defines error codes or recovery paths |
| `behavior.spec.md` | Conditional | Needed when ordering, precedence, or deduplication rules matter |
| `traceability.spec.md` | Always | Must include every REQ, AC, INV, and EC id |
| `spec-manifest.md` | Always | Package index listing present and omitted files plus stage read sets |
| `spec-dod.md` | Always | Hard gate before `/plan` |

## Spec Package Flow

When `speckit` is the active provider:

1. Use the target folder supplied by the Coordinator or Spec Agent. If no explicit user override exists, default to `<ADS_MEMORY_ROOT>/specs/<NNN>-<feature-name>/`.
2. Ask whether spec files should use `prefixed` or `standard` naming.
3. Create the feature folder and the matching pipeline report folder.
4. Record `spec_provider`, `provider_native_root: specs/`, `provider_output_root` (the actual feature spec folder), `spec_path`, `spec_entrypoint_path`, `spec_readiness_artifact`, `spec_support_paths`, and `spec_naming` in `pipeline-state.md`.
5. Determine which conditional files apply and record omissions in `spec-manifest.md` with concrete reasons.
6. Write `feature.spec.md` and every applicable contract file from the provider-local template root.
7. Seed `traceability.spec.md` from every REQ, AC, INV, and EC in `feature.spec.md`, plus any error or behavior rows already defined.
8. Fill `spec-manifest.md` with actual filenames, applicability, and stage read sets for Software Architect, TDD, and Programmer.
9. Fill `spec-dod.md`. Every item must be `PASS` or `NA` with justification.
10. Inline at most 3 `[NEEDS CLARIFICATION: ...]` markers while drafting, then resolve all of them before handoff.
11. Compute the canonical content hash for `feature.spec.md` with the
    provider-local validator; do not invent or visually compute the hash.
12. Complete the Spec Agent row in the `spec-dod.md` Sign-Off Block. Leave the
    Coordinator row blank for Coordinator Planning Preflight.
13. Run the provider-local validator with `--phase spec --update-hash` and
    repair any failures before declaring Spec handoff readiness. If `python3`
    (or `python`/`py` fallback) or the validator runtime is unavailable, stop
    unless the human approves a single-line `validator_manual_waiver` in
    `pipeline-state.md` with reviewer, timestamp, reason, and manual checks
    performed.
14. The Coordinator completes or replaces the Coordinator sign-off row during
    Planning Preflight and reruns the validator with `--phase preflight` before
    Software Architect dispatch.

## Canonical Hash Rule

For Speckit compatibility packages, `content_hash` in `feature.spec.md` is
computed as:

1. Normalize line endings to LF.
2. Remove the `## Header Metadata` section, including its metadata table and the
   single blank line that terminates that table.
3. Strip trailing whitespace from every remaining line.
4. Remove leading and trailing blank lines from the remaining content.
5. Append exactly one trailing LF.
6. Compute `sha256` over the UTF-8 bytes and record it as
   `sha256:<64 lowercase hex characters>`.

The provider-local validator implements this rule and is the mechanical source
of truth for hash verification. During Spec and Clarify work, run it with
`--update-hash` to rewrite `content_hash`; during Coordinator Planning
Preflight, run it without `--update-hash` so approved artifacts are checked
without mutation.

## Clarification Rules

- Read `spec-manifest.md` first.
- Read the actual feature spec file named there, plus any other `PRESENT` files that contain the ambiguity.
- If `spec-manifest.md` is missing, treat that as a package defect. Fall back to `feature.spec.md` only long enough to request repair.
- After clarification answers land, update every affected file, including `traceability.spec.md`, `spec-manifest.md`, and `spec-dod.md` when applicability or stage read sets changed.
- Recompute the content hash and rerun the provider-local validator.

## Software Architect Read Set

Before ADR work begins:

- read `spec-manifest.md`
- read every file marked `PRESENT`
- do not treat `feature.spec.md` as sufficient by itself
- run the provider-local validator with `--phase preflight`, or stop for a
  human-approved single-line `validator_manual_waiver` only when the runtime is
  unavailable

## Task Generation Read Set

Before generating `tasks.md`:

- read `spec-manifest.md`
- read `traceability.spec.md`
- ensure every P1 AC, invariant, edge case, and present contract file has explicit task coverage or an ADR-backed deferral

## Planning Surface Gate

The Speckit compatibility gate is satisfied only when all of the following are true:

- `spec-manifest.md` exists and lists all 10 logical files with `PRESENT` or `OMITTED`
- all always-required files exist on disk
- every file marked `PRESENT` in `spec-manifest.md` exists on disk
- `spec-dod.md` contains only `PASS` or `NA`
- every `NA` row in `spec-dod.md` has a concrete justification in Notes
- the `spec-dod.md` Sign-Off Block has the Spec Agent row filled by Spec handoff
  and the Coordinator row filled or verified by Coordinator Planning Preflight
- zero unresolved blocking markers remain, including `[NEEDS CLARIFICATION]`,
  `[HUMAN DATA REQUEST]`, `[CONTRACT VS IMPLEMENTATION]`,
  `[DISTRIBUTED TRANSACTION RISK]`, and `[OWNERSHIP UNCLEAR]`
- traceability has no known gaps
- the implementation-readiness gate passed
- `content_hash` in `feature.spec.md` matches the canonical hash rule
- the provider-local validator exits successfully with `--phase preflight`, or a
  human-approved single-line `validator_manual_waiver` exists because the
  runtime was unavailable
- if the feature is brownfield or reverse-spec derived, the Brownfield
  References section in `spec-manifest.md` records the required evidence paths
  from CodeBase Analyzer and/or reverse-spec extraction

## Maintainer Rule

If Speckit-specific workflow behavior changes, update this file and the provider-local assets here first. Core workflow files should only reference this contract, not become a second source of truth for Speckit behavior.
