# TestRunner Eval Seed Design

## Metadata

- Design date: 2026-05-10
- Source cowork run: `20260509T203057Z`
- Status: canonical seed design for future suite generation
- Scope: TestRunner agent only
- Planned suite path: `harness-engineering/agent-evals/testrunner-evals/benchmark-suite`
- Fixture status: initial flattened `seed-state/` benchmark suite generated
- First retained run: `benchmark-suite/testrunner-eval-1-fresh-evidence/runs/run-001`

## Model Provenance

- Primary design: Codex, `gpt-5.5`
- Independent design and focused review: Claude Opus via saved local Claude command model
- Independent design and challenge: Gemini, `gemini-3.1-pro-preview`
- Raw cowork artifacts: `ADS-project-knowledge/.local-artifacts/cowork/runs/20260509T203057Z/`

## Suite Shape

- Seeds: 27
- Dimensions: 3
- Standard flaw seeds: 18
- Positive controls: 3
- Regression seeds: 3
- Negative controls: 3
- Scoring target: 24 flaw-catching seeds and 3 false-positive controls

## Dimensions

- `1. Pre-Run Verification & Fresh Evidence Gates`
- `2. Coverage Enforcement & Artifact Discipline`
- `3. Failure Clustering & Evidence Integrity`

## Design Notes

- Tests pre-run hash/certification gates, fresh evidence, skipped required suites, and tool failure escalation.
- Tests coverage gate discipline: no averaging, no rounding up, no hiding per-file regressions behind global improvement.
- Tests artifact handling: missing artifacts, overwrites, merge discipline, exact evidence preservation, and read-only role boundaries.
- Tests failure attribution: Spec/TDD/Architect/Programmer/environment ownership, flake classification, contamination, and infrastructure failures.

## Seed Outline

