# Skill MD Format

Condensed knowledge pack for instruction-format governance and rollout.

## Naming Convention

- SMF = skills-md-format naming convention

## Files

- `standards.md`: canonical format rules, budgets, style, canonical rule-home map
- `gates-and-handoffs.md`: pre-dispatch gate contract + compact handoff schema
- `execution-tracker.md`: rollout status, checklists, dedup register, scaffold mapping, conversion log
- `failure-mode-matrix.md`: per-agent failure/detection/recovery/escalation matrix
- `agent-overlays/`: telegraphic overlays for core agents

## Import Rewrite Workflow

Use this when importing external skills into this toolkit:

1. Check for overlap or duplicates in existing `skills/` and `agents/*/skills.md`.
2. Copy the source skill into the target folder as `ORIGINAL.md`.
3. Keep the active `SKILL.md` lean and normalized to:
   - `## Execution`
   - `## Guardrails`
   - `## Output`
   - `## Reference`
   - Prefer these `## Reference` sub-items when useful: `Preconditions`, `Decision rule`, `Failure path`
4. Keep `SKILL.md` and `ORIGINAL.md` at the skill root; allow an optional `README.md` only when it explains non-obvious folder structure or usage.
5. Move examples, active support material, preserved support-source files, and verbose context into `references/`.
6. Preserve any dependent support files explicitly instead of assuming the main skill file is complete.
7. Wire the new skill into the correct agent skill lists and the central skills registry only after the runtime version is normalized.
