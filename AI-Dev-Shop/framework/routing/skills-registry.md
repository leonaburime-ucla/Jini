---
name: skills-registry
version: 1.2.29
last_updated: 2026-06-29
description: Maps every shared skill to the agents that use it. Reference when dispatching agents or updating skills.
---

# Skills Registry

This is the **single source of truth** for all skills in the toolkit.

## What Is a Skill?

A skill is a reusable capability module that agents load at dispatch time. Skills are not agents — they have no persona, no routing identity, and no reserved name. An agent composes one or more skills to do its work.

## Convention

Every skill lives at: `<AI_DEV_SHOP_ROOT>/skills/<skill-name>/SKILL.md`

`SKILL.md` is the entrypoint. Some skills have additional files (templates, schemas, examples) alongside it.

## How Skills Are Used

1. The Coordinator resolves which agent handles a task.
2. That agent's `agents/<name>/skills.md` lists which skills it loads.
3. The agent reads each skill's `SKILL.md` before starting work.

Skills can be conditionally activated — loaded only when a specific task type triggers them.

## Adding or Removing a Skill

1. Create (or delete) `skills/<skill-name>/SKILL.md`.
2. Add (or remove) the mapping row in the table below.
3. Update the consuming agent's `agents/<name>/skills.md`.

Do NOT maintain a duplicate skill list anywhere else. This file is the only inventory.

---

## Skill → Agent Mapping

All agents draw from `<AI_DEV_SHOP_ROOT>/skills/`. Do not duplicate skill content in agent files — reference the skill file instead.

