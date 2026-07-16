# Refactor Eval Seed Design

## Metadata

- Design date: 2026-05-11
- Source cowork run: `20260511T052905Z`
- Status: canonical seed design for future suite generation
- Scope: Refactor agent only
- Future suite directory: `benchmark-suite/` inside this bucket
- Fixture status: not created

## Model Provenance

- Primary design: Codex, `gpt-5.5`
- Independent design and challenge: Claude, `us.anthropic.claude-opus-4-6-v1[1m]`
- Independent design and challenge: Gemini, `gemini-3.1-pro-preview`
- Raw cowork artifacts: `ADS-project-knowledge/.local-artifacts/cowork/runs/20260511T052905Z/`

## Suite Shape

- Seeds: 27
- Dimensions: 3
- Standard flaw seeds: 18
- Positive controls: 3
- Regression seeds: 3
- Negative controls: 3
- Scoring target: 24 flaw-catching seeds and 3 false-positive controls

## Dimensions

- `1. Classification, Routing & Safe-Refactor Gates`
- `2. Structural Cleanup, Function Quality & Testability`
- `3. Blast Radius, Behavior Preservation & Proposal Discipline`

## Design Notes

- Refactor proposes non-behavioral improvements; it does not implement unless explicitly dispatched.
- Tests must be green before and after. No-test code is normally routed to TDD, except the explicit `untestable coupling` seam-extraction trigger.
- Architecture boundary violations route to Architect. Spec ambiguity or missing domain model routes to Spec. Behavior changes route to Programmer.
- Deep traps must test real-world mechanisms: dynamic dispatch, semantic duplication, transaction boundaries, async ordering, middleware sequence, feature flags, interface contracts, mock-heavy coverage, and public key/schema/route naming contracts.
- Negative controls must test restraint: documented temporary workarounds, UI declarative rendering exemptions, valid complexity, and semantically distinct duplicate-looking code must not be over-refactored.

## Seed Outline

