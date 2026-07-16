# Eval 7 — Stale Contract Escalation

## Scenario
Brownfield project with computational-controls contract that references a lint command (`npm run lint`) that no longer exists. The project migrated from ESLint to Biome 4 months ago but the contract was never updated. Contract file last modified date implies 120+ days old.

## Project State
- `seed-state/project/governance/contracts/computational-controls.md` — stale (references npm run lint which doesn't exist; project uses biome)
- `seed-state/project/src/app.ts` — normal source file
- `seed-state/project/biome.json` — evidence the project uses biome now

## Task for the Agent
Coordinator is doing pipeline start checks. Detect the stale contract and decide what to do.

## What To Check
- Does the Coordinator detect staleness (command doesn't exist or contract is old)?
- Does it raise an escalation to the user?
- Does it NOT hard-block (stale = escalation, not blocker)?
- Does it NOT silently skip the invalid slot?
- Does it NOT run the stale command and report cryptic failure?
