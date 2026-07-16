# TDD Eval Seed Design

## Metadata

- Design date: 2026-05-10
- Source cowork run: `20260509T203057Z`
- Status: canonical seed design for future suite generation
- Scope: TDD agent only
- Planned suite path: `harness-engineering/agent-evals/tdd-evals/benchmark-suite`
- Fixture status: initial flattened `seed-state/` benchmark suite generated
- First retained run: `benchmark-suite/tdd-eval-1-spec-certification/runs/run-001`

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

- `1. Spec Validation & Certification Integrity`
- `2. Requirement Coverage, Outcome Matrix & Implicit NFRs`
- `3. Test Design, Contract & Gap-Fill Discipline`

## Design Notes

- Tests certification gates, stale spec/hash handling, `[NEEDS CLARIFICATION]` blockers, and incomplete certification records.
- Tests outcome-matrix judgment, including observable outcomes versus implementation branch maps.
- Tests TDD-specific judgment traps: implementation-writing guardrails, certification-record completeness, test priority ordering, ADR contract-approach ambiguity, React component completeness, and coverage-gap risk classification.
- Tests gap-fill discipline: spec-traceable gaps should get tests; no-spec paths should route to Refactor instead of inflating coverage.

## Seed Outline

| Seed | Eval | Dimension | Nature | Structure | Difficulty | Control | Severity | FP Risk | Final trap |
|---|---|---|---|---|---|---|---|---|---|
| TDD-SEED-01 | tdd-eval-1-spec-certification | 1 | invariant_violation | single | Easy | positive_control | Critical | None | Spec metadata says approval is false; TDD must refuse before writing tests. |
| TDD-SEED-02 | tdd-eval-1-spec-certification | 1 | semantic_mismatch | single | Easy | standard | Required | Low | Version was incremented after approval; hash and approval chain no longer certify the active spec. |
| TDD-SEED-03 | tdd-eval-1-spec-certification | 1 | contradiction | camouflaged | Medium | standard | Required | Medium | Header says one hash algorithm; certification appendix uses another. Agent must catch the mismatch. |
| TDD-SEED-04 | tdd-eval-1-spec-certification | 1 | contradiction | distributed | Hard | standard | Critical | Medium | `tasks.md` and ADR define different module boundaries, making test scope uncertifiable. |
| TDD-SEED-05 | tdd-eval-1-spec-certification | 1 | hidden_dependency | layered | Medium | standard | Required | Medium | Spec references an ADR that references a superseded ADR; certification chain breaks two hops deep. |
| TDD-SEED-06 | tdd-eval-1-spec-certification | 1 | anti_pattern | interference | Hard | standard | Critical | Low | Spec is approved but still contains `[NEEDS CLARIFICATION]`; approval metadata conflicts with blocker text. |
| TDD-SEED-07 | tdd-eval-1-spec-certification | 1 | omission | distributed | Medium | standard | Required | Low | Test certification record includes version and hash but omits spec ID; TDD must refuse to certify the incomplete record. |
| TDD-SEED-08 | tdd-eval-1-spec-certification | 1 | boundary_error | layered | Medium | regression | Required | Low | Regression guard: prior agent accepted `spec-hash: ANY`; exact hash enforcement is required. |
| TDD-SEED-09 | tdd-eval-1-spec-certification | 1 | cosmetic_fix | single | Easy | negative_control | Recommended | High | Approved spec has a typo-only wording change with unchanged hash; TDD should not refuse or rewrite tests. |
| TDD-SEED-10 | tdd-eval-2-outcome-matrix | 2 | semantic_mismatch | single | Easy | standard | Required | Low | Outcome matrix describes branches taken by implementation instead of observable state+input outcomes. |
| TDD-SEED-11 | tdd-eval-2-outcome-matrix | 2 | severity_misclassification | combined | Medium | standard | Required | Low | Coverage gaps are listed but lack risk levels, and an auth/session gap is demoted below a cosmetic export gap. |
| TDD-SEED-12 | tdd-eval-2-outcome-matrix | 2 | anti_pattern | single | Easy | standard | Required | Low | Pure invariant is covered only by slow acceptance/E2E tests; TDD must prioritize unit, then integration, then acceptance coverage. |
| TDD-SEED-13 | tdd-eval-2-outcome-matrix | 2 | hidden_dependency | distributed | Hard | standard | Required | Medium | Rate limit and latency constraints are implied by ADR capacity constraints but absent from explicit ACs; TDD must infer and list the NFR gaps. |
| TDD-SEED-14 | tdd-eval-2-outcome-matrix | 2 | contradiction | layered | Medium | standard | Critical | Low | Outcome matrix says reject zero-amount payment; spec says hold for review. |
| TDD-SEED-15 | tdd-eval-2-outcome-matrix | 2 | boundary_error | combined | Medium | standard | Required | Low | Outcome matrix covers non-empty input but omits empty, max, and max+1 cases. |
| TDD-SEED-16 | tdd-eval-2-outcome-matrix | 2 | invariant_violation | interference | Hard | positive_control | Critical | None | Three obvious untested ACs are listed with spec references; TDD must produce tests or explicit gaps for all. |
| TDD-SEED-17 | tdd-eval-2-outcome-matrix | 2 | missing_test | distributed | Medium | regression | Required | Low | Regression guard: existing TSX component tests remain stale after a spec change; TDD appends render coverage but fails to update interaction, a11y, and edge-case tests. |
| TDD-SEED-18 | tdd-eval-2-outcome-matrix | 2 | dead_code | single | Medium | negative_control | Recommended | High | Deprecated endpoint is out of scope only in `tasks.md`; TDD should not create tests for it just to inflate coverage. |
| TDD-SEED-19 | tdd-eval-3-contract-gapfill | 3 | anti_pattern | single | Easy | standard | Required | Low | Test asserts private internal state instead of public observable behavior. |
| TDD-SEED-20 | tdd-eval-3-contract-gapfill | 3 | omission | layered | Hard | standard | Required | Low | Complex validation/range rule requires property-based tests; examples alone are insufficient. |
| TDD-SEED-21 | tdd-eval-3-contract-gapfill | 3 | type_contract_error | distributed | Hard | standard | Critical | Medium | ADR contract summary conflicts between consumer-driven and schema-validation approaches; TDD guesses and writes one instead of escalating or following the selected approach. |
| TDD-SEED-22 | tdd-eval-3-contract-gapfill | 3 | anti_pattern | layered | Medium | standard | Required | Medium | Async event test uses fixed sleeps and adds a production delay helper; TDD must keep setup in test infrastructure and avoid implementation code. |
| TDD-SEED-23 | tdd-eval-3-contract-gapfill | 3 | semantic_mismatch | camouflaged | Hard | standard | Critical | Medium | Uncovered admin route has no spec mapping; TDD writes tests instead of routing as implementation drift. |
| TDD-SEED-24 | tdd-eval-3-contract-gapfill | 3 | missing_test | combined | Hard | standard | Required | Low | React component detected, but agent writes only render+interaction tests and skips a11y and edge-case coverage. |
| TDD-SEED-25 | tdd-eval-3-contract-gapfill | 3 | missing_test | single | Easy | positive_control | Critical | None | Obvious ADR API contract has zero tests. |
| TDD-SEED-26 | tdd-eval-3-contract-gapfill | 3 | semantic_mismatch | distributed | Medium | regression | Required | Low | Regression guard: gap-fill pass changes original certified spec hash instead of preserving it. |
| TDD-SEED-27 | tdd-eval-3-contract-gapfill | 3 | anti_pattern | single | Easy | negative_control | Recommended | High | Snapshot-heavy contract test looks suspicious but is explicitly justified by the ADR's selected testing approach; TDD should not flag it as a defect. |

## Acceptance Checks For Suite Generation

- `validate_eval_suite.py` must pass for the generated `benchmark-suite`.
- Every seed must map to a mandate in `agents/tdd/skills.md`.
- Every future `evidence_path` must have a seed-state feasibility note.
- Negative controls must be real false-positive bait, not empty clean cases.
- Suite status must distinguish targeted smoke/regression runs from full benchmark runs.
