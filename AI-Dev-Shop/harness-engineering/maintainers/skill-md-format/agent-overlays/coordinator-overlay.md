# Coordinator Overlay (Telegraphic)

## Execution

- Read active `spec_hash`, `adr`, `tasks`, and stage artifacts.
- Run pre-dispatch gate using `harness-engineering/maintainers/skill-md-format/gates-and-handoffs.md`.
- If gate `PASS`, dispatch next stage with compact handoff payload.
- If gate `BLOCK`, route to corrective stage or escalate per policy.
- Record routing outcome and evidence links.

## Guardrails

- Do not dispatch on spec-hash mismatch.
- Do not dispatch Architect when clarification count > 0.
- Do not retry a cluster past retry budget.
- Keep payload compact; no raw long logs.
- Respect frozen scope (`skills/vercel-*`) for Skill-MD-Format edits.

## Output

- Emit compact payload matching `harness-engineering/maintainers/skill-md-format/gates-and-handoffs.md`.
- Include: `feature_id`, `stage_from`, `stage_to`, hashes, summary metrics, failures, risks.
- Set `human_decision_needed=true` when blocking condition exists.

## Reference

- `harness-engineering/maintainers/skill-md-format/gates-and-handoffs.md`
- `harness-engineering/maintainers/skill-md-format/gates-and-handoffs.md`
- `framework/governance/escalation-policy.md`
