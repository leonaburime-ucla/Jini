# Seed Ledger — TDD Benchmark Suite

This hidden ledger describes the expected seeded issues for post-run scoring.
The TDD agent under test does not see this file.

## tdd-eval-1-spec-certification

`TDD-SEED-01`
- Seeded issue: `feature.spec.md` explicitly says human approval is false.
- Expected signal: TDD refuses to write or certify tests until approval is resolved.

`TDD-SEED-02`
- Seeded issue: The active spec version is `1.4`, but approval metadata certifies `1.3`.
- Expected signal: TDD flags stale approval/hash lineage instead of treating the active spec as certified.

`TDD-SEED-03`
- Seeded issue: The spec header declares SHA-256, while the certification appendix uses a `blake3:` digest for the current version.
- Expected signal: TDD identifies the hash algorithm mismatch as uncertifiable.

`TDD-SEED-04`
- Seeded issue: `tasks.md` assigns manual-review policy to `review-orchestrator`, while the ADR assigns the same responsibility to `billing-core`.
- Expected signal: TDD escalates the module-boundary contradiction before mapping tests.

`TDD-SEED-05`
- Seeded issue: The active ADR claims to supersede `ADR-301A` but still imports a contract summary from that superseded ADR.
- Expected signal: TDD flags the broken certification chain or refuses to guess the active contract.

`TDD-SEED-06`
- Seeded issue: The spec still contains `[NEEDS CLARIFICATION]` in an acceptance criterion despite approval-like metadata elsewhere.
- Expected signal: TDD treats the blocker text as dominant and refuses precise assertions.

`TDD-SEED-07`
- Seeded issue: The draft test certification record includes version and hash but omits spec ID.
- Expected signal: TDD refuses to certify or updates the record to include all mandatory identity fields.

`TDD-SEED-08`
- Seeded issue: The draft certification accepts `spec-hash: ANY`.
- Expected signal: TDD rejects wildcard hash certification and demands the exact active hash.

`TDD-SEED-09`
- Seeded issue: The changelog notes a typo-only correction with unchanged hash and no behavior change.
- Expected signal: TDD does not treat the typo-only note as a blocker or rewrite trigger.

## tdd-eval-2-outcome-matrix

`TDD-SEED-10`
- Seeded issue: The draft outcome matrix maps internal branches rather than observable state + input outcomes.
- Expected signal: TDD rewrites the matrix around observable behavior.

`TDD-SEED-11`
- Seeded issue: The draft gap list lacks risk levels and ranks cosmetic export formatting above session/auth gaps.
- Expected signal: TDD risk-ranks gaps and elevates auth/session coverage.

`TDD-SEED-12`
- Seeded issue: A pure invariant is covered only by slow acceptance/E2E tests in the draft plan.
- Expected signal: TDD prioritizes unit coverage for the invariant before integration/acceptance tests.

`TDD-SEED-13`
- Seeded issue: ADR capacity constraints imply rate-limit and latency tests absent from explicit ACs.
- Expected signal: TDD lists inferred NFR gaps or tests tied to ADR constraints.

`TDD-SEED-14`
- Seeded issue: The draft outcome matrix rejects zero-amount payment, but the spec says hold for manual review.
- Expected signal: TDD corrects the contradiction to the spec behavior.

`TDD-SEED-15`
- Seeded issue: Boundary coverage omits empty, maximum, and max-plus-one cases.
- Expected signal: TDD adds explicit boundary scenarios.

`TDD-SEED-16`
- Seeded issue: Three obvious ACs have no planned tests.
- Expected signal: TDD produces tests or explicit risk-ranked gaps for all three.

`TDD-SEED-17`
- Seeded issue: Existing TSX component test is render-only after a spec change.
- Expected signal: TDD adds or requires render, interaction, accessibility, and state/prop edge-case coverage.

`TDD-SEED-18`
- Seeded issue: Deprecated endpoint is out of scope in `tasks.md`.
- Expected signal: TDD does not create tests for the deprecated endpoint just to raise coverage.

## tdd-eval-3-contract-gapfill

`TDD-SEED-19`
- Seeded issue: Existing test asserts private route state instead of public observable behavior.
- Expected signal: TDD replaces or rejects the private-state assertion.

`TDD-SEED-20`
- Seeded issue: Validation range and ordering rules need property-based coverage; example tests alone are too thin.
- Expected signal: TDD adds property-based tests or flags the omission.

`TDD-SEED-21`
- Seeded issue: ADR contract summary contains conflicting consumer-driven and schema-validation approaches.
- Expected signal: TDD escalates or follows the selected approach if it can prove one exists.

`TDD-SEED-22`
- Seeded issue: Async event test uses fixed sleeps and a production delay helper.
- Expected signal: TDD keeps timing control in test infrastructure and removes fixed-sleep dependency.

`TDD-SEED-23`
- Seeded issue: Coverage report includes an uncovered admin route with no spec mapping.
- Expected signal: TDD routes it as implementation drift/refactor candidate instead of writing tests for unspecced behavior.

`TDD-SEED-24`
- Seeded issue: React component has only render and click coverage.
- Expected signal: TDD adds or requires a11y and edge-case coverage as well.

`TDD-SEED-25`
- Seeded issue: API/event contract in ADR has zero tests.
- Expected signal: TDD treats missing contract coverage as critical.

`TDD-SEED-26`
- Seeded issue: Gap-fill draft updates the certified spec hash instead of preserving the original hash.
- Expected signal: TDD preserves the original certified hash and records gap-fill additions separately.

`TDD-SEED-27`
- Seeded issue: Snapshot-heavy contract test is explicitly justified by the ADR's chosen approach.
- Expected signal: TDD does not flag snapshot use as defective when it is the selected contract strategy.
