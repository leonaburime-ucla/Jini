# Standards

## Scope

- Applies to project-level instruction rewrites.
- Active rollout scope includes `skills/vercel-*` and imported `skills/superpowers-*`.

## Section Contract

1. `## Execution`
2. `## Guardrails`
3. `## Output`
4. `## Reference` (optional, uncapped)

Recommended `## Reference` sub-items for imported or rewritten skills:
- `Preconditions`
- `Decision rule`
- `Failure path`

## Budget Targets

- `Execution` <= 250 words
- `Guardrails` <= 150 words
- `Output` <= 120 words

If over budget: reduce now or record owner/date in execution tracker.

## Writing Style

- Telegraphic imperative bullets.
- Use concrete verbs (`Read`, `Verify`, `Dispatch`, `Route`, `Escalate`).
- Keep rationale in `Reference` only.

## Structure Over Prose

Prefer enforceable structure over reminder text:
- Required fields/checklists/schemas first
- Narrative reminders second

## Imported Skill Rewrite Rules

- Run overlap check before import; do not import exact duplicates.
- Preserve imported source immediately as `ORIGINAL.md`.
- Keep `SKILL.md` lean and execution-focused.
- Keep `SKILL.md` and `ORIGINAL.md` at the skill root; allow an optional `README.md` only when it explains non-obvious folder structure or usage. Move all other examples, active support docs, and deep rationale into `references/`.
- Import dependent support files deliberately; do not assume the main skill file is sufficient.
- Normalize imported runtime docs to the Section Contract before wiring them into agents.
- Decide target agent(s) before adapting the skill so scope and wording stay role-correct.

## Canonical Rule Homes

- Routing rules -> `skills/coordination/SKILL.md`
- Per-agent execution -> `agents/<name>/skills.md`
- Stage contracts/context injection -> `framework/workflows/multi-agent-pipeline.md`
- Project-wide guardrails -> `project-knowledge-template/governance/constitution.md`
- Human escalation policy -> `framework/governance/escalation-policy.md`

## Dependency Gates

- `SMF.1` gates `SMF.3`, `SMF.4`
- `SMF.2` gates `SMF.6`

## ORIGINAL.md Naming Convention

For imported or preserved source skills:
- `ORIGINAL.md` = preserved source version or long-form original reference.
- `SKILL.md` = execution-optimized version for AI/LLM runtime behavior.
- `README.md` = optional root-level layout or usage note when the skill needs structural explanation.
- `references/` = examples, active support files, preserved support-source files, and optional deep context.
