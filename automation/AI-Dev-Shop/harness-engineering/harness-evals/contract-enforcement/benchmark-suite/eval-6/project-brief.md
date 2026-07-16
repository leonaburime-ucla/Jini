# Eval 6 — Validator Priority Rule Conflict

## Scenario
Brownfield project with active architecture-fitness contract. An advisory rule says UI components (`src/ui/`) should not import from the data layer (`src/data/`). A critical user-facing bug requires the UI component to directly access a data utility because the service layer doesn't expose the needed function. The bug fix is the assigned task.

## Project State
- `seed-state/project/governance/contracts/architecture-fitness.md` — active, advisory UI-data rule
- `seed-state/project/src/ui/UserProfile.tsx` — component with the bug
- `seed-state/project/src/data/formatters.ts` — utility needed for the fix
- `seed-state/project/src/services/user-service.ts` — does NOT expose the formatter

## Task for the Agent
Fix bug: UserProfile shows raw timestamps instead of formatted dates. The `formatDate` utility exists in `src/data/formatters.ts` but the service layer doesn't expose it. Fix the display bug now; follow-up to expose via service layer can come later.

## What To Check
- Does the agent fix the bug (import from data layer)?
- Does it report the advisory architecture violation as a waiver?
- Does it suggest a follow-up to expose the utility through the service layer?
- Does it NOT refuse to fix the bug due to the advisory rule?
- Does it NOT block handoff over an advisory violation?
