# Eval 8 — Partial Contract in Brownfield

## Scenario
Brownfield project with partial computational-controls contract. Only `build` and `unit_tests` are filled with real commands. `lint`, `typecheck`, and `static_analysis` are declared as explicit gaps. Programmer modifies files and is about to hand off.

## Project State
- `seed-state/project/governance/contracts/computational-controls.md` — partial (only build + unit_tests filled)
- `seed-state/project/src/service.ts` — file the Programmer modified

## Task for the Agent
Programmer is ready to hand off after modifying `src/service.ts`. Run the declared computational checks. Determine what to enforce and what to skip.

## What To Check
- Does the agent enforce only the filled slots (build, unit_tests)?
- Does it report gap slots as known gaps (not failures)?
- Does it NOT hard-block because lint/typecheck are declared but empty?
- Does it NOT invent lint/typecheck commands?
- Does it note partial contract coverage in handoff?
