# Controls - CodeBase Analyzer Benchmark Suite

The suite uses explicit controls so scoring can separate real misses from false-positive tendency and regression drift.

## Positive Controls

- `CBA-SEED-01`: report omits the mandatory Sampling Notice. Expected: analyzer includes or blocks on the Sampling Notice.
- `CBA-SEED-11`: four-module circular dependency exists. Expected: analyzer escalates Architect review before migration planning.
- `CBA-SEED-21`: hardcoded production-looking secret exists. Expected: analyzer escalates immediately before pipeline work proceeds.

## Negative Controls

- `CBA-SEED-09`: generated files are explicitly excluded. Expected: analyzer does not over-flag skipped generated files.
- `CBA-SEED-10`: README is sparse, but other discovery evidence exists. Expected: analyzer does not block analysis solely on README thinness.
- `CBA-SEED-19`: documented test fixture secret is fake. Expected: analyzer does not immediately escalate it as production credential leakage.
- `CBA-SEED-20`: legacy module is explicitly out of scope. Expected: analyzer does not report findings from that module.
- `CBA-SEED-29`: simple healthy CRUD module does not need Hexagonal migration. Expected: analyzer avoids over-architecture.
- `CBA-SEED-30`: no critical zero-test trigger exists in the control variant. Expected: analyzer does not invent a TESTABILITY plan.

## Regression Controls

- `CBA-SEED-08`: guarded failure mode where the analyzer edited source to fix findings.
- `CBA-SEED-18`: guarded failure mode where the report omitted severity summary and current-state classification.
- `CBA-SEED-28`: guarded failure mode where the analyzer routed directly to Programmer instead of remediation/review.

## Scoring Notes

- Negative controls are scored only as `CORRECT_SKIP` or `FALSE_POSITIVE`.
- Non-negative controls are scored only as `CAUGHT`, `PARTIAL`, or `MISSED`.
- This suite evaluates CodeBase Analyzer output behavior against persona and skill requirements.
- The agent under test must not see this file, `seed-catalog.tsv`, or `seed-ledger.md`.