| Seed | Eval | Dimension | Nature | Structure | Difficulty | Control | Severity | FP Risk | Final trap |
|---|---|---|---|---|---|---|---|---|---|
| RF-SEED-01 | refactor-eval-1-routing-gates | 1 | duplication | single | Easy | positive_control | Critical | None | Two identical validation helpers have full tests and no semantic divergence; Refactor should propose a small shared extraction. |
| RF-SEED-02 | refactor-eval-1-routing-gates | 1 | boundary_error | single | Easy | standard | Required | Low | Code Review finding is framed as coupling, but service imports another domain repository directly; this is an architecture boundary issue for Architect. |
| RF-SEED-03 | refactor-eval-1-routing-gates | 1 | semantic_mismatch | layered | Hard | standard | Critical | Medium | Oversized route handler exists because the spec never defines side-effect/event ownership; arbitrary extraction would encode a spec guess. |
| RF-SEED-04 | refactor-eval-1-routing-gates | 1 | anti_pattern | single | Medium | standard | Required | Low | Agent implements the refactor or edits code instead of producing a proposal artifact with risk, tests, and route recommendation. |
| RF-SEED-05 | refactor-eval-1-routing-gates | 1 | hidden_dependency | distributed | Medium | standard | Required | Medium | Code is in an active bug-fix branch or scheduled for deletion in project notes, but agent proposes cleanup that would churn unstable work. |
| RF-SEED-06 | refactor-eval-1-routing-gates | 1 | anti_pattern | combined | Medium | standard | Required | Medium | One proposal mixes rename, module move, extraction, and behavior-facing API signature changes instead of one refactor type per change. |
| RF-SEED-07 | refactor-eval-1-routing-gates | 1 | omission | layered | Hard | standard | Required | Medium | Coverage report lists untested hard-to-test code; agent refuses all action instead of recognizing the explicit untestable-coupling seam-extraction path. |
| RF-SEED-08 | refactor-eval-1-routing-gates | 1 | cosmetic_fix | camouflaged | Medium | negative_control | Recommended | High | Messy temporary workaround is documented in project notes with expiry and owner; Refactor should not clean it up as style debt. |
| RF-SEED-09 | refactor-eval-1-routing-gates | 1 | boundary_error | single | Medium | regression | Required | Low | Prior guarded failure mode: agent treats a behavior bug fix as "cleanup" and routes it to Refactor instead of Programmer. |
| RF-SEED-10 | refactor-eval-2-structure-testability | 2 | oversized_unit | single | Easy | positive_control | Critical | None | Fully covered pure decision function has cyclomatic complexity above 4; Refactor should propose a behavior-preserving split with tests required. |
| RF-SEED-11 | refactor-eval-2-structure-testability | 2 | untestable_coupling | combined | Hard | standard | Critical | Medium | Constructor reads env, opens sockets, starts polling, and hides dependencies; correct proposal extracts seams, then routes to TDD after existing tests pass. |
| RF-SEED-12 | refactor-eval-2-structure-testability | 2 | type_contract_error | layered | Hard | standard | Required | Medium | Third-party SDK error is caught inside business logic; refactor should isolate SDK adapter and map opaque errors to typed internal errors without changing behavior. |
| RF-SEED-13 | refactor-eval-2-structure-testability | 2 | hidden_dependency | distributed | Medium | standard | Required | Medium | Business rules and transformations are trapped in React `useEffect` or Express middleware; proposal must extract pure logic while preserving lifecycle behavior. |
| RF-SEED-14 | refactor-eval-2-structure-testability | 2 | anti_pattern | single | Medium | standard | Required | Low | Exported service has five positional parameters and hidden clock/env/cache dependencies; proposal must use explicit input/options objects and injectable seams. |
| RF-SEED-15 | refactor-eval-2-structure-testability | 2 | semantic_mismatch | interference | Hard | standard | Critical | High | Similar code is behind different feature flags, rollout percentages, or independently evolving domains; extracting it would collapse distinct behavior. |
| RF-SEED-16 | refactor-eval-2-structure-testability | 2 | dead_code | camouflaged | Medium | standard | Required | Medium | Function has no grep call sites but is invoked by event registry, strategy map, plugin manifest, or dynamic route loader; deleting it is a false dead-code cleanup. |
| RF-SEED-17 | refactor-eval-2-structure-testability | 2 | cosmetic_fix | camouflaged | Medium | negative_control | Recommended | High | React presentation component has complex declarative conditional rendering that falls under the UI exemption; do not extract helpers just to reduce apparent CC. |
| RF-SEED-18 | refactor-eval-2-structure-testability | 2 | missing_test | distributed | Medium | regression | Required | Low | Prior guarded failure mode: Function Quality Assessment reports 100/100 for non-trivial code with no skepticism pass and no adversarial aggregate test evidence. |
| RF-SEED-19 | refactor-eval-3-behavior-preservation | 3 | dead_code | single | Easy | positive_control | Critical | None | Unreachable helper has no dynamic registrations, no exports, full tests, and no project-note protection; Refactor should propose deletion. |
| RF-SEED-20 | refactor-eval-3-behavior-preservation | 3 | invariant_violation | layered | Hard | standard | Critical | Medium | Extraction splits a transaction boundary, so debit and credit are no longer atomic even though tests only assert the happy path. |
| RF-SEED-21 | refactor-eval-3-behavior-preservation | 3 | state_leak | distributed | Hard | standard | Critical | Medium | "Cleanup" changes `Promise.all` parallelism, ordering, cancellation, or retry behavior and silently changes observable timing semantics. |
| RF-SEED-22 | refactor-eval-3-behavior-preservation | 3 | hidden_dependency | combined | Medium | standard | Required | Medium | Middleware, validator, or interceptor order is load-bearing for auth, body parsing, or idempotency, but proposal reorders it as cosmetic organization. |
| RF-SEED-23 | refactor-eval-3-behavior-preservation | 3 | boundary_error | distributed | Medium | standard | Required | Medium | Rename looks local but changes serialized JSON keys, env names, route names, feature flags, i18n keys, or persisted schema contracts. |
| RF-SEED-24 | refactor-eval-3-behavior-preservation | 3 | missing_test | layered | Hard | standard | Critical | Medium | Tests exist but are mock-heavy and do not exercise real behavior needed for safe refactor; agent treats hollow coverage as sufficient. |
| RF-SEED-25 | refactor-eval-3-behavior-preservation | 3 | anti_pattern | interference | Hard | standard | Required | Medium | Query-shape "simplification" hides N+1 network/database fan-out or changes batching/resource bounds without evidence. |
| RF-SEED-26 | refactor-eval-3-behavior-preservation | 3 | boundary_error | layered | Medium | regression | Required | Low | Prior guarded failure mode: seam-extraction exception is used without explicit Coordinator dispatch and without immediate TDD follow-up routing. |
| RF-SEED-27 | refactor-eval-3-behavior-preservation | 3 | cosmetic_fix | single | Hard | negative_control | Recommended | High | State machine or parser has justified complexity, stable tests, documented invariants, and CC at or below trigger threshold; Refactor should not simplify away clarity. |

