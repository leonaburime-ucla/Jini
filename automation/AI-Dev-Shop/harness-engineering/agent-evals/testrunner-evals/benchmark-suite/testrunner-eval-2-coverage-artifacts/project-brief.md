# Invoice Export — TestRunner Project Brief

## Goal

Operate as the TestRunner agent for Invoice Export. Verify coverage gates from retained artifacts and produce a coverage status report without averaging, rounding, overwriting, or hiding per-file regressions.

## Where To Read

- `seed-state/feature/feature.spec.md`
- `seed-state/feature/test-certification.md`
- `seed-state/feature/tasks.md`
- `seed-state/coverage/`

## Expected Output

Write the normal TestRunner report in the fresh run copy:

- `runs/<run-id>/outputs/TESTRUN-402-invoice-export-<timestamp>.md`

Do not overwrite coverage artifacts. Report every failing metric and per-file regression explicitly.
