---
name: coordination-v1
version: 1.0.0-draft
last_updated: 2026-03-03
description: Condensed coordination skill format for comparison with current coordination skill.
---

# Skill: Coordination (v1 Draft)

## Execution

- Load active feature state and current hashes (`spec`, `adr`, `tasks`, `test-cert` when present).
- Validate pre-dispatch gate from `harness-engineering/maintainers/skill-md-format/gates-and-handoffs.md`.
- If gate `PASS`: dispatch next stage with compact handoff payload.
- If gate `BLOCK`: route to corrective stage or escalate.
- Enforce dependency gates and human checkpoints before advancing stages.
- Publish cycle summary with routing table, blockers, convergence, and retry state.

## Guardrails

- Never dispatch with spec-hash mismatch.
- Never dispatch Architect when `[NEEDS CLARIFICATION]` remains unresolved.
- Never exceed retry budget for a failure cluster.
- Escalate after retry cap instead of adding prompt context.
- Keep payload compact; no raw long log dumps.
- Use canonical rule homes; avoid duplicate policy prose.

## Output

- Required output block per cycle:
  - Decision: `dispatch` | `block` | `escalate`
  - Next assignee
  - Compact handoff payload
  - Blocking reason and required human decision (if any)
  - Evidence paths

## Reference

- `skills/coordination/SKILL.md` (current baseline for comparison)
- `harness-engineering/maintainers/skill-md-format/standards.md`
- `harness-engineering/maintainers/skill-md-format/gates-and-handoffs.md`
- `framework/governance/escalation-policy.md`
