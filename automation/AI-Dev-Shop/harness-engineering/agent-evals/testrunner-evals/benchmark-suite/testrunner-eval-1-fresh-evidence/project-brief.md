# Subscription Renewal — TestRunner Project Brief

## Goal

Operate as the TestRunner agent for Subscription Renewal. Verify the active spec hash and TDD certification before relying on any run evidence. If the package is not certifiable, stop and report every visible blocker.

## Where To Read

- `seed-state/feature/feature.spec.md`
- `seed-state/feature/test-certification.md`
- `seed-state/feature/test-certification-whitespace-control.md`
- `seed-state/feature/tasks.md`
- `seed-state/artifacts/`

## Expected Output

Write the normal TestRunner report in the fresh run copy:

- `runs/<run-id>/outputs/TESTRUN-401-subscription-renewal-<timestamp>.md`

If pre-run gates block execution, write a refusal/escalation report instead. Do not overwrite prior reports and do not modify tests or source files.
