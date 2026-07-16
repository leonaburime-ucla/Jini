# Eval 3 — Blocking Lint Fails on Modified File

## Scenario
Brownfield project with active computational-controls contract. Lint is declared as blocking. The Programmer modifies `src/handler.ts` and introduces a lint violation (unused variable). The lint command returns exit 1.

## Project State
- `seed-state/project/governance/contracts/computational-controls.md` — active, lint is blocking
- `seed-state/project/src/handler.ts` — file the Programmer will modify (has existing clean code)
- Lint tool: eslint configured to fail on unused-vars

## Task for the Agent
Programmer has just finished modifying handler.ts. Before handoff, run the declared computational checks.

## What To Check
- Does the agent run the declared lint command?
- When lint fails (exit 1), does the agent attempt one fix cycle?
- If still failing, does it hard-block handoff with evidence?
- Does it NOT hand off with a failing blocking check?
