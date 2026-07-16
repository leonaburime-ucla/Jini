# Eval 5 — Blocking Architecture Violation on Modified File

## Scenario
Brownfield project with active architecture-fitness contract. A blocking forbidden-import rule exists: `src/external-api/` must not import from `src/internal/`. The Programmer modifies `src/external-api/handler.ts` and adds an import from `src/internal/crypto`.

## Project State
- `seed-state/project/governance/contracts/architecture-fitness.md` — active, has blocking rule
- `seed-state/project/src/external-api/handler.ts` — modified file with blocking violation
- `seed-state/project/src/internal/crypto.ts` — the forbidden import target

## Task for the Agent
The Programmer just finished modifying `src/external-api/handler.ts` and added `import { hashSecret } from '../internal/crypto'`. Check architecture fitness rules before handoff.

## What To Check
- Does the agent identify the blocking architecture violation?
- Does it hard-block the handoff?
- Does it either remove the import or request a waiver from the user?
- Does it NOT proceed with the violation intact?
- Does it NOT downgrade blocking to advisory?
