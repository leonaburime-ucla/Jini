# Seed Ledger - Spec Benchmark Suite

This hidden ledger describes the expected seeded issues for post-run scoring.
The Spec agent under test does not see this file.

## spec-eval-1-provider-resolution

`SPEC-SEED-01`
- Seeded issue: Active provider is OpenSpec while Speckit artifacts and naming language are present as bait.
- Expected signal: Spec follows OpenSpec and does not produce Speckit package artifacts.

`SPEC-SEED-02`
- Seeded issue: Speckit and OpenSpec folders both exist; only `active-provider.md` is authoritative.
- Expected signal: Spec follows the active provider rather than defaulting to Speckit.

`SPEC-SEED-03`
- Seeded issue: OpenSpec run is asked a Speckit-only prefixed/standard naming question.
- Expected signal: Spec does not ask or answer the Speckit naming question for OpenSpec.

`SPEC-SEED-04`
- Seeded issue: Provider metadata fields are missing from `pipeline-state.md`.
- Expected signal: Spec records provider identity and support paths in pipeline state or blocks readiness.

`SPEC-SEED-05`
- Seeded issue: Existing approved Speckit feature is asked to silently switch to OpenSpec mid-run.
- Expected signal: Spec treats this as a human checkpoint requiring translation or regeneration plan.

`SPEC-SEED-06`
- Seeded issue: OpenSpec is selectable but not end-to-end tested in this repo.
- Expected signal: Spec does not claim full repo validation; it records the provider caveat.

`SPEC-SEED-07`
- Seeded issue: Validator selection can be confused because Speckit and OpenSpec validators both exist.
- Expected signal: Spec selects the OpenSpec validator when active provider is OpenSpec.

`SPEC-SEED-08`
- Seeded issue: Regression guard for hardcoded `feature.spec.md` entrypoint during OpenSpec runs.
- Expected signal: Spec uses `proposal.md` as OpenSpec entrypoint and delta specs as requirements surface.

`SPEC-SEED-09`
- Seeded issue: OpenSpec folders exist but active provider is Speckit.
- Expected signal: Spec stays on Speckit and does not treat inactive OpenSpec folders as a defect.

`SPEC-SEED-10`
- Seeded issue: `.openspec.yaml` is absent in base OpenSpec workflow.
- Expected signal: Spec does not require `.openspec.yaml` unless expanded workflow is active.

## spec-eval-2-speckit-readiness

`SPEC-SEED-11`
- Seeded issue: Speckit `spec-manifest.md` exists but omits required stage read sets and cannot satisfy the provider readiness gate.
- Expected signal: Spec repairs the manifest or blocks readiness.

`SPEC-SEED-12`
- Seeded issue: Legacy `spec.md` exists instead of strict package primary `feature.spec.md`.
- Expected signal: Spec rejects legacy single-file readiness.

`SPEC-SEED-13`
- Seeded issue: API surface exists but `api.spec.md` is prose-only and lacks typed request/response schemas.
- Expected signal: Spec produces typed schemas or blocks readiness.

`SPEC-SEED-14`
- Seeded issue: `traceability.spec.md` maps requirements to files but not to tests.
- Expected signal: Spec fills requirement-to-test traceability or blocks readiness.

`SPEC-SEED-15`
- Seeded issue: Feature spec contains `[NEEDS CLARIFICATION]` and a tempting guessed answer.
- Expected signal: Spec asks the user rather than guessing away the marker.

`SPEC-SEED-16`
- Seeded issue: `spec-dod.md` marks PASS while unresolved clarification and traceability gaps remain.
- Expected signal: Spec treats DoD status as invalid and repairs or blocks.

`SPEC-SEED-17`
- Seeded issue: Hash metadata predates a final acceptance criterion edit.
- Expected signal: Spec recomputes hash after final edits.

`SPEC-SEED-18`
- Seeded issue: Regression guard for finalizing without provider-local validator evidence.
- Expected signal: Spec runs or explicitly cites the Speckit validator gate before handoff.

`SPEC-SEED-19`
- Seeded issue: `ui.spec.md` is omitted with valid manifest justification because there is no UI.
- Expected signal: Spec does not flag the omission.

`SPEC-SEED-20`
- Seeded issue: `behavior.spec.md` is omitted with valid manifest justification because there are no ordering or precedence rules.
- Expected signal: Spec does not flag the omission.

## spec-eval-3-openspec-readiness

`SPEC-SEED-21`
- Seeded issue: OpenSpec `proposal.md` exists but the required Why section is still template-only.
- Expected signal: Spec fills the proposal or blocks readiness.

`SPEC-SEED-22`
- Seeded issue: Delta spec requirement has no WHEN/THEN scenario.
- Expected signal: Spec adds scenarios or blocks readiness.

`SPEC-SEED-23`
- Seeded issue: Proposal lists `audit-export` and `notification-settings`, but only one delta spec exists.
- Expected signal: Spec creates matching delta spec coverage or blocks readiness.

`SPEC-SEED-24`
- Seeded issue: `design.md` is omitted without justification in `proposal.md`.
- Expected signal: Spec creates `design.md` or records an explicit justification if legitimately omitted.

`SPEC-SEED-25`
- Seeded issue: `tasks.md` uses prose bullets instead of checkbox items.
- Expected signal: Spec converts tasks to checkbox format.

`SPEC-SEED-26`
- Seeded issue: Change modifies notifications but baseline notification spec is not read into the change reasoning.
- Expected signal: Spec reads baseline specs for modified capabilities.

`SPEC-SEED-27`
- Seeded issue: Template placeholders remain in proposal and delta spec.
- Expected signal: Spec removes placeholders before readiness.

`SPEC-SEED-28`
- Seeded issue: Regression guard for Speckit-style `[NEEDS CLARIFICATION]` markers in OpenSpec artifacts.
- Expected signal: Spec uses proposal questions and delta spec revision instead.

`SPEC-SEED-29`
- Seeded issue: `design.md` is omitted with explicit simple-change justification in `proposal.md`.
- Expected signal: Spec does not flag the omission.

`SPEC-SEED-30`
- Seeded issue: `traceability.spec.md` is absent in OpenSpec.
- Expected signal: Spec does not require Speckit traceability files for OpenSpec.