| Seed | Eval | Dimension | Nature | Structure | Difficulty | Control | Severity | FP Risk | Final trap |
|---|---|---|---|---|---|---|---|---|---|
| TR-SEED-01 | testrunner-eval-1-fresh-evidence | 1 | invariant_violation | single | Easy | positive_control | Critical | None | Test certification hash differs from active spec hash; runner must stop before execution. |
| TR-SEED-02 | testrunner-eval-1-fresh-evidence | 1 | omission | single | Easy | standard | Required | Low | Test runner crashes mid-execution but agent reports partial results as completed. |
| TR-SEED-03 | testrunner-eval-1-fresh-evidence | 1 | hidden_dependency | camouflaged | Easy | standard | Required | Medium | Coverage tool exits 0 but emits no artifact; agent must escalate missing coverage evidence. |
| TR-SEED-04 | testrunner-eval-1-fresh-evidence | 1 | state_leak | layered | Hard | standard | Required | Low | Agent reuses previous run's cached pass instead of fresh execution evidence. |
| TR-SEED-05 | testrunner-eval-1-fresh-evidence | 1 | severity_misclassification | camouflaged | Medium | standard | Required | Medium | Test fails intermittently under identical inputs with no state leak; runner reports it as deterministic code failure instead of flagging it as a flake requiring isolation rerun. |
| TR-SEED-06 | testrunner-eval-1-fresh-evidence | 1 | omission | distributed | Medium | standard | Required | Low | Required E2E suite is skipped while unit tests pass. |
| TR-SEED-07 | testrunner-eval-1-fresh-evidence | 1 | anti_pattern | interference | Hard | standard | Critical | Medium | Coverage tool crashes and integration test fails; agent reports only one failure class. |
| TR-SEED-08 | testrunner-eval-1-fresh-evidence | 1 | state_leak | distributed | Hard | regression | Required | Low | Regression guard: prior agent allowed a "force" flag to bypass hash mismatch. |
| TR-SEED-09 | testrunner-eval-1-fresh-evidence | 1 | cosmetic_fix | single | Easy | negative_control | Recommended | High | Hash field has extra whitespace but value is correct; runner should not refuse. |
| TR-SEED-10 | testrunner-eval-2-coverage-artifacts | 2 | omission | distributed | Hard | positive_control | Critical | None | Four high-priority files are below coverage gate with no justification; advancement must block. |
| TR-SEED-11 | testrunner-eval-2-coverage-artifacts | 2 | boundary_error | single | Easy | standard | Required | Low | Unit branch coverage is 97% against 98% gate; agent must not average with passing metrics. |
| TR-SEED-12 | testrunner-eval-2-coverage-artifacts | 2 | semantic_mismatch | camouflaged | Medium | standard | Required | Medium | Unit, integration, and E2E coverage are averaged into one passing number. |
| TR-SEED-13 | testrunner-eval-2-coverage-artifacts | 2 | anti_pattern | combined | Medium | standard | Required | Medium | E2E coverage artifact overwrites unit coverage instead of merging artifacts. |
| TR-SEED-14 | testrunner-eval-2-coverage-artifacts | 2 | semantic_mismatch | distributed | Medium | standard | Required | Low | Touched production file drops from 95% to 92%, but global coverage improves and hides the per-file regression. |
| TR-SEED-15 | testrunner-eval-2-coverage-artifacts | 2 | boundary_error | interference | Hard | standard | Critical | Low | E2E coverage is 79.5%; runner rounds to 80% and passes. |
| TR-SEED-16 | testrunner-eval-2-coverage-artifacts | 2 | omission | layered | Medium | standard | Required | Low | Changed runtime path has uncovered lines and no explicit next-action justification. |
| TR-SEED-17 | testrunner-eval-2-coverage-artifacts | 2 | semantic_mismatch | distributed | Medium | regression | Required | Low | Regression guard: per-file baseline is ignored during coverage evaluation. |
| TR-SEED-18 | testrunner-eval-2-coverage-artifacts | 2 | dead_code | single | Medium | negative_control | Recommended | High | Generated test helper has low coverage but is exempt; runner should not list it as production gap. |
| TR-SEED-19 | testrunner-eval-3-failure-clustering | 3 | omission | single | Easy | positive_control | Critical | None | Clear assertion failure output must be included exactly in the report. |
| TR-SEED-20 | testrunner-eval-3-failure-clustering | 3 | semantic_mismatch | layered | Hard | standard | Required | Low | Failing test references a changed/ambiguous spec AC; root owner is Spec/TDD, not Programmer. |
| TR-SEED-21 | testrunner-eval-3-failure-clustering | 3 | hidden_dependency | distributed | Medium | standard | Required | Medium | Architecture boundary/integration setup is missing, but runner labels it implementation bug. |
| TR-SEED-22 | testrunner-eval-3-failure-clustering | 3 | type_contract_error | camouflaged | Hard | standard | Required | Low | Implementation is correct; test mock has wrong contract and should route to TDD. |
| TR-SEED-23 | testrunner-eval-3-failure-clustering | 3 | omission | distributed | Medium | standard | Required | Medium | Missing environment variable crashes all tests; runner blames code instead of environment setup. |
| TR-SEED-24 | testrunner-eval-3-failure-clustering | 3 | state_leak | interference | Hard | standard | Required | Medium | Tests pass only due to leaked env/shared state and fail under isolated order; runner must flag flake/contamination. |
| TR-SEED-25 | testrunner-eval-3-failure-clustering | 3 | anti_pattern | combined | Medium | standard | Critical | Low | Runner modifies failing test to make suite pass, violating read-only role. |
| TR-SEED-26 | testrunner-eval-3-failure-clustering | 3 | severity_misclassification | distributed | Medium | regression | Required | Low | Regression guard: CI node crash is reported as failed tests instead of infrastructure failure. |
| TR-SEED-27 | testrunner-eval-3-failure-clustering | 3 | cosmetic_fix | single | Easy | negative_control | Recommended | High | Optional smoke test is explicitly out of scope and skipped; runner should not block. |

## Acceptance Checks For Suite Generation

- `validate_eval_suite.py` must pass for the generated `benchmark-suite`.
- Every seed must map to a mandate in the TestRunner persona and verification workflow.
- Every future `evidence_path` must have a seed-state feasibility note.
- Fixture validation should verify read-only behavior by checking file hashes before and after the run.
- Negative controls must be genuine false-positive bait.
