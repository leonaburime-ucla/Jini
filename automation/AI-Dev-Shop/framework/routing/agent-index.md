# Agent Index

Full operating procedure for each agent lives in its `skills.md`. Use this file as the roster and persona-entrypoint map.

| Agent | Role | File |
|---|---|---|
| VibeCoder (optional) | Fast exploratory prototyping — optional on-ramp before the structured pipeline | `agents/vibecoder/skills.md` |
| System Design (optional, pre-spec) | Macro-level system planning and spec decomposition before feature specs | `agents/system-design/skills.md` |
| Coordinator | Pipeline orchestration, routing, convergence, human escalation | `agents/coordinator/skills.md` |
| Skills Librarian (optional) | Centralized external skill discovery, audit, and canonical merge governance | `agents/skills-librarian/skills.md` |
| Spec | Converts intent into versioned, testable provider-defined planning artifacts | `agents/spec/skills.md` |
| Software Architect | Selects patterns, defines boundaries, produces ADR | `agents/software-architect/skills.md` |
| TDD | Writes certified test suite before implementation | `agents/tdd/skills.md` |
| Programmer | Implements code to satisfy certified tests | `agents/programmer/skills.md` |
| Web Design (optional) | Defines premium website direction, product UI/UX, visual polish, conversion flow, and implementation-ready design specs | `agents/web-design/skills.md` |
| Search Visibility (optional) | Audits public surfaces for search, AI answer, and chatbot discoverability; produces metrics and routes fixes | `agents/search-visibility/skills.md` |
| QA/E2E | Writes browser-level tests that validate user journeys and frontend ACs | `agents/qa-e2e/skills.md` |
| TestRunner | Executes test suite, reports pass/fail evidence | `agents/testrunner/skills.md` |
| Code Review | Reviews spec alignment, architecture, test quality, security surface | `agents/code-review/skills.md` |
| Refactor | Proposes non-behavioral structural improvements post-review | `agents/refactor/skills.md` |
| Security | Analyzes threat surface, classifies findings, blocks Critical/High | `agents/security/skills.md` |
| DevOps | Produces Dockerfiles, CI/CD configs, IaC, and deployment runbooks | `agents/devops/skills.md` |
| Docs | Publishes OpenAPI specs, writes user guides, and produces release notes | `agents/docs/skills.md` |
| Observer (optional) | Watches pipeline, detects patterns, produces system improvements | `agents/observer/skills.md` |
| Red-Team | Adversarially probes approved specs before Software Architect dispatch | `agents/red-team/skills.md` |
| CodeBase Analyzer | Analyzes existing codebase before pipeline begins | `agents/codebase-analyzer/skills.md` |
| Database | Owns schema design, migrations, query patterns | `agents/database/skills.md` |
| Supabase Sub-Agent | Supabase-specific implementation under Database Agent | `agents/database/supabase/skills.md` |

## Reserved Pipeline Agent Names

The following names are the canonical reserved agent names for response prefixes, delegated helper identity claims, and pipeline-stage labeling:

- `Coordinator`
- `CodeBase Analyzer`
- `System Design`
- `VibeCoder`
- `Skills Librarian`
- `Spec`
- `Red-Team`
- `Software Architect`
- `Database`
- `Supabase Sub-Agent`
- `TDD`
- `Programmer`
- `Web Design`
- `Search Visibility`
- `QA/E2E`
- `TestRunner`
- `Code Review`
- `Refactor`
- `Security`
- `DevOps`
- `Docs`
- `Observer`

A delegated helper may use one of those names only after it has read the matching persona file and confirmed that load in its first reply. Otherwise it must use a generic helper label. The detailed bootstrap and validity rules live in `<AI_DEV_SHOP_ROOT>/skills/coordination/SKILL.md`.

Use `<AI_DEV_SHOP_ROOT>/framework/routing/skills-registry.md` when you need shared-skill ownership and reuse mapping rather than the persona roster.
