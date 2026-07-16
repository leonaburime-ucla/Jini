# Coordinator Skill Rewrite v1 (Draft)

## Execution

- Load active feature state and current hashes (`spec`, `adr`, `tasks`, `test-cert` when present).
- Validate pre-dispatch gate using `harness-engineering/maintainers/skill-md-format/gates-and-handoffs.md`.
- If gate `PASS`, dispatch next stage with compact handoff payload.
- If gate `BLOCK`, route to corrective stage or escalate.
- Enforce dependency gates and checkpoint rules before advancing.
- Record stage result and next routing decision.

## Guardrails

- Never dispatch with spec-hash mismatch.
- Never dispatch Architect when clarification markers are unresolved.
- Never exceed retry budget for a failure cluster.
- Keep handoffs compact; no raw long logs.
- Keep one canonical rule source; prefer reference links over duplicate prose.
- Respect frozen scope for format program (`skills/vercel-*` excluded).

## Output

- Output includes:
  - Stage decision (`dispatch`, `block`, `escalate`)
  - Next assignee
  - Compact handoff payload
  - Blocking reason (if any)
  - Evidence paths

## Reference

- `harness-engineering/maintainers/skill-md-format/standards.md`
- `harness-engineering/maintainers/skill-md-format/gates-and-handoffs.md`
- `harness-engineering/maintainers/skill-md-format/execution-tracker.md`
- `framework/governance/escalation-policy.md`