## Planned Fixtures

### `refactor-eval-1-routing-gates`

Purpose: test classification, safe-refactor preconditions, proposal-only discipline, and routing to Architect, Spec, TDD, or Programmer when local refactor would be wrong.

Fixture concepts:
- `seed-state/reports/code-review-findings.md`
- `seed-state/reports/test-runner-coverage-gap.md`
- `seed-state/reports/function-quality-assessment.md`
- `seed-state/reports/pipeline/feature.spec.md`
- `seed-state/reports/pipeline/adr.md`
- `seed-state/memory/project_notes.md`
- `seed-state/project/src/`

### `refactor-eval-2-structure-testability`

Purpose: test function-quality-driven refactor proposals, seam extraction, third-party error adapters, lifecycle extraction, two-object signatures, dynamic dispatch analysis, and false-positive restraint.

Fixture concepts:
- `seed-state/project/src/services/`
- `seed-state/project/src/components/`
- `seed-state/project/src/plugins/registry.ts`
- `seed-state/project/src/routes/`
- `seed-state/project/__tests__/`
- `seed-state/reports/function-quality-assessment.md`
- `seed-state/reports/test-runner-coverage-gap.md`

### `refactor-eval-3-behavior-preservation`

Purpose: test blast-radius analysis, behavior-preservation mechanisms, transaction and async semantics, public contract stability, query-shape awareness, hollow coverage detection, and proposal discipline.

Fixture concepts:
- `seed-state/project/src/transactions/`
- `seed-state/project/src/middleware/`
- `seed-state/project/src/contracts/`
- `seed-state/project/src/repositories/`
- `seed-state/project/__tests__/`
- `seed-state/reports/code-review-findings.md`
- `seed-state/reports/test-runner-coverage-gap.md`
- `seed-state/reports/pipeline/adr.md`

## Acceptance Checks For Suite Generation

- The generated suite must pass `validate_eval_suite.py`.
- Every seed must map to `agents/refactor/skills.md`, `skills/refactor-patterns/SKILL.md`, `skills/testable-design-patterns/SKILL.md`, `skills/implementation-guardrails/SKILL.md`, `skills/coding-foundations/SKILL.md`, or `skills/function-quality-assessment/SKILL.md`.
- Fixture inputs must be self-contained and must not depend on QA/E2E eval outputs.
- Negative controls must be real false-positive bait: UI presentation exemptions, documented workarounds, dynamic-call-site restraint, and justified complexity.
- Acceptance scoring must evaluate classification, route target, proposal-only discipline, test prerequisites, blast radius, behavior-preservation mechanism, and evidence quality.
- Any proposal that changes observable behavior, public contracts, transaction semantics, async ordering, feature-flag behavior, or middleware order must be scored as a Refactor failure and routed away from Refactor.
- `run-manifest.tsv` and `run-results.tsv` stay header-only until real isolated eval runs are recorded.
