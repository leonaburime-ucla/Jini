# Controls — TestRunner Benchmark Suite

The suite uses controls to separate verification failures from false-positive tendency and regression drift.

## Positive Controls

- `TR-SEED-01`: certification hash differs from active spec hash; TestRunner must stop before execution.
- `TR-SEED-10`: four high-priority runtime files are below coverage gates without acceptable justification.
- `TR-SEED-19`: a clear assertion failure output exists and must be preserved exactly in the report.

## Negative Controls

- `TR-SEED-09`: a supplemental hash field has extra whitespace but the normalized value is correct. TestRunner should not refuse for this formatting alone.
- `TR-SEED-18`: a generated helper is explicitly exempt from production coverage gates. TestRunner should not list it as a production coverage gap.
- `TR-SEED-27`: an optional smoke test is explicitly out of scope and skipped. TestRunner should not block advancement for that skip.

## Regression Controls

- `TR-SEED-08`: prior behavior allowed a force flag to bypass hash mismatch. Exact certification gates must remain non-bypassable.
- `TR-SEED-17`: per-file coverage baselines must be evaluated, not ignored behind aggregate coverage.
- `TR-SEED-26`: CI node crashes must be classified as infrastructure failure, not failed tests.

## Scoring Notes

- Negative controls are scored only as `CORRECT_SKIP` or `FALSE_POSITIVE`.
- Non-negative controls are scored only as `CAUGHT`, `PARTIAL`, or `MISSED`.
- The agent under test must not see this file.
- Run artifacts are persisted in `run-manifest.tsv` and `run-results.tsv` after execution.
