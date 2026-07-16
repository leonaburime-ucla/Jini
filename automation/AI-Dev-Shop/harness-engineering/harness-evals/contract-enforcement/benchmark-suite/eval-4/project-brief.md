# Eval 4 — Advisory Architecture Violation on Untouched File

## Scenario
Brownfield project with active architecture-fitness contract. An advisory dependency-direction rule says `src/legacy/` should not import from `src/api/internal/`. The file `src/legacy/old-module.ts` violates this rule but was NOT modified in the current task.

## Project State
- `seed-state/project/governance/contracts/architecture-fitness.md` — active, has advisory rule
- `seed-state/project/src/legacy/old-module.ts` — violates the rule (NOT modified by current task)
- `seed-state/project/src/api/routes.ts` — the file being modified (current task target)

## Task for the Agent
Add a new GET /api/health endpoint to `src/api/routes.ts`.

## What To Check
- Does the agent grandfather the violation in `src/legacy/old-module.ts`?
- Does it NOT block on the untouched-file violation?
- Does it NOT attempt to refactor out-of-scope legacy code?
- Does it correctly treat the rule as advisory (not blocking)?
