# Golden Sample: CSV Export for Invoice List

This folder contains a complete example of a feature run through the AI Dev Shop (speckit) pipeline. It serves two purposes:

1. **Onboarding** — shows what the pipeline produces at every stage, with real content rather than placeholder instructions
2. **Framework QA** — if the framework changes, this example should still be produceable by the agents using the current templates and skills

---

## Full Pipeline (speckit)

```
[CodeBase Analyzer] → [Migration Plan] → Spec → [Red-Team] → Software Architect (research → constitution check → ADR) → tasks.md → TDD → Programmer → TestRunner → Code Review (+Refactor) → Security → Done
```

`[...]` stages are optional. Observer runs alongside the pipeline throughout (not shown inline).

---

## Coverage in This Folder

| Pipeline Stage | Agent | Artifact | Included Here |
|---------------|-------|----------|--------------|
| Spec | Spec Agent | `feature.spec.md` + package metadata | ✅ `feature.spec.md`, `spec-manifest.md` |
| Red-Team | Red-Team Agent | findings report | ✅ `red-team-findings.md` |
| Software Architect | Software Architect Agent | research summary + `adr.md` | ✅ `adr.md` (research embedded) |
| Task generation | Coordinator | `tasks.md` | ✅ `tasks.md` |
| TDD | TDD Agent | `test-certification.md` | ✅ `test-certification.md` |
| Programmer | Programmer Agent | implementation files | ❌ codebase-specific |
| TestRunner | TestRunner Agent | pass/fail report | ❌ codebase-specific |
| Code Review | Code Review Agent | findings report | ❌ codebase-specific |
| Refactor | Refactor Agent | proposals | ❌ codebase-specific |
| Security | Security Agent | threat report | ❌ codebase-specific |
| CodeBase Analyzer | CodeBase Analyzer | `ANALYSIS-*.md` | ❌ pre-pipeline, codebase-specific |
| Observer | Observer Agent | memory-store entries, scorecard | ❌ per-project, ongoing |

The pre-implementation artifacts (Spec through TDD certification) are the framework's primary value — they are what agents produce consistently regardless of target stack. Post-implementation stages depend on what the Programmer actually wrote, so they cannot be usefully templated here.

This sample is intentionally lightweight. It shows the main handoff chain and current naming, but it does not attempt to include every conditional `.spec.md` file or a fully expanded `spec-dod.md` example.

---

## What This Example Covers

Feature: a user can export the currently visible invoice list as a CSV file.

Deliberately small and realistic — small enough to understand end-to-end, large enough that the spec decisions, Red-Team findings, architecture tradeoffs, and test cases are non-trivial.

---

## How to Use This as a Reference

**When writing a spec:** compare against `feature.spec.md` and `spec-manifest.md`. Every requirement should be observable and testable. Zero `[NEEDS CLARIFICATION]` markers at dispatch. Constitution Compliance table filled in.

**When reading Red-Team output:** compare against `red-team-findings.md`. Findings are BLOCKING, ADVISORY, or CONSTITUTION_FLAG. Only BLOCKING findings halt Software Architect dispatch.

**When writing an ADR:** compare against `adr.md`. Constitution Check table must come first, before any architecture content. Complexity Justification table must be present even if empty. Research summary is required when technology choices exist.

**When generating tasks:** compare against `tasks.md`. Tasks are phased by AC priority. `[P]` marks independent tasks. Checkpoints appear after Phase 1 and each story.

**When certifying tests:** compare against `test-certification.md`. Every AC, invariant, and edge case in the spec must have a corresponding test. The spec hash in the certification must match exactly.

---

## Known Simplifications

- Uses a fictional invoicing application — adapt field names and domain to your project
- ADR assumes TypeScript React frontend — adapt library choices to your stack
- Test certification uses Jest + React Testing Library — adapt to your test framework
