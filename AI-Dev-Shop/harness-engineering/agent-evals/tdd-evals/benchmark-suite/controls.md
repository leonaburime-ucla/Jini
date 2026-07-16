# Controls — TDD Benchmark Suite

The suite uses explicit controls so scoring can separate real misses from false-positive tendency and regression drift.

## Positive Controls

- `TDD-SEED-01`: active spec metadata says human approval is false. The TDD agent must refuse before writing tests.
- `TDD-SEED-16`: three direct, spec-referenced acceptance criteria are uncovered. The TDD agent must produce tests or explicit risk-ranked gaps.
- `TDD-SEED-25`: ADR-defined API contract has zero tests. The TDD agent must treat this as a critical contract-test omission.

## Negative Controls

- `TDD-SEED-09`: approved spec contains only typo-level wording with unchanged hash. The TDD agent should not refuse or rewrite tests for this alone.
- `TDD-SEED-18`: a deprecated endpoint is out of scope in `tasks.md`. The TDD agent should not create tests for it to inflate coverage.
- `TDD-SEED-27`: snapshot-heavy contract tests are explicitly selected by the ADR. The TDD agent should not flag the snapshot approach as defective.

## Regression Controls

- `TDD-SEED-08`: prior behavior accepted `spec-hash: ANY`; exact hash enforcement is required.
- `TDD-SEED-17`: stale TSX coverage previously got render-only treatment; React policy requires interaction, a11y, and edge-case coverage.
- `TDD-SEED-26`: gap-fill updates previously changed the certified spec hash; the original hash must be preserved.

## Scoring Notes

- Negative controls are scored only as `CORRECT_SKIP` or `FALSE_POSITIVE`.
- Non-negative controls are scored only as `CAUGHT`, `PARTIAL`, or `MISSED`.
- The agent under test must not see this file.
- Run artifacts are persisted in `run-manifest.tsv` and `run-results.tsv` after execution.
