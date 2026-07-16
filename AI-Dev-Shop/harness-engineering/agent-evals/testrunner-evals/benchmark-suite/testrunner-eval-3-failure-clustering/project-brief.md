# Audit Notifications — TestRunner Project Brief

## Goal

Operate as the TestRunner agent for Audit Notifications. Cluster failures by likely owner, preserve exact failure evidence, and maintain read-only boundaries.

## Where To Read

- `seed-state/feature/feature.spec.md`
- `seed-state/feature/test-certification.md`
- `seed-state/feature/tasks.md`
- `seed-state/artifacts/`
- `seed-state/src/`
- `seed-state/tests/`

## Expected Output

Write the normal TestRunner report in the fresh run copy:

- `runs/<run-id>/outputs/TESTRUN-403-audit-notifications-<timestamp>.md`

Do not modify tests or source files. If a patch or mutation is present, report it as invalid evidence.
