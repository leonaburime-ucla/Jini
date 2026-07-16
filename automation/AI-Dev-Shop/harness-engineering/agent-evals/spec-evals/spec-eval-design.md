# Spec Eval Seed Design

## Metadata

- Design date: 2026-05-10
- Revision date: 2026-05-11
- Source cowork runs: `20260510T234109Z`, `20260511T001310Z`
- Status: canonical generated pilot suite design
- Scope: Spec agent only
- Suite path: `harness-engineering/agent-evals/spec-evals/benchmark-suite`
- Fixture status: created for Speckit + OpenSpec

## Model Provenance

- Primary design: Codex, `gpt-5.5`
- Independent design and focused review: Claude Opus via saved local Claude command model
- Independent design and challenge: Gemini, `gemini-3.1-pro-preview`
- Raw cowork artifacts: `ADS-project-knowledge/.local-artifacts/cowork/runs/20260511T001310Z/`

## Suite Shape

- Seeds: 30
- Dimensions: 3
- Standard flaw seeds: 18
- Positive controls: 3
- Regression seeds: 3
- Negative controls: 6
- Scoring target: 24 flaw-catching seeds and 6 false-positive controls

## Dimensions

- `1. Provider Resolution, Switching & Cross-Provider Discipline`
- `2. Speckit Package Readiness & Contract Completeness`
- `3. OpenSpec Change Folder & Delta-Spec Readiness`

## Design Notes

- This suite covers Speckit and OpenSpec only.
- BMAD is intentionally excluded from this concrete suite version.
- Kiro is not evaluated because the repo has no local Kiro provider contract. Add a Kiro suite only after that contract exists.
- Future providers should be added as new provider-specific dimensions or a new suite revision, not by overloading Speckit/OpenSpec seeds.
- The suite tests whether Spec reads `active-provider.md` and the selected provider compatibility contract instead of hardcoding filenames such as `feature.spec.md` or `proposal.md`.
- OpenSpec clarification behavior differs from Speckit: OpenSpec revises `proposal.md` and delta specs; it does not use inline `[NEEDS CLARIFICATION]` markers.
- Negative controls are provider-specific false-positive bait.

## Seed Outline

