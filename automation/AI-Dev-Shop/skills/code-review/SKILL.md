---
name: code-review
version: 1.1.1
last_updated: 2026-04-26
description: Use when reviewing code for spec alignment, architecture violations, test quality, security surface, and non-behavioral improvement opportunities.
---

# Skill: Code Review

Tests answer "does this work?" Code review answers "is this the right change, done the right way, safe to live in the codebase long-term?" These are different questions. Passing tests are necessary but not sufficient.

Code review is the last quality gate before human sign-off. It catches what tests cannot: wrong problem solved, architectural violations, non-functional issues, and code that is correct but unmaintainable.

## What Tests Cannot Catch

This is the core value of code review. Never use it to check things the test suite already checks.

**Wrong problem solved**: Tests can pass while implementing the wrong requirement. Code review validates that what was built is what was asked for — by checking against the spec, not just the tests.

**Architectural violations**: An agent will take the path of least resistance. Putting business logic in a route handler is easier than creating a service. Code review enforces the architecture the Architect Agent defined.

**Non-functional issues**: Performance characteristics, memory leaks, missing indexes, unbounded list fetches, synchronous operations that should be async. These often don't show up in unit tests but will show up in production.

**Security surface changes**: New endpoints, new data flows, new external calls. Code review flags these for the Security Agent to review.

**"Bad but passing" code**: Code that is too complex, inconsistent with project conventions, or hard for the next agent/developer to understand. Correct code is not automatically good code.

**Missing observability**: No logging on error paths, no metrics on critical operations, no correlation IDs on distributed calls.

## Review Dimensions

Evaluate every change across all dimensions. Do not skip any.

### 1. Spec Alignment
- Does the implementation match the requirements in the active spec?
- Does every acceptance criterion have a corresponding implementation path?
- Are invariants enforced in code (not just in tests)?
- Are edge cases handled as the spec defines?
- Is any out-of-scope behavior implemented? (Scope creep)

### 2. Architecture Adherence
- Does code respect the architecture boundaries defined by the Architect Agent?
- Are dependencies pointing in the right direction (no core logic importing from infrastructure)?
- Are modules only accessed through their public API?
- Are repository/port interfaces used for external dependencies?
- Does folder structure match the chosen architecture pattern?

### 3. Test Quality
- Do tests cover the spec requirements, not just implementation details?
- Is the test certification record present and current (spec hash matches)?
- Is the Coordinator-supplied verification packet present and PASS for the same
  spec hash, with the packet path and hash provided in the Coordinator handoff?
- Does the Coordinator-supplied packet show certified test-file hash
  verification and executed test count at or above the expected count from the
  certification record?
- Did required suites and coverage gates pass using machine-readable artifacts,
  or are skipped suites explicitly marked N/A by `tasks.md` constraints?
- Are there tests for the unhappy paths defined in the spec?
- Do P1 acceptance criteria and invariants have inspectable assertion coverage?
  For each P1 AC, at least one assertion should compare values that trace to the
  AC actor/action/outcome. For each invariant, at least one assertion should
  prove the invariant across the relevant state transition or input class. Mock
  call counts, type presence, generic truthiness, and exception-only assertions
  without observable result or error-content checks do not satisfy this coverage.
- Are any tests asserting implementation internals instead of behavior?

### 4. Code Quality and Maintainability
- Is each function doing one thing?
- Are names accurate and domain-aligned?
- Is there duplication that should be extracted?
- Is the complexity justified by the problem?
- Are non-trivial complexity-sensitive paths explained when the cost or tradeoff is not obvious from the code?
- Are hidden mutation, hidden dependencies, or boolean flag parameters making the code harder to reason about than necessary?
- Will the next agent be able to understand this without reading git history?

### 5. Security Surface
- Does this change introduce new endpoints, data flows, or external calls?
- Is user input validated at the boundary?
- Are there new authorization checks required?
- Are secrets handled correctly?
- Flag for Security Agent if any of these apply.

### 6. Non-Functional Characteristics
- Are there unbounded queries (SELECT * with no LIMIT on a growing table)?
- Is there per-item I/O or query fan-out hidden inside loops or collection transforms?
- Are expensive operations cached where appropriate?
- Are external calls timeout-protected?
- Are error paths logged with enough context to diagnose production failures?
- Are there missing database indexes for new query patterns?

### 7. Function Quality Assessment
- Did every new or materially changed logic-bearing function receive the required assessment from `function-quality-assessment`?
- Are `@overallScore`, complexity, optional tradeoffs, and severity-graded findings present where required?
- Are scores plausible, or did the implementation inflate scores to avoid a blocking route?
- Did Programmer include the compact function-quality handoff table?
- If every assessed unit is `100/100` in a non-trivial change, did Programmer document a score skepticism pass?
- Did tiny helpers get over-documented while meaningful helpers were under-assessed?
- For rule, validation, batch, reducer, or cross-record workflows, is there at least one adversarial aggregate/cross-item test or direct probe?
- Did the Programmer attempt a local fix cycle for scores in the `80-89` debt band?
- Are Critical findings or scores below 80 classified as Required?
- Does the review report include the Function Quality Assessment summary?

## Finding Classification

Every finding must be classified. This determines whether it blocks progression.

**Required**: Must be fixed before this work can proceed. Spec misalignment, architecture violations, security surface changes, correctness issues.

