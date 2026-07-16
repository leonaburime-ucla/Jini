# spec-kit Integration Implementation Plan

> Historical note: This guide predates the sibling workspace split. Live project-owned files now live under `<ADS_MEMORY_ROOT>/`, and `project-knowledge-template/` inside ADS is the repo-local template. Interpret any project-state path below with that split in mind.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate four concepts from GitHub's spec-kit into AI-Dev-Shop: constitution framework, richer templates, slash commands, and a research artifact.

**Architecture:** All changes are to markdown files — no code. The constitution becomes a hard gate in the Architect agent's workflow. Four new files are created; eight existing files are modified. No existing pipeline stages, handoff contracts, or skills are removed.

**Tech Stack:** Markdown, file edits only. All paths are relative to `<AI_DEV_SHOP_ROOT>/`.

**Reference files:**
- Design doc: `harness-engineering/maintainers/guides/2026-02-22-speckit-integration-design.md`
- Source inspiration: `<spec-kit>/framework/templates/` (GitHub's spec-kit repo)

---

## Task 1: Create `framework/templates/bootstrap/constitution-template.md`

**Files:**
- Create: `framework/templates/bootstrap/constitution-template.md`

**Step 1: Create the file**

```markdown
# [PROJECT_NAME] Constitution

- Version: 1.0.0
- Ratified: [ISO-8601 date]
- Last Amended: [ISO-8601 date]

## How to Use This Template

Copy this file to `project-knowledge-template/governance/constitution.md`. Fill in each article with your project's specific rules. Delete placeholder comments. The Spec Agent and Architect Agent read this file on every run — every article they cannot comply with must be either justified in the ADR's Complexity Justification table or escalated to the human.

---

## Article I — [PRINCIPLE NAME]
<!-- Example: Library-First -->

[Describe the principle in 1-3 sentences. Be specific enough that an agent can check compliance with a yes/no answer.]

**Complies if:** [Observable condition — e.g., "No custom implementation exists where a maintained library with >10k weekly downloads solves the same problem"]

**Exception process:** [What justification is required — e.g., "Document in Complexity Justification table: library evaluated, version, why it was rejected"]

---

## Article II — [PRINCIPLE NAME]
<!-- Example: Test-First (NON-NEGOTIABLE) -->

[Principle statement]

**Complies if:** [Observable condition]

**Exception process:** [What justification is required — or "No exceptions"]

---

## Article III — [PRINCIPLE NAME]
<!-- Example: Simplicity Gate -->

[Principle statement]

**Complies if:** [Observable condition]

**Exception process:** [What justification is required]

---

## Article IV — [PRINCIPLE NAME]
<!-- Example: Anti-Abstraction Gate -->

[Principle statement]

**Complies if:** [Observable condition]

**Exception process:** [What justification is required]

---

## Article V — [PRINCIPLE NAME]
<!-- Example: Integration-First Testing -->

[Principle statement]

**Complies if:** [Observable condition]

**Exception process:** [What justification is required]

---

## Article VI — [PRINCIPLE NAME]
<!-- Example: Security-by-Default -->

[Principle statement]

**Complies if:** [Observable condition]

**Exception process:** [What justification is required]

---

## Article VII — [PRINCIPLE NAME]
<!-- Example: Spec Integrity -->

[Principle statement]

**Complies if:** [Observable condition]

**Exception process:** [What justification is required]

---

## Article VIII — [PRINCIPLE NAME]
<!-- Example: Observability -->

[Principle statement]

**Complies if:** [Observable condition]

**Exception process:** [What justification is required]

---

## Governance

- This constitution supersedes all other project practices.
- Amendments require: written rationale, human approval, and a migration plan for in-flight work.
- All ADRs must include a Constitution Check section.
- Unjustified violations are a blocking escalation — the Coordinator treats them the same as a spec hash mismatch.

## Amendment Log

| Version | Date | Article | Change | Rationale |
|---------|------|---------|--------|-----------|
| 1.0.0 | [date] | All | Initial ratification | — |
```

**Step 2: Verify**

Open `framework/templates/bootstrap/constitution-template.md` and confirm:
- All 8 Article placeholders are present
- Governance section includes the blocking escalation rule
- Amendment log table is present

**Step 3: Commit**

```bash
git add framework/templates/bootstrap/constitution-template.md
git commit -m "feat: add constitution-template.md"
```

---

## Task 2: Create `project-knowledge-template/governance/constitution.md`

**Files:**
- Create: `project-knowledge-template/governance/constitution.md`

This is the default project instance — pre-filled with sensible defaults. Users customize it per project. Agents read this file (not the template).

**Step 1: Create the file**

```markdown
# Project Constitution

- Version: 1.0.0
- Ratified: [fill in when you start your project]
- Last Amended: [fill in when you start your project]

This constitution governs all development on this project. The Spec Agent checks compliance before finalizing any spec. The Architect Agent checks compliance before writing any ADR. Unjustified violations are a blocking escalation.

---

## Article I — Library-First

Use existing, well-maintained libraries before writing custom implementations. Every custom implementation that replaces a library must justify why no suitable library exists.

**Complies if:** No custom code duplicates functionality available in a library with active maintenance (commit in last 12 months) and reasonable adoption.

**Exception process:** Document in ADR Complexity Justification table: library name, version evaluated, specific reason it was rejected (license, performance, missing feature, security issue).

---

## Article II — Test-First (NON-NEGOTIABLE)

No implementation code is written before the TDD Agent has certified tests against the approved spec. Tests must fail before the Programmer Agent starts.

**Complies if:** TDD Agent has produced a test certification document with spec hash match before any Programmer dispatch.

**Exception process:** None. This article has no exceptions.

---

## Article III — Simplicity Gate

Reject complexity that does not solve a present, documented problem. Every abstraction must have a concrete use case in the current spec.

**Complies if:** Every module, interface, and pattern introduced is directly traceable to a requirement in the active spec.

**Exception process:** Document in Complexity Justification table: which requirement drives the complexity, what the simpler alternative was, and why it was insufficient.

---

## Article IV — Anti-Abstraction Gate

Do not extract abstractions speculatively. Three concrete, similar implementations must exist before a shared abstraction is justified.

**Complies if:** No shared abstractions are introduced for fewer than three concrete uses.

**Exception process:** Document in Complexity Justification table with evidence of three concrete uses or a strong architectural reason (e.g., defined contract boundary).

---

## Article V — Integration-First Testing

Test at the integration boundary first. Unit tests supplement integration tests; they do not replace them. Do not unit-test implementation details.

**Complies if:** Every acceptance criterion has at least one integration-level test. Unit tests exist only for pure logic with no I/O.

**Exception process:** Document why integration testing is not feasible for specific ACs (e.g., third-party API with no sandbox).

---

## Article VI — Security-by-Default

Security Agent review is required before any merge to main. Critical and High findings block shipping. Medium and Low findings are logged and tracked.

**Complies if:** Security Agent has reviewed the full diff and produced a findings report. No Critical/High findings are unresolved.

**Exception process:** Human sign-off required for any Critical/High finding that ships. Must document: finding, mitigation, accepted risk, and owner.

---

## Article VII — Spec Integrity

Specs are ground truth. Code that contradicts the spec is wrong. Specs that contradict intent are revised through the Spec Agent — not patched ad-hoc by the Programmer.

**Complies if:** Every agent output references the active spec version and hash. No agent modifies behavior outside its spec scope.

**Exception process:** If a spec is discovered to be wrong mid-implementation, stop. Route to Spec Agent for revision. Do not work around a wrong spec.

---

## Article VIII — Observability

All production code paths emit structured, queryable signals. No silent failures. Errors are logged with enough context to reproduce without a debugger.

**Complies if:** All error paths produce a structured log entry. All external I/O (API calls, DB writes, file operations) is instrumented.

**Exception process:** Document in ADR or Code Review finding why a path cannot be instrumented (e.g., third-party SDK limitation).

---

## Governance

- This constitution supersedes all other project practices.
- Amendments require: written rationale, human approval, and a migration plan for in-flight work.
- All ADRs must include a Constitution Check section before the architecture body.
- Unjustified violations are a blocking escalation — the Coordinator treats them the same as a spec hash mismatch.

## Amendment Log

| Version | Date | Article | Change | Rationale |
|---------|------|---------|--------|-----------|
| 1.0.0 | — | All | Initial ratification | Default constitution for new projects |
```

**Step 2: Verify**

Open `project-knowledge-template/governance/constitution.md` and confirm:
- All 8 articles present with Complies if + Exception process
- Governance section includes blocking escalation rule
- Amendment log present

**Step 3: Commit**

```bash
git add project-knowledge-template/governance/constitution.md
git commit -m "feat: add default project constitution"
```

---

## Task 3: Create `framework/templates/research-template.md`

**Files:**
- Create: `framework/templates/research-template.md`

Produced by the Architect Agent before writing the ADR when the spec involves library or technology choices. Stored in `<AI_DEV_SHOP_ROOT>/specs/` alongside the ADR.

**Step 1: Create the file**

```markdown
# Research: <feature-name>

- Spec: SPEC-<id> v<version> (hash: <sha256>)
- Date: <ISO-8601 UTC>
- Author: Architect Agent
- ADR: ADR-<id> (links here once written)

## Trigger

This research was required because the spec involves the following library or technology choices:

- <choice 1 — e.g., "message queue library for async job processing">
- <choice 2 — e.g., "ORM vs raw SQL for persistence layer">

## Candidate Evaluation

For each candidate, document:

### Option A: <library/technology name>

- **Version evaluated**: <version>
- **License**: <license>
- **Maintenance status**: Last commit <date>, <open issues> open issues
- **Weekly downloads / adoption**: <metric>
- **Compatibility**: Works with <language version>, <platform>, existing deps? Yes / No / Partial — detail any conflicts
- **Performance**: <measured or referenced benchmark, not assumed>
- **Security**: Known CVEs: <none / list>. Last security audit: <date or unknown>. Dependency chain depth: <n>
- **Fit for spec requirements**: <maps to which FRs/ACs>

### Option B: <library/technology name>

- **Version evaluated**: <version>
- **License**: <license>
- **Maintenance status**: Last commit <date>, <open issues> open issues
- **Weekly downloads / adoption**: <metric>
- **Compatibility**: <detail>
- **Performance**: <detail>
- **Security**: <detail>
- **Fit for spec requirements**: <detail>

### Option C: Custom implementation

- **Justification for considering**: <why no library option is sufficient>
- **Estimated complexity**: <lines of code, modules, time>
- **Maintenance burden**: <ongoing cost>
- **Risk**: <what can go wrong>

## Decision

**Selected**: <Option A / B / Custom>

**Rationale** (mapped to spec requirements):
- REQ-0X → satisfied by <feature of selected option>
- REQ-0Y → satisfied by <feature of selected option>
- Constitution Article I check: <COMPLIES because X / EXCEPTION — see ADR Complexity Justification>

**Rejected options and why**:
| Option | Rejection Reason |
|--------|-----------------|
| Option B | <specific disqualifying factor> |
| Custom | <why a library is preferred per Article I> |

## Open Questions

Any unresolved questions that could affect the decision:

- <question — what additional data would resolve it — who decides>
```

**Step 2: Verify**

Open `framework/templates/research-template.md` and confirm:
- Candidate evaluation section covers version, license, maintenance, compatibility, performance, security
- Decision section maps to spec requirements
- Constitution Article I check is present in the decision

**Step 3: Commit**

```bash
git add framework/templates/research-template.md
git commit -m "feat: add research-template.md"
```

---

## Task 4: Create `framework/templates/tasks-template.md`

**Files:**
- Create: `framework/templates/tasks-template.md`

Produced by the Coordinator after ADR approval, before TDD dispatch. Uses `[P]` markers for parallelizable tasks. Stored in `<AI_DEV_SHOP_ROOT>/specs/` alongside the spec and ADR.

**Step 1: Create the file**

```markdown
# Tasks: <feature-name>

- Spec: SPEC-<id> v<version> (hash: <sha256>)
- ADR: ADR-<id>
- Date: <ISO-8601 UTC>
- Author: Coordinator

## Format

`[ID] [P?] [Story] Description`

- **[P]**: Task can run in parallel — touches different files, no shared mutable state with other [P] tasks in the same phase
- **[Story]**: Maps to a user story or acceptance criterion (e.g., AC-01, INV-01)
- Every task references exact file paths

## Phase 0 — Setup

Project initialization and tooling. No story dependencies.

- [ ] T001 [P] Create directory structure per ADR module boundaries
- [ ] T002 [P] Initialize project configuration files
- [ ] T003 [P] Configure linting, formatting, and CI hooks

---

## Phase 1 — Foundational

Core infrastructure that blocks all stories. **No story work begins until this phase is complete.**

- [ ] T004 Create base data models / entities
- [ ] T005 [P] Set up persistence layer per ADR
- [ ] T006 [P] Set up logging and error handling infrastructure
- [ ] T007 Configure environment and secrets management

**Checkpoint**: Foundation ready — story phases can now begin (in parallel if modules are independent).

---

## Phase 2 — [Story: AC-01] <story title> (P1)

**Goal**: <what this story delivers>
**Independent test**: <how to verify this story works in isolation>

- [ ] T008 [P] [AC-01] Write failing tests for <component> — tests/...
- [ ] T009 [P] [AC-01] Write failing tests for <component> — tests/...
- [ ] T010 [AC-01] Implement <model/entity> — src/...
- [ ] T011 [AC-01] Implement <service> — src/... (depends on T010)
- [ ] T012 [AC-01] Implement <interface/endpoint> — src/... (depends on T011)
- [ ] T013 [AC-01] Wire up and run tests to convergence

**Checkpoint**: AC-01 passing — story 1 independently testable and complete.

---

## Phase 3 — [Story: AC-02] <story title> (P2)

**Goal**: <what this story delivers>
**Independent test**: <how to verify this story works in isolation>

- [ ] T014 [P] [AC-02] Write failing tests for <component> — tests/...
- [ ] T015 [AC-02] Implement <model/entity> — src/...
- [ ] T016 [AC-02] Implement <service> — src/... (depends on T015)
- [ ] T017 [AC-02] Integrate with Phase 2 components (if needed)
- [ ] T018 [AC-02] Run tests to convergence

**Checkpoint**: AC-02 passing — story 2 independently testable and complete.

---

## Phase N — Polish

Cross-cutting improvements after all required stories are complete.

- [ ] TXXX [P] Documentation updates
- [ ] TXXX [P] Additional unit tests for pure logic
- [ ] TXXX Performance instrumentation
- [ ] TXXX Security hardening pass

---

## Parallelization Rules

- Tasks marked [P] in the same phase can be dispatched simultaneously by the Coordinator
- Modules must have no shared mutable state during parallel execution
- No Programmer instance writes to a file another instance reads
- If a shared utility needs changes, serialize — do not parallelize writes to shared code

## Execution Strategy

**Sequential (single agent):** Phase 0 → Phase 1 checkpoint → Phase 2 → Phase 3 → Phase N

**Parallel (multiple Programmer instances):** Phase 0 → Phase 1 checkpoint → Phase 2 + Phase 3 simultaneously (if ADR defines independent modules) → TestRunner aggregates → Phase N
```

**Step 2: Verify**

Open `framework/templates/tasks-template.md` and confirm:
- [P] marker explanation is present
- Phase 0/1/2/3/N structure present
- Checkpoint annotations after Phase 1 and each story phase
- Parallelization rules section present

**Step 3: Commit**

```bash
git add framework/templates/tasks-template.md
git commit -m "feat: add tasks-template.md with [P] parallelization markers"
```

---

## Task 5: Modify `framework/spec-providers/speckit/templates/spec-system/feature.spec.md`

**Files:**
- Modify: `framework/spec-providers/speckit/templates/spec-system/feature.spec.md`

Add: feature number (FEAT-001), `[NEEDS CLARIFICATION]` instruction, P1/P2/P3 priority on ACs, Constitution Compliance section.

**Step 1: Replace header metadata block**

Find:
```
# Spec: <feature-name>

- Spec ID: SPEC-<id>
- Version: <semver — major for scope changes, minor for clarifications>
- Last Edited: <ISO-8601 UTC>
- Content Hash: <sha256 of content below the header metadata block>
- Owner: <human>
```

Replace with:
```
# Spec: <feature-name>

- Spec ID: SPEC-<id>
- Feature: FEAT-<auto-increment from existing specs in <AI_DEV_SHOP_ROOT>/specs/ — 001, 002, 003, ...>
- Version: <semver — major for scope changes, minor for clarifications>
- Last Edited: <ISO-8601 UTC>
- Content Hash: <sha256 of content below the header metadata block>
- Owner: <human>

> **[NEEDS CLARIFICATION] usage:** Inline this marker anywhere a requirement is ambiguous or incomplete.
> Example: `The user can export results [NEEDS CLARIFICATION: CSV only, or also PDF and JSON?]`
> The Spec Agent must resolve or escalate ALL [NEEDS CLARIFICATION] markers before handing off to the Architect.
> Zero unresolved markers is a hard gate for Architect dispatch.
```

**Step 2: Add P1/P2/P3 priority to Acceptance Criteria section**

Find:
```
## Acceptance Criteria

One or more per requirement. Format: `Given / When / Then` or a plain testable statement.

- AC-01 (REQ-01): Given <precondition>, when <action>, then <observable outcome>.
- AC-02 (REQ-01): <alternate criteria for same requirement if needed>
- AC-03 (REQ-02): ...
```

Replace with:
```
## Acceptance Criteria

One or more per requirement. Format: `Given / When / Then` or a plain testable statement.
Priority: **P1** = must-have (blocks shipping), **P2** = should-have (high value), **P3** = nice-to-have (can defer).

- AC-01 (REQ-01) [P1]: Given <precondition>, when <action>, then <observable outcome>.
- AC-02 (REQ-01) [P1]: <alternate criteria for same requirement if needed>
- AC-03 (REQ-02) [P2]: ...
```

**Step 3: Add Constitution Compliance section before Agent Directives**

Find:
```
## Agent Directives (optional)
```

Insert before it:
```
## Constitution Compliance

For each article in `<AI_DEV_SHOP_ROOT>/project-knowledge-template/governance/constitution.md`, record status.
The Spec Agent completes this. The Architect verifies it.

| Article | Status | Notes |
|---------|--------|-------|
| I — Library-First | COMPLIES / EXCEPTION / N/A | |
| II — Test-First | COMPLIES / EXCEPTION / N/A | |
| III — Simplicity Gate | COMPLIES / EXCEPTION / N/A | |
| IV — Anti-Abstraction Gate | COMPLIES / EXCEPTION / N/A | |
| V — Integration-First Testing | COMPLIES / EXCEPTION / N/A | |
| VI — Security-by-Default | COMPLIES / EXCEPTION / N/A | |
| VII — Spec Integrity | COMPLIES / EXCEPTION / N/A | |
| VIII — Observability | COMPLIES / EXCEPTION / N/A | |

Any EXCEPTION requires a justification entry in the ADR's Complexity Justification table.

```

**Step 4: Verify**

Read `framework/spec-providers/speckit/templates/spec-system/feature.spec.md` and confirm all three additions are present.

**Step 5: Commit**

```bash
git add framework/spec-providers/speckit/templates/spec-system/feature.spec.md
git commit -m "feat: enhance spec-template with FEAT number, [NEEDS CLARIFICATION], P1/P2/P3, constitution compliance"
```

---

## Task 6: Modify `framework/templates/adr-template.md`

**Files:**
- Modify: `framework/templates/adr-template.md`

Add: Constitution Check gate at top, Complexity Justification table, Research Summary field.

**Step 1: Add Constitution Check gate after the header metadata**

Find:
```
## Context
```

Insert before it:
```
## Constitution Check

*Complete this section before writing any other section of this ADR. An unjustified violation is a blocking escalation.*

| Article | Status | Notes |
|---------|--------|-------|
| I — Library-First | COMPLIES / EXCEPTION / N/A | |
| II — Test-First | COMPLIES / EXCEPTION / N/A | |
| III — Simplicity Gate | COMPLIES / EXCEPTION / N/A | |
| IV — Anti-Abstraction Gate | COMPLIES / EXCEPTION / N/A | |
| V — Integration-First Testing | COMPLIES / EXCEPTION / N/A | |
| VI — Security-by-Default | COMPLIES / EXCEPTION / N/A | |
| VII — Spec Integrity | COMPLIES / EXCEPTION / N/A | |
| VIII — Observability | COMPLIES / EXCEPTION / N/A | |

Any EXCEPTION must have a row in the Complexity Justification table below.

## Research Summary

- Research artifact: `<AI_DEV_SHOP_ROOT>/specs/RESEARCH-<id>.md` / N/A (no library or technology choices in this spec)
- Key decision: <one sentence summary of what was selected and why, or N/A>

```

**Step 2: Add Complexity Justification table before Related Decisions**

Find:
```
## Related Decisions
```

Insert before it:
```
## Complexity Justification

*Fill only if Constitution Check has EXCEPTION entries. Empty table = no violations.*

| Article Violated | Why This Complexity Is Needed | Simpler Alternative Considered | Why Simpler Alternative Was Insufficient |
|-----------------|-------------------------------|-------------------------------|------------------------------------------|
| | | | |

```

**Step 3: Verify**

Read `framework/templates/adr-template.md` and confirm:
- Constitution Check table appears before Context
- Research Summary field is present
- Complexity Justification table appears before Related Decisions

**Step 4: Commit**

```bash
git add framework/templates/adr-template.md
git commit -m "feat: enhance adr-template with constitution check gate, complexity justification, research summary"
```

---

## Task 7: Modify `agents/spec/skills.md`

**Files:**
- Modify: `agents/spec/skills.md`

Add constitution check step and [NEEDS CLARIFICATION] instruction to the workflow.

**Step 1: Replace Workflow section**

Find:
```
## Workflow
1. Normalize request into clear scope and explicit non-goals.
2. Write or revise spec using the format in `<AI_DEV_SHOP_ROOT>/skills/spec-writing/SKILL.md`.
3. Assign/update metadata: Spec ID, Version, Last Edited (ISO-8601 UTC), Content Hash (sha256).
4. List ambiguities and open questions that require human decision before TDD can proceed.
5. Publish spec delta summary (what changed and why).
6. Hand off to Architect and TDD via Coordinator.
```

Replace with:
```
## Workflow
1. Normalize request into clear scope and explicit non-goals.
2. Read `<AI_DEV_SHOP_ROOT>/project-knowledge-template/governance/constitution.md`. For any requirement that conflicts with or is unclear against a constitution article, inline a `[NEEDS CLARIFICATION: Article <N> — <specific question>]` marker in the requirement text.
3. Write or revise spec using the format in `<AI_DEV_SHOP_ROOT>/skills/spec-writing/SKILL.md`. Assign FEAT number by scanning existing specs in `<AI_DEV_SHOP_ROOT>/specs/` for the next available increment.
4. Complete the Constitution Compliance table in the spec. Mark each article COMPLIES, EXCEPTION (with one-line justification), or N/A.
5. Assign/update metadata: Spec ID, FEAT number, Version, Last Edited (ISO-8601 UTC), Content Hash (sha256).
6. Verify zero unresolved `[NEEDS CLARIFICATION]` markers remain. Any unresolved marker must be listed in Open Questions with an owner and resolution target. Do not hand off with unresolved markers unless explicitly escalated to human.
7. Publish spec delta summary (what changed and why).
8. Hand off to Architect via Coordinator.
```

**Step 2: Add [NEEDS CLARIFICATION] to Guardrails**

Find:
```
## Guardrails
- Do not write implementation code
- Do not define architecture unless explicitly directed by Coordinator
- No vague qualifiers — every criterion must be observable and measurable
- Always recompute hash when content changes
```

Replace with:
```
## Guardrails
- Do not write implementation code
- Do not define architecture unless explicitly directed by Coordinator
- No vague qualifiers — every criterion must be observable and measurable
- Always recompute hash when content changes
- Never hand off with unresolved `[NEEDS CLARIFICATION]` markers — escalate to human if the ambiguity cannot be resolved from available context
- The FEAT number must be assigned before handoff — never reuse an existing FEAT number
```

**Step 3: Verify**

Read `agents/spec/skills.md` and confirm both Workflow and Guardrails sections are updated correctly.

**Step 4: Commit**

```bash
git add agents/spec/skills.md
git commit -m "feat: add constitution check and [NEEDS CLARIFICATION] to Spec Agent workflow"
```

---

## Task 8: Modify `agents/software-architect/skills.md`

**Files:**
- Modify: `agents/software-architect/skills.md`

Add Step 0 (research.md) and Step 1 (constitution check) before the existing workflow steps.

**Step 1: Replace Required Inputs section**

Find:
```
## Required Inputs
- Active spec metadata and requirements
- Non-functional constraints (scale, reliability, latency, cost)
- Existing system boundaries and dependencies
- Coordinator directive
```

Replace with:
```
## Required Inputs
- Active spec file (full content + hash) — must be human-approved
- Constitution: `<AI_DEV_SHOP_ROOT>/project-knowledge-template/governance/constitution.md`
- Non-functional constraints (scale, reliability, latency, cost)
- Existing system boundaries and dependencies (existing ADRs in `<AI_DEV_SHOP_ROOT>/specs/`)
- Coordinator directive
- Research artifact (`<AI_DEV_SHOP_ROOT>/specs/RESEARCH-<id>.md`) if produced in Step 0
```

**Step 2: Replace Workflow section**

Find:
```
## Workflow
1. Review requirements and classify system drivers (complexity, scale, coupling, release cadence) using the framework in `<AI_DEV_SHOP_ROOT>/skills/architecture-decisions/SKILL.md`.
2. Evaluate candidate patterns from the pattern catalog.
3. Select primary pattern and optional secondary patterns. Justify against system drivers.
4. Define module/service boundaries and explicit contracts.
5. Identify parallelizable slices and sequence plan.
6. Write ADR using `<AI_DEV_SHOP_ROOT>/framework/templates/adr-template.md`. Store in `<AI_DEV_SHOP_ROOT>/specs/`.
7. Publish architecture decision as a constraint for all downstream agents.
```

Replace with:
```
## Workflow
0. **Research** (conditional): If the spec involves library or technology choices (any requirement that implies selecting a library, framework, storage system, or messaging system), produce `<AI_DEV_SHOP_ROOT>/specs/RESEARCH-<spec-id>.md` using `<AI_DEV_SHOP_ROOT>/framework/templates/research-template.md` before proceeding. Skip this step only if the spec has no technology choices.
1. **Constitution Check**: Read `<AI_DEV_SHOP_ROOT>/project-knowledge-template/governance/constitution.md`. For each article, determine if the proposed architecture complies. For any violation: either (a) revise the architecture to comply, or (b) document a justified exception in the ADR's Complexity Justification table. An unjustified violation is a blocking escalation — do not proceed to Step 2.
2. Review requirements and classify system drivers (complexity, scale, coupling, release cadence) using the framework in `<AI_DEV_SHOP_ROOT>/skills/architecture-decisions/SKILL.md`.
3. Evaluate candidate patterns from the pattern catalog.
4. Select primary pattern and optional secondary patterns. Justify against system drivers.
5. Define module/service boundaries and explicit contracts.
6. Identify parallelizable slices and sequence plan. These become the basis for `tasks.md` (produced by Coordinator after ADR approval).
7. Write ADR using `<AI_DEV_SHOP_ROOT>/framework/templates/adr-template.md`. Complete the Constitution Check table and Research Summary field. Store in `<AI_DEV_SHOP_ROOT>/specs/`.
8. Publish architecture decision as a constraint for all downstream agents.
```

**Step 3: Update Output Format**

Find:
```
## Output Format
- ADR file path and metadata
- Chosen pattern(s) and rationale against system drivers
- Module/service boundaries and ownership map
- API/event contract summary
- Parallel delivery plan (which slices can be worked in parallel)
- Risks and mitigation plan
```

Replace with:
```
## Output Format
- Research artifact path (if produced) or "No research required — no technology choices in spec"
- Constitution Check result: all articles COMPLIES/EXCEPTION/N/A, with justified exceptions listed
- ADR file path and metadata
- Chosen pattern(s) and rationale against system drivers
- Module/service boundaries and ownership map
- API/event contract summary
- Parallel delivery plan (which slices can be worked in parallel — this drives tasks.md)
- Risks and mitigation plan
```

**Step 4: Verify**

Read `agents/software-architect/skills.md` and confirm Step 0 (research) and Step 1 (constitution check) are present at the top of the workflow, and the output format includes research and constitution results.

**Step 5: Commit**

```bash
git add agents/software-architect/skills.md
git commit -m "feat: add research artifact and constitution check to Architect Agent workflow"
```

---

## Task 9: Modify `agents/coordinator/skills.md`

**Files:**
- Modify: `agents/coordinator/skills.md`

Add constitution.md injection into dispatches, new escalation trigger for constitution violations, and tasks.md generation step.

**Step 1: Update Workflow — add constitution injection and tasks.md step**

Find:
```
## Workflow
1. Validate all incoming outputs reference the active spec version/hash. Reject stale references.
2. Verify each output includes the full handoff contract (input refs, output summary, risks, suggested next).
3. Build routing plan for this cycle using the decision tree in `<AI_DEV_SHOP_ROOT>/skills/coordination/SKILL.md`.
4. Dispatch to agents with explicit scope, constraints, and deliverables.
5. Apply convergence policy — advance or escalate, never loop indefinitely.
6. Publish cycle summary.
```

Replace with:
```
## Workflow
1. Validate all incoming outputs reference the active spec version/hash. Reject stale references.
2. Verify each output includes the full handoff contract (input refs, output summary, risks, suggested next).
3. Build routing plan for this cycle using the decision tree in `<AI_DEV_SHOP_ROOT>/skills/coordination/SKILL.md`.
4. Dispatch to agents with explicit scope, constraints, and deliverables. Include `<AI_DEV_SHOP_ROOT>/project-knowledge-template/governance/constitution.md` in every Spec Agent and Architect Agent dispatch.
5. After ADR is human-approved: generate `<AI_DEV_SHOP_ROOT>/specs/TASKS-<spec-id>.md` using `<AI_DEV_SHOP_ROOT>/framework/templates/tasks-template.md`. Base the phase structure and [P] markers on the ADR's parallel delivery plan. Dispatch TDD Agent only after tasks.md is produced.
6. Apply convergence policy — advance or escalate, never loop indefinitely.
7. Publish cycle summary.
```

**Step 2: Update Escalation Rules — add constitution violation**

Find:
```
## Escalation Rules
- Spec and architecture constraints directly contradict each other
- Iteration budget exhausted on any failing cluster
- Critical security finding
- Any agent operating without a valid spec hash reference
- Two agents producing conflicting guidance
```

Replace with:
```
## Escalation Rules
- Spec and architecture constraints directly contradict each other
- Iteration budget exhausted on any failing cluster
- Critical security finding
- Any agent operating without a valid spec hash reference
- Two agents producing conflicting guidance
- Constitution violation without justification in the ADR Complexity Justification table (treat as same severity as spec hash mismatch)
- Unresolved `[NEEDS CLARIFICATION]` markers in a spec presented for Architect dispatch
```

**Step 3: Verify**

Read `agents/coordinator/skills.md` and confirm:
- Step 4 mentions constitution.md injection for Spec and Architect dispatches
- Step 5 (new) covers tasks.md generation after ADR approval
- Constitution violation is in the escalation rules

**Step 4: Commit**

```bash
git add agents/coordinator/skills.md
git commit -m "feat: add constitution injection, tasks.md generation, and constitution violation escalation to Coordinator"
```

---

## Task 10: Modify `framework/workflows/multi-agent-pipeline.md`

**Files:**
- Modify: `framework/workflows/multi-agent-pipeline.md`

Add constitution.md to context injection tables, research.md as Architect output, tasks.md generation step, constitution check documentation.

**Step 1: Update pipeline diagram**

Find:
```
## Ideal Path (Greenfield)

```
Spec → Architect → TDD → Programmer → TestRunner → Code Review (+Refactor) → Security → Done
```
```

Replace with:
```
## Ideal Path (Greenfield)

```
Spec → Architect (research.md → constitution check → ADR) → tasks.md → TDD → Programmer → TestRunner → Code Review (+Refactor) → Security → Done
```
```

**Step 2: Update Spec Agent context injection**

Find:
```
### Spec Agent
- Product intent from human (verbatim)
- Relevant entries from `<AI_DEV_SHOP_ROOT>/project-knowledge-template/knowledge/project_memory.md` (domain conventions)
- Last 3 entries from `<AI_DEV_SHOP_ROOT>/project-knowledge-template/knowledge/learnings.md` (recent failure patterns)
- Existing specs in `<AI_DEV_SHOP_ROOT>/specs/` (to avoid ID collisions and detect overlap)
```

Replace with:
```
### Spec Agent
- Product intent from human (verbatim)
- `<AI_DEV_SHOP_ROOT>/project-knowledge-template/governance/constitution.md` (for constitution compliance check and [NEEDS CLARIFICATION] detection)
- Relevant entries from `<AI_DEV_SHOP_ROOT>/project-knowledge-template/knowledge/project_memory.md` (domain conventions)
- Last 3 entries from `<AI_DEV_SHOP_ROOT>/project-knowledge-template/knowledge/learnings.md` (recent failure patterns)
- Existing specs in `<AI_DEV_SHOP_ROOT>/specs/` (to avoid ID collisions, detect overlap, assign next FEAT number)
```

**Step 3: Update Architect Agent context injection**

Find:
```
### Architect Agent
- Active spec file (full content + hash)
- Current system boundaries (existing ADRs in `<AI_DEV_SHOP_ROOT>/specs/`)
- Non-functional constraints from spec
- `<AI_DEV_SHOP_ROOT>/skills/architecture-decisions/SKILL.md`
- Relevant `<AI_DEV_SHOP_ROOT>/skills/design-patterns/references/` files (Coordinator selects based on system drivers in spec)
```

Replace with:
```
### Architect Agent
- Active spec file (full content + hash) — must be human-approved, zero unresolved [NEEDS CLARIFICATION] markers
- `<AI_DEV_SHOP_ROOT>/project-knowledge-template/governance/constitution.md` (for Step 0 constitution check)
- Current system boundaries (existing ADRs in `<AI_DEV_SHOP_ROOT>/specs/`)
- Non-functional constraints from spec
- `<AI_DEV_SHOP_ROOT>/skills/architecture-decisions/SKILL.md`
- Relevant `<AI_DEV_SHOP_ROOT>/skills/design-patterns/references/` files (Coordinator selects based on system drivers in spec)

**Architect outputs (in order):**
1. `<AI_DEV_SHOP_ROOT>/specs/RESEARCH-<spec-id>.md` (if spec has technology choices) — using `<AI_DEV_SHOP_ROOT>/framework/templates/research-template.md`
2. `<AI_DEV_SHOP_ROOT>/specs/ADR-<id>.md` — using `<AI_DEV_SHOP_ROOT>/framework/templates/adr-template.md` (includes Constitution Check table and Complexity Justification)
```

**Step 4: Add tasks.md generation step between Architect and TDD**

Find:
```
### TDD Agent
- Active spec (full content + hash) — **must be human-approved**
```

Insert before it:
```
### Coordinator: tasks.md Generation (after ADR human approval, before TDD dispatch)

The Coordinator generates `<AI_DEV_SHOP_ROOT>/specs/TASKS-<spec-id>.md` using `<AI_DEV_SHOP_ROOT>/framework/templates/tasks-template.md`:
- Phases derived from the ADR's parallel delivery plan
- `[P]` markers based on the ADR's independent module boundaries
- Story phases ordered by AC priority (P1 first)
- Checkpoint annotations after Phase 1 (foundational) and after each story phase

TDD Agent is dispatched only after tasks.md is produced and reviewed.

```

**Step 5: Update Human Checkpoints table**

Find:
```
| Spec approval | Before Architect dispatch | Is this spec complete and correct? |
| Architecture sign-off | Before TDD dispatch | Is this ADR acceptable? |
```

Replace with:
```
| Spec approval | Before Architect dispatch — requires zero [NEEDS CLARIFICATION] markers | Is this spec complete and correct? |
| Architecture sign-off | Before tasks.md generation and TDD dispatch — requires clean Constitution Check | Is this ADR acceptable? Are all constitution exceptions justified? |
```

**Step 6: Verify**

Read `framework/workflows/multi-agent-pipeline.md` and confirm all five edits are present.

**Step 7: Commit**

```bash
git add framework/workflows/multi-agent-pipeline.md
git commit -m "feat: update pipeline with constitution, research.md, tasks.md generation step"
```

---

## Task 11: Modify `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

Add slash commands section.

**Step 1: Append slash commands section**

Find:
```
Full pipeline reference: `<AI_DEV_SHOP_ROOT>/framework/workflows/multi-agent-pipeline.md`
```

Replace with:
```
Full pipeline reference: `<AI_DEV_SHOP_ROOT>/framework/workflows/multi-agent-pipeline.md`

## Slash Commands

| Command | What it does |
|---------|-------------|
| `/spec [description]` | Spawn Spec Agent with the given product description. Produces a versioned spec with FEAT number, [NEEDS CLARIFICATION] markers resolved, and Constitution Compliance table. |
| `/plan` | Spawn Architect Agent against the latest human-approved spec. Produces research.md (if needed) + ADR with Constitution Check + Complexity Justification. |
| `/tasks` | Coordinator generates tasks.md from the latest human-approved ADR. Produces phased task list with [P] parallelization markers. |
| `/implement` | Dispatch TDD Agent then Programmer Agent sequence for the current tasks.md. Requires approved spec + ADR + tasks.md. |
| `/code-review` | Spawn Code Review Agent + Security Agent against the current diff. Produces Required/Recommended findings + security threat report. |

**Example flow:**
```
/spec Add CSV export to the invoice list
→ [review and approve spec]
/plan
→ [review and approve ADR]
/tasks
/implement
/code-review
```
```

**Step 2: Verify**

Read `CLAUDE.md` and confirm the slash commands table and example flow are present.

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "feat: add slash commands to CLAUDE.md"
```

---

## Task 12: Modify `AGENTS.md`

**Files:**
- Modify: `AGENTS.md`

Add slash commands table, update pipeline diagram, add constitution reference in Shared Rules.

**Step 1: Update pipeline diagram**

Find:
```
[CodeBase Analyzer] → [Migration Plan] → Spec → Architect → TDD → Programmer → TestRunner → Code Review (+Refactor) → Security → Done
```

Replace with:
```
[CodeBase Analyzer] → [Migration Plan] → Spec → Architect (research.md → constitution check → ADR) → tasks.md → TDD → Programmer → TestRunner → Code Review (+Refactor) → Security → Done
```

**Step 2: Add slash commands section after "Starting the Pipeline"**

Find:
```
## The Eleven Agents
```

Insert before it:
```
## Slash Commands

| Command | Triggers | Produces |
|---------|----------|----------|
| `/spec [description]` | Spec Agent | Versioned spec with FEAT number, [NEEDS CLARIFICATION] markers, Constitution Compliance table |
| `/plan` | Architect Agent | research.md (if needed) + ADR with Constitution Check + Complexity Justification |
| `/tasks` | Coordinator | tasks.md with [P] parallelization markers, phased by story priority |
| `/implement` | TDD Agent → Programmer Agent | Certified tests → implementation to convergence |
| `/code-review` | Code Review Agent + Security Agent | Required/Recommended findings + security threat report |

```

**Step 3: Add constitution reference to Shared Rules**

Find:
```
## Shared Rules (All Agents)

- **Specs are ground truth.** If specs are wrong, all downstream work is wrong. Confirm spec hash before every dispatch.
- **Every artifact references the active spec version and hash.** No exceptions.
- **Tests must include certification linkage.** Every test maps to a specific acceptance criterion or invariant.
- **No agent edits outside its assigned role.** The Programmer does not refactor. The Refactor Agent does not implement.
- **Handoff contract is mandatory.** Every agent output must include:
```

Replace with:
```
## Shared Rules (All Agents)

- **Specs are ground truth.** If specs are wrong, all downstream work is wrong. Confirm spec hash before every dispatch.
- **The constitution governs architecture.** Every ADR must include a Constitution Check table. An unjustified violation is a blocking escalation — same severity as a spec hash mismatch. Constitution lives at `<AI_DEV_SHOP_ROOT>/project-knowledge-template/governance/constitution.md`.
- **[NEEDS CLARIFICATION] markers block Architect dispatch.** A spec with unresolved markers may not be handed to the Architect. Resolve or escalate to human first.
- **Every artifact references the active spec version and hash.** No exceptions.
- **Tests must include certification linkage.** Every test maps to a specific acceptance criterion or invariant.
- **No agent edits outside its assigned role.** The Programmer does not refactor. The Refactor Agent does not implement.
- **Handoff contract is mandatory.** Every agent output must include:
```

**Step 4: Verify**

Read `AGENTS.md` and confirm all three additions are present.

**Step 5: Commit**

```bash
git add AGENTS.md
git commit -m "feat: add slash commands, updated pipeline, constitution rules to AGENTS.md"
```

---

## Final Verification

After all 12 tasks, verify the full set of changes:

```bash
git log --oneline -12
```

Expected: 12 commits, one per task.

Confirm new files exist:
```bash
ls "<AI_DEV_SHOP_ROOT>/framework/templates/"
ls "<AI_DEV_SHOP_ROOT>/project-knowledge-template/"
```

Expected in templates: `bootstrap/constitution-template.md`, `research-template.md`, `tasks-template.md` (alongside existing provider-owned spec templates such as `framework/spec-providers/speckit/templates/spec-system/feature.spec.md`, plus `adr-template.md` and `test-certification-template.md`)

Expected in project-knowledge-template: `constitution.md` (alongside existing `foundation.md`, `learnings.md`, `project_memory.md`, `project_notes.md`)