| Seed | Eval | Dimension | Nature | Structure | Difficulty | Control | Severity | FP Risk | Final trap |
|---|---|---|---|---|---|---|---|---|---|
| SPEC-SEED-01 | spec-eval-1-provider-resolution | 1 | semantic_mismatch | distributed | Easy | positive_control | Critical | None | Active provider is OpenSpec, but Speckit artifact assumptions are present as bait. |
| SPEC-SEED-02 | spec-eval-1-provider-resolution | 1 | hidden_dependency | layered | Medium | standard | Required | Medium | Both Speckit and OpenSpec folders exist; agent must follow `active-provider.md`, not default to Speckit. |
| SPEC-SEED-03 | spec-eval-1-provider-resolution | 1 | anti_pattern | single | Easy | standard | Required | Low | Agent asks prefixed/standard naming question for OpenSpec even though that question is Speckit-only. |
| SPEC-SEED-04 | spec-eval-1-provider-resolution | 1 | omission | combined | Medium | standard | Required | Low | `pipeline-state.md` omits provider identity fields after provider selection. |
| SPEC-SEED-05 | spec-eval-1-provider-resolution | 1 | contradiction | distributed | Hard | standard | Critical | Medium | In-flight Speckit feature is switched to OpenSpec without translation/regeneration checkpoint. |
| SPEC-SEED-06 | spec-eval-1-provider-resolution | 1 | semantic_mismatch | camouflaged | Medium | standard | Required | Medium | Agent claims OpenSpec is fully repo-validated despite provider docs saying it is not end-to-end tested here. |
| SPEC-SEED-07 | spec-eval-1-provider-resolution | 1 | hidden_dependency | distributed | Medium | standard | Required | Low | Agent cites Speckit validator while active provider is OpenSpec. |
| SPEC-SEED-08 | spec-eval-1-provider-resolution | 1 | semantic_mismatch | distributed | Medium | regression | Required | Low | Regression guard: agent hardcodes `feature.spec.md` as entrypoint in an OpenSpec run. |
| SPEC-SEED-09 | spec-eval-1-provider-resolution | 1 | dead_code | single | Medium | negative_control | Recommended | High | OpenSpec folders exist but active provider is Speckit; using Speckit is correct. |
| SPEC-SEED-10 | spec-eval-1-provider-resolution | 1 | cosmetic_fix | single | Easy | negative_control | Recommended | High | `.openspec.yaml` is absent in a base OpenSpec workflow and should not be required. |
| SPEC-SEED-11 | spec-eval-2-speckit-readiness | 2 | omission | single | Easy | positive_control | Critical | None | Speckit `spec-manifest.md` exists but omits required stage read sets and is not readiness-valid. |
| SPEC-SEED-12 | spec-eval-2-speckit-readiness | 2 | semantic_mismatch | single | Easy | standard | Required | Low | Agent uses legacy single-file `spec.md` instead of Speckit strict package files. |
| SPEC-SEED-13 | spec-eval-2-speckit-readiness | 2 | type_contract_error | distributed | Medium | standard | Required | Low | API surface exists but `api.spec.md` has prose instead of typed request/response schemas. |
| SPEC-SEED-14 | spec-eval-2-speckit-readiness | 2 | omission | combined | Medium | standard | Required | Low | `traceability.spec.md` maps requirements to files but not to tests. |
| SPEC-SEED-15 | spec-eval-2-speckit-readiness | 2 | anti_pattern | camouflaged | Medium | standard | Required | Medium | Agent converts `[NEEDS CLARIFICATION]` into guessed requirements instead of asking the user. |
| SPEC-SEED-16 | spec-eval-2-speckit-readiness | 2 | invariant_violation | interference | Hard | standard | Critical | Medium | `spec-dod.md` marks PASS while unresolved clarification and traceability gaps remain. |
| SPEC-SEED-17 | spec-eval-2-speckit-readiness | 2 | semantic_mismatch | distributed | Hard | standard | Critical | Medium | Agent recomputes hash before final edits, making metadata stale at handoff. |
| SPEC-SEED-18 | spec-eval-2-speckit-readiness | 2 | omission | single | Easy | regression | Required | Low | Regression guard: agent finalizes Speckit package without running or citing provider-local validator. |
| SPEC-SEED-19 | spec-eval-2-speckit-readiness | 2 | cosmetic_fix | single | Easy | negative_control | Recommended | High | `ui.spec.md` is omitted with valid manifest justification because feature has no UI. |
| SPEC-SEED-20 | spec-eval-2-speckit-readiness | 2 | dead_code | single | Medium | negative_control | Recommended | High | `behavior.spec.md` is omitted with valid manifest justification because no ordering or precedence rules exist. |
| SPEC-SEED-21 | spec-eval-3-openspec-readiness | 3 | omission | single | Easy | positive_control | Critical | None | OpenSpec `proposal.md` exists but the required Why section is still template-only and not readiness-valid. |
| SPEC-SEED-22 | spec-eval-3-openspec-readiness | 3 | missing_test | single | Easy | standard | Required | Low | Delta spec requirement has no Scenario with WHEN/THEN. |
| SPEC-SEED-23 | spec-eval-3-openspec-readiness | 3 | semantic_mismatch | distributed | Medium | standard | Required | Low | Proposal lists a capability but no matching `specs/<domain>/spec.md` exists. |
| SPEC-SEED-24 | spec-eval-3-openspec-readiness | 3 | omission | combined | Medium | standard | Required | Low | `design.md` is omitted without explicit justification in `proposal.md`. |
| SPEC-SEED-25 | spec-eval-3-openspec-readiness | 3 | anti_pattern | single | Easy | standard | Required | Low | `tasks.md` has prose bullets instead of checkbox items. |
| SPEC-SEED-26 | spec-eval-3-openspec-readiness | 3 | hidden_dependency | distributed | Hard | standard | Required | Medium | Modified capability lacks corresponding baseline spec read from `openspec/specs/`. |
| SPEC-SEED-27 | spec-eval-3-openspec-readiness | 3 | semantic_mismatch | camouflaged | Medium | standard | Required | Medium | Template placeholders remain in OpenSpec artifacts. |
| SPEC-SEED-28 | spec-eval-3-openspec-readiness | 3 | semantic_mismatch | distributed | Medium | regression | Required | Low | Regression guard: agent uses Speckit-style `[NEEDS CLARIFICATION]` markers in OpenSpec artifacts. |
| SPEC-SEED-29 | spec-eval-3-openspec-readiness | 3 | cosmetic_fix | single | Easy | negative_control | Recommended | High | `design.md` is omitted with explicit simple-change justification in `proposal.md`. |
| SPEC-SEED-30 | spec-eval-3-openspec-readiness | 3 | dead_code | single | Medium | negative_control | Recommended | High | `traceability.spec.md` is absent in OpenSpec and should not be required. |