**Recommended**: Should be fixed but does not block. Code quality, naming, duplication, minor complexity debt. Route to Refactor Agent.

**Optional**: Nice to have. Style preferences, minor readability. Log in project notes if worth tracking.

Never mix required and optional findings in the same severity level. The Programmer Agent must know unambiguously what blocks progression.

## Function Quality Assessment Report Section

Every retained code review report must include:

```text
## Function Quality Assessment

- Status: PASS | DEBT | BLOCKED
- Functions assessed: <count>
- Lowest score: <score or n/a>
- Critical findings: <count>
- High findings: <count>
- Missing assessments: <count>
- Missing handoff-table evidence: <yes/no>
- Missing score-skepticism evidence: <yes/no/n/a>
- Missing adversarial aggregate/cross-item evidence: <yes/no/n/a>
- Required fixes: <summary or none>
- Recommended refactors: <summary or none>
- Suggested Coordinator classification: IMPLEMENTATION_FIX_REQUIRED | TDD_RECERTIFICATION_REQUIRED | TEST_EVIDENCE_INVALID | COVERAGE_TRIAGE_REQUIRED | SPEC_REVISION_REVIEW_REQUIRED | REFACTOR_RECOMMENDED | SECURITY_REVIEW_REQUIRED | ARCHITECTURE_REVIEW_REQUIRED | HUMAN_REVIEW_REQUIRED | NONE
```

Use `<AI_DEV_SHOP_ROOT>/skills/function-quality-assessment/SKILL.md` for the
thresholds. Missing required assessments, Critical findings, and scores below 80
are Required findings. Scores in the `80-89` debt band are Recommended only when
the Programmer already attempted one local fix cycle and the remaining debt is
documented. The local fix cycle must be evidenced by the diff, progress ledger,
or handoff table. A claim without changed structure, or a comments/rename-only
change, is treated as missing debt-band evidence and becomes a Required finding.
Missing function-quality handoff tables, missing score skepticism passes for
all-100 non-trivial changes, and missing adversarial aggregate/cross-item tests
for rule or batch workflows are Required when they hide correctness, coverage,
scale, or review-routing risk. Pure documentation noise from over-scoring tiny
helpers is Recommended unless it obscures a Required finding.

## Finding Report Format

```
ID:          CR-001
Severity:    Required
Dimension:   Architecture Adherence
File:        src/routes/invoices.ts:89

Finding:
Invoice total calculation logic is implemented directly in the route handler.
This violates the Clean Architecture boundary — business logic must live in the
service layer, not in HTTP handlers.

Evidence:
The Software Architect ADR-002 defines: "All business logic lives in service classes.
Route handlers are responsible only for parsing input, calling services,
and formatting output."

Impact:
This logic will be duplicated if invoice totals are needed in another context
(e.g., a background job). Tests for the route handler are tightly coupled to
HTTP concerns, making the business logic harder to test in isolation.

Required Action:
Move calculation to InvoiceService.calculateTotal(). Route handler calls
the service method and returns the result.

Suggested Next Route:
Programmer Agent to move logic. TestRunner to verify tests remain green.
```

## Interaction with Other Agents

**Receives from**: Coordinator, after Programmer Agent completes implementation
and the Coordinator supplies current verification evidence for the active spec
hash. If the Coordinator explicitly requests advisory-only review without that
evidence, state that limitation and do not present the result as ship-ready.

**Calls**: None directly. Code Review reports findings to Coordinator.
Coordinator decides whether to dispatch Programmer, TDD, Refactor, Security,
Software Architect, or Spec.

**Routes to Coordinator**:
- Required implementation findings → Coordinator, classified as `IMPLEMENTATION_FIX_REQUIRED`
- Required test-quality, stale certification, semantic assertion, test hash, or
  missing required coverage evidence findings → Coordinator, classified as
  `TDD_RECERTIFICATION_REQUIRED` or `TEST_EVIDENCE_INVALID`
- Architecture violations → Coordinator, classified as `ARCHITECTURE_REVIEW_REQUIRED`
- Security surface changes → Coordinator, classified as `SECURITY_REVIEW_REQUIRED`
- Spec misalignment → Coordinator, classified as `SPEC_REVISION_REVIEW_REQUIRED`

**Outputs**: Findings ordered by severity with file-level references, required vs recommended distinction, and Coordinator classification for each finding.

## Review Anti-Patterns

**Rubber stamping**: Approving without reviewing each dimension. The value of code review is proportional to the rigor of the review.

**Style nitpicking as blockers**: Personal style preferences are not Required findings. If the code is readable and consistent with project conventions, style differences are at most Optional.

**Reviewing without reading the spec**: Code review without the spec is just checking that the code looks reasonable, not that it does what it was supposed to do.

**Ignoring non-functional characteristics**: Correctness is necessary. So is not fetching 10,000 rows into memory on every request.

**Conflating review with refactor**: Code review identifies problems and routes them. It does not implement fixes. Fixes go back to Programmer or Refactor Agent via Coordinator.

## References

Load `references/review-discipline.md` when:
- Sizing a change or deciding whether to split it
- Writing or structuring review feedback (honesty rules, sycophancy red flags)
- Adding a new dependency (dependency discipline checklist)
- Setting up a review process for a team or PR template
- Reviewing a large or high-risk change that warrants multi-model review
