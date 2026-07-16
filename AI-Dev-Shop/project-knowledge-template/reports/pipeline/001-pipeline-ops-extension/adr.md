# ADR-001: Extend Pipeline with Delivery Ops Roles

- Date: 2026-02-27
- Status: Proposed
- Spec: N/A (framework extension)
- Decision Owner: Coordinator

## Context
Current pipeline strongly covers spec, architecture, implementation, review, and security. Gaps remain in deployability, E2E quality ownership, and user-facing documentation ownership.

## Decision
Adopt 3 new agents and 2 role-bound skill expansions:

1. Add `DevOps Agent`.
2. Add `QA/E2E Agent`.
3. Add `Docs Agent`.
4. Add `API Contract` as a shared skill/gate on Spec + Code Review (optional TDD assist).
5. Add `Migration Mode` to Programmer (no new agent).

## Rationale
- `API Contract` work is mostly deterministic validation and compatibility gating; it does not require another full dispatch lane.
- Migration execution is implementation work and fits Programmer when bounded by migration gates.
- DevOps, QA/E2E, and Docs each produce distinct artifacts and need explicit ownership.

## Updated Pipeline (proposed)
`[CodeBase Analyzer] -> Spec -> [Red-Team] -> Architect -> [Database] -> TDD -> Programmer -> QA/E2E -> TestRunner -> Code Review -> [Refactor] -> Security -> DevOps -> Docs -> Done`

## Agent Responsibilities

### DevOps Agent
- Owns CI/CD workflow definitions, Docker/build configs, release runbook, rollback runbook, runtime health checks.
- Never stores secrets in repo artifacts.
- Produces deploy checklist and rollback validation evidence.

### QA/E2E Agent
- Owns user-journey E2E suites, fixture strategy, anti-flake controls, browser/device matrix.
- Produces E2E pass/fail evidence and flake-rate summary.

### Docs Agent
- Owns release notes, changelog entries, user/admin docs, upgrade notes.
- Must document behavior from spec/ADR and final implementation evidence, not intent-only drafts.

## Skill/Gate Changes

### API Contract Skill (Spec + Code Review)
- Spec stage: API completeness and contract precision checks.
- Code Review stage: backward-compatibility diff and breaking-change detection.
- Optional TDD assist: contract test case generation hints.

### Programmer Migration Mode
- Inputs: approved `MIGRATION-*.md`, ADR, tests/certification.
- Responsibilities: feature flags, dual writes, backfill scripts, cutover logic, rollback code paths.
- Mandatory checkpoints: dry-run evidence, idempotency checks, rollback rehearsal evidence.

## Risks
- Longer pipeline wall-clock time.
- Higher coordination overhead unless dispatch contracts stay strict.

## Mitigations
- Conditional dispatch: QA/E2E only for user-flow changes; DevOps only when deploy/runtime shape changes; Docs always for shipped behavior changes.
- Keep API Contract as a gate (skill), not a full agent.

## Handoff Contract
- Inputs used: repository AGENTS/workflows context + user-approved role split in chat.
- Output summary: extension ADR with responsibilities, sequence, and risk controls.
- Risks: requires framework-source integration to become active.
- Suggested next assignee: Architect Agent (framework update ADR review), then Coordinator for task generation.