## Planned Fixtures

### `spec-eval-1-provider-resolution`

Purpose: test provider selection, cross-provider artifact restraint, provider metadata, switch checkpoints, validator selection, and future-provider-safe design.

Fixture files:
- `seed-state/framework/spec-providers/active-provider.md`
- `seed-state/framework/spec-providers/core/provider-selection.md`
- `seed-state/framework/spec-providers/speckit/compatibility.md`
- `seed-state/framework/spec-providers/openspec/compatibility.md`
- `seed-state/project/reports/pipeline/230-provider-switch/pipeline-state.md`
- `seed-state/project/reports/pipeline/230-provider-switch/feature.spec.md`
- `seed-state/openspec/config.yaml`
- `project-brief.md`
- `prompts/original-spec-prompt.md`

### `spec-eval-2-speckit-readiness`

Purpose: test Speckit strict package completeness, conditional file applicability, traceability, clarification handling, spec-dod, hash/version discipline, and validator gate.

Fixture files:
- `seed-state/framework/spec-providers/active-provider.md`
- `seed-state/framework/spec-providers/speckit/compatibility.md`
- `seed-state/project/governance/constitution.md`
- `seed-state/project/reports/pipeline/240-speckit-invoice-export/feature.spec.md`
- `seed-state/project/reports/pipeline/240-speckit-invoice-export/api.spec.md`
- `seed-state/project/reports/pipeline/240-speckit-invoice-export/traceability.spec.md`
- `seed-state/project/reports/pipeline/240-speckit-invoice-export/spec-dod.md`

### `spec-eval-3-openspec-readiness`

Purpose: test OpenSpec change folder creation, proposal completeness, delta specs, scenarios, baseline specs, design/tasks readiness, placeholder cleanup, and OpenSpec clarification behavior.

Fixture files:
- `seed-state/framework/spec-providers/active-provider.md`
- `seed-state/framework/spec-providers/openspec/compatibility.md`
- `seed-state/openspec/config.yaml`
- `seed-state/openspec/specs/notifications/spec.md`
- `seed-state/openspec/changes/add-audit-export/proposal.md`
- `seed-state/openspec/changes/add-audit-export/specs/audit-export/spec.md`
- `seed-state/openspec/changes/add-audit-export/tasks.md`

## Acceptance Checks For Suite Generation

- `validate_eval_suite.py` must pass for `benchmark-suite`.
- Every seed must map to `agents/spec/skills.md`, provider selection docs, Speckit compatibility, or OpenSpec compatibility.
- The suite must not include BMAD or Kiro fixture projects.
- Future provider support must be documented as an extension path requiring a local provider contract.
- Negative controls must be genuine false-positive bait, not clean obvious passes.
- No seed may require the Spec agent to write runtime implementation code.
