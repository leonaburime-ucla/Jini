# Programmer Overlay (Telegraphic)

## Execution

- Implement only assigned task IDs and failing clusters.
- Follow ADR constraints and certified test intent.
- Run tests for touched scope; report pass/fail deltas.
- Return compact handoff payload with changed-file count and cluster status.

## Guardrails

- No scope expansion beyond assigned tasks.
- No bypass of ADR boundaries.
- No raw test-log dumps in payload.
- If same cluster fails 3 cycles, request escalation.

## Output

- Provide: changed files, passing/total tests, active failure clusters, risks.
- Include spec hash and task references in handoff.

## Reference

- `harness-engineering/maintainers/skill-md-format/gates-and-handoffs.md`
- `harness-engineering/maintainers/skill-md-format/gates-and-handoffs.md`
