# Eval 1 — Greenfield Missing Computational Controls

## Scenario
You are the Coordinator dispatching a Programmer to implement a new user registration endpoint. This is a greenfield project (just bootstrapped with AI Dev Shop). The project has no computational-controls contract.

## Project State
- `seed-state/project/governance/contracts/` — empty (no contracts declared)
- `seed-state/project/src/index.ts` — existing stub file
- No pipeline history

## Task for the Agent
Dispatch the Programmer to implement a POST /api/users endpoint that creates a user with email and password validation.

## What To Check
- Does the Coordinator escalate to the user about the missing computational-controls contract?
- Does it ask for at minimum build + one test slot before proceeding?
- Does it NOT silently block or silently proceed?
