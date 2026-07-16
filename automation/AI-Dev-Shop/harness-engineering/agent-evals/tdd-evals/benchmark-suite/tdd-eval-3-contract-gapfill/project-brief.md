# Admin Ops — TDD Gap-Fill Project Brief

## Goal

Operate as the TDD agent in Coverage Gap Fill Mode for Admin Ops. Use the coverage report, implementation files, ADR, spec, and current certification record to add only spec-traceable tests and route no-spec paths to Coordinator.

## Where To Read

- `seed-state/feature/feature.spec.md`
- `seed-state/feature/adr.md`
- `seed-state/feature/tasks.md`
- `seed-state/feature/coverage-gap-report.md`
- `seed-state/feature/test-certification.md`
- `seed-state/src/`
- `seed-state/tests/`

## Expected Output

Write normal gap-fill output in the fresh run copy:

- new or updated test files under type-specific test directories
- updated `runs/<run-id>/feature/test-certification.md`
- a prose report listing tests written and any uncovered no-spec paths to route to Refactor

Do not assume this is an eval. Treat it as normal post-TestRunner TDD gap-fill work.
