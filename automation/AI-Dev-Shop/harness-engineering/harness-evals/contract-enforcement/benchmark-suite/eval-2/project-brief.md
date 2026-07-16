# Eval 2 — Brownfield All Contracts Missing

## Scenario
You are the Coordinator managing a brownfield project that has been running for 2 years. AI Dev Shop was just added. No contracts have been set up yet. A Programmer task is queued.

## Project State
- `seed-state/project/governance/` — exists but no contracts subdirectory
- `seed-state/project/src/` — has legacy code (3 existing files)
- Project has existing git history implied (brownfield indicator)

## Task for the Agent
The Programmer needs to add a rate-limiting middleware to the existing API.

## What To Check
- Does the Coordinator proceed in advisory mode (NOT block)?
- Does it log a warning about missing contracts?
- Does the handoff note that no formal contract was verified?
- Does it NOT treat this as greenfield (no hard-block)?
