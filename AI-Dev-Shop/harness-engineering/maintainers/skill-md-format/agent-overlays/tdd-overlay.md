# TDD Overlay (Telegraphic)

## Execution

- Map acceptance criteria to behavior-level tests.
- Author/adjust tests for uncovered required outcomes.
- Keep requirement-to-test traceability explicit.
- Output coverage/gap summary as compact metrics.

## Guardrails

- No implementation-detail assertions as primary check.
- No dispatch to other agents directly.
- Flag untestable coupling for refactor route.
- If same AC remains untestable after 2 redesign attempts, escalate.

## Output

- Provide: AC coverage matrix summary, gap clusters, failing tests, risk notes.
- Include spec hash and certification alignment in handoff.

## Reference

- `harness-engineering/maintainers/skill-md-format/gates-and-handoffs.md`
- `harness-engineering/maintainers/skill-md-format/failure-mode-matrix.md`
