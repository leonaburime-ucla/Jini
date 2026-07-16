# Tasks: Pipeline Ops Extension

- Date: 2026-02-27
- Status: Ready for execution

## Phase 1 - Skills

- [ ] Create `skills/api-contracts/SKILL.md` with:
  - Spec completeness checklist
  - OpenAPI generation/validation rules
  - backward-compatibility diff rules
  - consumer contract test guidance
- [ ] Create `skills/change-management/SKILL.md` with:
  - feature flag rollout patterns
  - dual-write and backfill safety patterns
  - cutover/rollback guardrails

## Phase 2 - Agents

- [ ] Create `agents/devops/skills.md` and define outputs:
  - CI/CD config expectations
  - release + rollback runbooks
  - deployment evidence contract
- [ ] Create `agents/qa-e2e/skills.md` and define outputs:
  - E2E suite standards
  - fixture and anti-flake policy
  - matrix and reporting format
- [ ] Create `agents/docs/skills.md` and define outputs:
  - release note template
  - changelog policy
  - public/internal docs coverage checklist

## Phase 3 - Routing Integration

- [ ] Update pipeline sequence docs to include QA/E2E, DevOps, Docs.
- [ ] Add conditional dispatch rules for each new agent.
- [ ] Add API Contract gate to Spec + Code Review dispatch context.
- [ ] Add Programmer migration-mode dispatch template when `MIGRATION-*.md` exists.

## Phase 4 - Governance

- [ ] Update `framework/routing/skills-registry.md` mappings.
- [ ] Add escalation triggers:
  - E2E flake rate above threshold
  - deployment runbook missing rollback path
  - breaking API change without explicit approval

## Handoff Contract
- Inputs used: ADR-001 in same folder.
- Output summary: executable task list to integrate 3 agents + 2 skills.
- Risks: framework read-only policy may require explicit governance exception.
- Suggested next assignee: Coordinator (Pipeline) after human approval.
