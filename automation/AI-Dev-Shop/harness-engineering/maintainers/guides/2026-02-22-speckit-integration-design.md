# Design: spec-kit Integration into AI-Dev-Shop

> Historical note: This guide predates the sibling workspace split. Live project-owned files now live under `<ADS_MEMORY_ROOT>/`, and `project-knowledge-template/` inside ADS is the repo-local template. Interpret any project-state path below with that split in mind.

- Date: 2026-02-22
- Status: APPROVED
- Source: github/spec-kit (https://github.com/github/spec-kit)

## Overview

Integrate four concepts from GitHub's spec-kit toolkit into AI-Dev-Shop:

1. **Constitution framework** — a governance document that gates the Architect before writing any ADR
2. **Richer templates** — spec-template enhanced, ADR augmented, two new templates (tasks, research)
3. **Slash commands** — `/spec`, `/plan`, `/tasks`, `/implement`, `/code-review` in CLAUDE.md and AGENTS.md
4. **Research artifact** — Architect produces `research.md` before the ADR when tech choices are involved

## Updated Pipeline

```
/spec  → Spec Agent      (constitution check → [NEEDS CLARIFICATION] → spec + hash)
                          ↓ human approves
/plan  → Architect       (research.md → constitution check → ADR + complexity justification)
                          ↓ human approves
/tasks → Coordinator     (generates tasks.md with [P] parallelization markers from ADR)
                          ↓
/implement → TDD → Programmer → TestRunner → Code Review → Security → Done
```

## Files to Create (4)

### 1. `framework/templates/bootstrap/constitution-template.md`
A fill-in template for establishing project-level engineering governance. Contains:
- Numbered articles (Library-First, Test-First, Simplicity Gate, Anti-Abstraction Gate, Integration-First Testing, Security-by-Default, Spec Integrity, Observability)
- Each article: name, principle statement, what it prohibits, how to justify an exception
- Amendment process: how to change the constitution with documented rationale
- Version + amendment date tracking

### 2. `project-knowledge-template/governance/constitution.md`
The default project constitution instance (pre-filled with sensible defaults, customized per project). This is the file agents actually read. Articles:
- **Article I — Library-First**: Use existing libraries before writing custom implementations. Justify any custom code that replaces a well-maintained library.
- **Article II — Test-First**: No implementation without certified tests. TDD Agent certifies before Programmer starts.
- **Article III — Simplicity Gate**: Reject unnecessary complexity. Every abstraction must solve a present problem.
- **Article IV — Anti-Abstraction Gate**: No speculative abstractions. Three similar items before extracting a pattern.
- **Article V — Integration-First Testing**: Test at the integration boundary first. Unit tests supplement; they do not replace.
- **Article VI — Security-by-Default**: Security Agent required before any merge. Critical/High findings block shipping.
- **Article VII — Spec Integrity**: Specs are ground truth. Code that contradicts the spec is wrong; specs that contradict intent are revised.
- **Article VIII — Observability**: All production paths emit structured, queryable signals.

### 3. `framework/templates/tasks-template.md`
Phased task list derived from the ADR. Structure:
- **Phase 0 — Setup**: Project initialization, tooling, directory structure
- **Phase 1 — Foundational**: Core infrastructure marked as CRITICAL (blocks all stories)
- **Phase 2+ — User Stories**: One phase per story, independently completable and testable
- **Phase N — Polish**: Cross-cutting improvements, documentation
- **[P] markers**: Tasks that can run in parallel (different files, no shared mutable state)
- **Independent test checkpoint** per story: write-and-fail before implementing

### 4. `framework/templates/research-template.md`
Pre-ADR research artifact produced by the Architect when the spec involves library or technology choices. Sections:
- Library candidates (name, version, license, weekly downloads, last commit)
- Compatibility analysis (does it work with the project's language version, platform, existing deps?)
- Performance benchmarking (measured or referenced, not assumed)
- Security implications (known CVEs, audit status, dependency chain)
- Decision: selected option with rationale mapped to spec requirements

## Files to Modify (8)

### 5. `framework/spec-providers/speckit/templates/spec-system/feature.spec.md`
Add:
- **Feature number field**: `FEAT-<auto-incremented 001, 002, ...>` in the header metadata
- **[NEEDS CLARIFICATION] instruction**: Inline marker for any requirement with unresolved ambiguity; Spec Agent must resolve all before handing off to Architect
- **P1/P2/P3 priority** on Acceptance Criteria (P1 = must-have, P2 = should-have, P3 = nice-to-have)
- **Constitution Compliance section**: one-line per article — COMPLIES / EXCEPTION (with justification) / N/A

### 6. `framework/templates/adr-template.md`
Add:
- **Constitution Check gate** at top: must pass before writing the ADR body; lists each article and compliance status
- **Complexity Justification table**: documents any architectural decision that violates a constitution article, with necessity rationale and simpler alternatives that were considered and rejected
- **Research Summary** reference field: path to `research.md` if produced; N/A if no library/tech choices involved

### 7. `agents/spec/skills.md`
Add to Workflow:
- Step 0: Read `<AI_DEV_SHOP_ROOT>/project-knowledge-template/governance/constitution.md`. For any requirement that conflicts with a constitution article, inline a `[NEEDS CLARIFICATION]` marker with the specific article and what decision is needed.
- Step: Before handing off, confirm zero unresolved `[NEEDS CLARIFICATION]` markers remain (all resolved or escalated to human).

### 8. `agents/software-architect/skills.md`
Add to Workflow:
- Step 0 (new): If spec involves library or technology choices, produce `research.md` using `<AI_DEV_SHOP_ROOT>/framework/templates/research-template.md` before writing the ADR.
- Step 1 (new, before current Step 1): Run Constitution Check — for each article in `<AI_DEV_SHOP_ROOT>/project-knowledge-template/governance/constitution.md`, verify the proposed architecture complies. Any violation goes into the Complexity Justification table in the ADR, or triggers a revised architecture.

### 9. `agents/coordinator/skills.md`
Add:
- Inject `<AI_DEV_SHOP_ROOT>/project-knowledge-template/governance/constitution.md` in Spec Agent and Architect Agent dispatches
- New escalation trigger: constitution violation without justification (same severity as spec hash mismatch)
- After ADR approval: generate `tasks.md` using `<AI_DEV_SHOP_ROOT>/framework/templates/tasks-template.md` based on the ADR's parallel delivery plan

### 10. `framework/workflows/multi-agent-pipeline.md`
Add:
- `constitution.md` to Spec Agent and Architect Agent context injection tables
- `research.md` as a new optional Architect output (required when spec has library/tech choices)
- `tasks.md` generation step between ADR approval and TDD dispatch
- Constitution Check as a documented sub-step in the Architect stage

### 11. `CLAUDE.md`
Add slash commands section:
- `/spec [description]` — spawn Spec Agent with the given product description
- `/plan` — spawn Architect Agent against the latest approved spec
- `/tasks` — generate tasks.md from the latest approved ADR
- `/implement` — spawn TDD → Programmer sequence for the current tasks
- `/code-review` — spawn Code Review + Security against current diff

### 12. `AGENTS.md`
Add:
- Slash commands reference table (same 5 commands, with what each triggers)
- Updated pipeline diagram showing research.md and tasks.md steps
- Constitution reference in Shared Rules section

## Constitution Check Mechanic

The Architect runs this before writing any ADR:

> For each article in `constitution.md`: does the proposed architecture comply?
> - COMPLIES → continue
> - EXCEPTION → log in Complexity Justification table with: (a) which article, (b) why simpler alternatives were insufficient, (c) what the complexity buys
> - VIOLATION (unjustified) → revise architecture or escalate to human

The Coordinator treats an unjustified constitution violation as a blocking escalation — same as a spec hash mismatch.

## What Is Not Changed

- Pipeline stage order (Spec → Architect → TDD → Programmer → TestRunner → Code Review → Security)
- Handoff contract format
- Spec hash / versioning mechanic
- All 11 agent roles and their guardrails
- Skills library (no changes to any SKILL.md files)
- Human checkpoint structure (spec approval, ADR sign-off, convergence escalation, security sign-off)