| Skill | Used By |
|---|---|
| `skills/spec-writing/SKILL.md` | Spec Agent |
| `skills/test-design/SKILL.md` | TDD Agent |
| `skills/architecture-decisions/SKILL.md` | Software Architect, Programmer, System Design Agent (secondary), TestRunner Agent (failure classification reference) |
| `skills/implementation-outline/SKILL.md` | Software Architect (producer), Coordinator (gate), TDD Agent and Programmer (consumers) |
| `skills/code-review/SKILL.md` | Code Review Agent |
| `skills/refactor-patterns/SKILL.md` | Refactor Agent |
| `skills/coordination/SKILL.md` | Coordinator, Observer |
| `skills/context-engineering/SKILL.md` | Coordinator, Observer |
| `skills/browser-live-analysis/SKILL.md` | Programmer, QA/E2E Agent |
| `skills/memory-systems/SKILL.md` | Coordinator, Observer |
| `skills/tool-design/SKILL.md` | Programmer |
| `skills/syntax-aware-editing/SKILL.md` | Inactive by default; not wired to a default agent and available for future activation when parser-backed tooling is adopted |
| `skills/agent-evaluation/SKILL.md` | Observer |
| `skills/codebase-analysis/SKILL.md` | CodeBase Analyzer |
| `skills/general-behavior/SKILL.md` | All agents (universal cross-cutting dispatcher; thin pointer layer to lightweight behavior references and larger shared skills) |
| `skills/code-navigation/SKILL.md` | All agents (via general-behavior; per-query-class routing across rg and graph backends) |
| `skills/codebase-graph/SKILL.md` | Coordinator, CodeBase Analyzer, Refactor Agent |
| `skills/architecture-migration/SKILL.md` | CodeBase Analyzer |
| `skills/reverse-spec/SKILL.md` | Coordinator, Spec Agent, CodeBase Analyzer, Software Architect (brownfield and rewrite workflows) |
| `skills/design-patterns/SKILL.md` | Software Architect, CodeBase Analyzer, System Design Agent (secondary) |
| `skills/backend-implementation/SKILL.md` | Programmer (default backend/service/worker implementation entrypoint) |
| `skills/adversarial-test-design/SKILL.md` | Programmer (conditional for aggregate-risk workflows such as rule, validation, batch, reducer, reconciliation, transfer, and other cross-record logic) |
| `skills/coding-foundations/SKILL.md` | Software Architect, Programmer, TDD Agent, Refactor Agent, Code Review Agent (tiny shared parent for micro-level coding axioms) |
| `skills/hexagonal-architecture/SKILL.md` | Software Architect, Programmer, CodeBase Analyzer, System Design Agent |
| `skills/implementation-guardrails/SKILL.md` | Software Architect, Programmer, Refactor Agent, Code Review Agent (child layer for complexity, scaling, and maintainability guardrails; always load alongside `coding-foundations`) |
| `skills/function-quality-assessment/SKILL.md` | Software Architect (Design Gate only for implementation-outline contracts), Programmer, Code Review Agent, Refactor Agent (shared per-function scoring, findings, and pass/debt/block routing wrapper over coding foundations, testable design, implementation guardrails, and inline docs) |
| `skills/non-functional-requirements-discovery/SKILL.md` | System Design Agent, Spec Agent, Software Architect (targeted deepening) |
| `skills/system-blueprint/SKILL.md` | System Design Agent, Coordinator |
| `skills/system-design/SKILL.md` | System Design Agent, Software Architect (shared macro-topology and architecture-spec reference) |
| `skills/advanced-frontend-architecture/SKILL.md` | Software Architect (frontend architecture selection and validation), Code Review Agent (frontend architecture drift checks) |
| `skills/feature-slice-design/SKILL.md` | Programmer (frontend applications — React, Vue, Svelte, Angular, plain TS) |
| `skills/frontend-react-orcbash/SKILL.md` | Programmer (conditional React Orc-BASH implementation), Software Architect (React frontend hexagonal pattern reference), Code Review Agent (React Orc-BASH adherence checks) |
| `skills/testable-design-patterns/SKILL.md` | Software Architect, Programmer, TDD Agent, Refactor Agent, Code Review Agent (child layer for testability and coverage-friendly structure; always load alongside `coding-foundations`) |
| `skills/vercel-react-best-practices/SKILL.md` | Programmer, Code Review Agent (React/Next tactical guidance) |
| `skills/vercel-composition-patterns/SKILL.md` | Programmer, Code Review Agent (React component API patterns) |
| `skills/ux-design/SKILL.md` | Web Design Agent (design system creation, visual direction, component/state design, implementation-ready handoff) |
| `skills/premium-ui/SKILL.md` | Web Design Agent (premium website polish, first-impression design, conversion hierarchy, and reference routing) |
| `skills/interface-design/SKILL.md` | Web Design Agent, Programmer (app/tool interface-system consistency and design-memory reference) |
| `skills/gstack-design/SKILL.md` | Manual/user-invoked via `/gstack-design`; Coordinator and Skills Librarian discovery only; not wired into the default pipeline |
| `skills/vercel-web-design-guidelines/SKILL.md` | Web Design Agent, Code Review Agent, QA/E2E Agent (UI/UX guideline audits) |
| `skills/vercel-react-native-skills/SKILL.md` | Programmer, QA/E2E Agent, Code Review Agent (React Native/Expo tactical guidance) |
| `skills/expo-react-native/SKILL.md` | Programmer, Software Architect, Code Review Agent, QA/E2E Agent, DevOps Agent (progressive-disclosure router for official Expo skills and React Native tactical rules) |
| `skills/expo/skills/*/SKILL.md` | Loaded only through `skills/expo-react-native/SKILL.md` (vendored official Expo plugin subskills for UI, data fetching, API routes, native modules, EAS, deployment, upgrades, and update insights) |
| `skills/gstack-ios/SKILL.md` | Manual/user-invoked via `/gstack-ios`; Coordinator and Skills Librarian discovery only; not wired into the default pipeline |
| `skills/sql-data-modeling/SKILL.md` | Database Agent |
| `skills/postgresql/SKILL.md` | Database Agent, Supabase Sub-Agent |
| `skills/supabase/SKILL.md` | Supabase Sub-Agent |
| `skills/systematic-debugging/SKILL.md` | Programmer (debug process reference) |
| `skills/pattern-priming/SKILL.md` | Programmer |
| `skills/inline-code-documentation/SKILL.md` | Programmer |
| `skills/adr-governance/SKILL.md` | Software Architect (promotion), Programmer (conditional governance enforcement), Code Review Agent (audit reference), Refactor Agent (conditional), TDD Agent (conditional) |
| `skills/ui-loop/SKILL.md` | Programmer (conditional for UI-heavy tasks) |
| `skills/focused-test/SKILL.md` | Programmer (conditional for test-driven iteration) |
| `skills/constitution-compliance/SKILL.md` | Software Architect |
| `skills/superpowers-brainstorming/SKILL.md` | VibeCoder Agent |
| `skills/superpowers-using-git-worktrees/SKILL.md` | Programmer, VibeCoder Agent |
| `skills/superpowers-verification-before-completion/SKILL.md` | Programmer, TestRunner Agent, DevOps Agent |
| `skills/superpowers-finishing-a-development-branch/SKILL.md` | Programmer, VibeCoder Agent |
| `skills/superpowers-receiving-code-review/SKILL.md` | Programmer |
| `skills/superpowers-requesting-code-review/SKILL.md` | Programmer |
| `skills/superpowers-dispatching-parallel-agents/SKILL.md` | Coordinator |
| `skills/superpowers-writing-plans/SKILL.md` | Coordinator |
| `skills/shadcn-ui/SKILL.md` | Skills Librarian, Web Design Agent, Programmer (frontend component integration reference) |
| `skills/seo-geo/SKILL.md` | Search Visibility (primary), Skills Librarian (refresh/maintenance). Do not load as standing context for delivery agents; route through the optional Search Visibility module when explicitly triggered. |
| `skills/web-compliance/SKILL.md` | Web Design Agent, Search Visibility, Code Review Agent, Security Agent, QA/E2E Agent (website legal/compliance UX risk checks) |
| `skills/find-skills/SKILL.md` | Skills Librarian only (external discovery) |
| `skills/enterprise-spec/SKILL.md` | Spec Agent (enterprise contexts) |
| `skills/evaluation/eval-rubrics.md` | Observer |
| `skills/swarm-consensus/SKILL.md` | Coordinator (owns consensus dispatch; injects to other agents only when consensus mode is active) |
| `skills/external-audit/SKILL.md` | Coordinator (packages current work for one or more external LLM auditors and synthesizes cross-auditor findings back to the user) |
| `skills/experimental-validation/SKILL.md` | All agents (conditional via runtime disclosure mandate; execution only after user approval) |
| `skills/observability-implementation/SKILL.md` | Software Architect, Programmer, Security Agent |
| `skills/incident-response/SKILL.md` | DevOps Agent, Coordinator (production incident routing), Observer (post-incident pattern analysis) |
| `skills/backup-strategy/SKILL.md` | DevOps Agent, Software Architect (recovery objectives), Database Agent (mechanism selection) |
| `skills/disaster-recovery-planning/SKILL.md` | Software Architect (DR architecture), DevOps Agent (implementation and drills), Database Agent (replication topology) |
| `skills/secure-input-handling/SKILL.md` | Programmer (implementation), TDD Agent (boundary test cases), Security Agent (review verification), Code Review Agent |
| `skills/data-engineering/SKILL.md` | Database Agent, Software Architect, Programmer |
| `skills/developer-documentation/SKILL.md` | Docs Agent |
| `skills/llm-operations/SKILL.md` | Software Architect, Programmer, Coordinator (via shared peer-dispatch rules used by external-audit and swarm-consensus) |
| `skills/handoff/SKILL.md` | Coordinator, all agents when producing cross-session, cross-host, or next-agent continuation handoffs |
| `skills/devops-delivery/SKILL.md` | DevOps Agent |
| `skills/gstack-release/SKILL.md` | Manual/user-invoked via `/gstack-release`; Coordinator and Skills Librarian discovery only; not wired into the default pipeline |
| `skills/security-review/SKILL.md` | Software Architect (design-time threat surface only), Security, Code Review, DevOps |
| `skills/performance-engineering/SKILL.md` | TestRunner Agent, Software Architect |
| `skills/memory-regression/SKILL.md` | QA/E2E Agent, TestRunner Agent, Programmer, Software Architect (conditional memory/resource leak prevention and bounded-growth verification) |
| `skills/api-contracts/SKILL.md` | Spec Agent, Code Review Agent, Docs Agent |
| `skills/api-design/SKILL.md` | Spec Agent, Software Architect, Code Review Agent, Docs Agent |
| `skills/frontend-accessibility/SKILL.md` | Web Design Agent, Search Visibility, Code Review Agent, QA/E2E Agent |
| `skills/e2e-test-architecture/SKILL.md` | QA/E2E Agent, TDD Agent |
| `skills/rag-ai-integration/SKILL.md` | Software Architect, Programmer, Database Agent |
| `skills/change-management/SKILL.md` | Programmer, DevOps Agent, Software Architect, Database Agent |
| `skills/infrastructure-as-code/SKILL.md` | DevOps Agent, Software Architect |
| `skills/vibe-coding/SKILL.md` | VibeCoder Agent (optional, Agent Direct Mode) |
| `framework/governance/tool-permission-policy.md` | All agents (security guardrails) |
| `harness-engineering/skills-inbox/skill-conflict-resolution.md` | All agents (cross-skill conflict handling and user choice protocol) |
| `harness-engineering/skills-inbox/skills-librarian-policy.md` | Coordinator, Skills Librarian (external skill discovery/ingestion governance) |
| `framework/operations/react-skill-operations.md` | Coordinator, Programmer, Code Review, QA/E2E (React skill preflight, precedence, and evaluation loop) |
| `harness-engineering/skills-inbox/skills-librarian-sop.md` | Skills Librarian, Coordinator (inbox workflow and audit lifecycle) |
| `framework/governance/data-classification.md` | All agents (PII and secret handling) |
| `framework/routing/model-routing.md` | Coordinator (dispatch tier selection) |
| `framework/governance/escalation-policy.md` | Coordinator (retry budgets and escalation triggers) |
| `framework/workflows/status-confidence-taxonomy.md` | Coordinator, System Design Agent, Spec Agent, Red-Team Agent, Software Architect, CodeBase Analyzer (label boundary reference) |
| `harness-engineering/quality/agent-performance-scorecard.md` | Observer (quality tracking) |
