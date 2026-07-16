# Feature Spec: <feature-name>

<!-- SPEC PACKAGE FILE: framework/spec-providers/speckit/templates/spec-system/feature.spec.md -->
<!-- Part of the spec-system package. See framework/spec-providers/speckit/templates/spec-system/ for all required files. -->

---

## Header Metadata

| Field | Value |
|-------|-------|
| spec_id | SPEC-<NNN> |
| version | <semver — e.g., 1.0.0; major for scope changes, minor for clarifications, patch for typo fixes> |
| status | DRAFT \| REVIEW \| APPROVED \| SUPERSEDED |
| content_hash | <sha256 from Speckit canonical hash rule — recompute on every edit> |
| feature_name | FEAT-<NNN>-<short-feature-name> |
| last_edited | <ISO-8601 UTC — e.g., 2026-02-23T14:00:00Z> |
| owner | <human name or team> |
| spec_agent | <agent ID or "Spec Agent"> |
| spec_mode | greenfield \| brownfield \| reverse_spec \| migration |

> **[NEEDS CLARIFICATION] vs Open Questions — use the right one:**
>
> **`[NEEDS CLARIFICATION]`** — inline marker for a requirement that is too ambiguous to be testable as written. Blocks Software Architect dispatch. Must be resolved before the spec advances.
> Example: `The user can export results [NEEDS CLARIFICATION: CSV only, or also PDF and JSON?]`
>
> **Open Questions** — tracked questions that do not block Software Architect dispatch. Each must have an owner and a resolution target date. Questions without both are not Open Questions — convert them to `[NEEDS CLARIFICATION]` markers.

---

## Overview

One to three sentences. What is this feature? Who uses it? What business outcome does it deliver?

> Example: "The batch invoice export feature allows finance admins to download all unpaid invoices for a billing period as a single ZIP archive. It reduces the time spent on month-end reconciliation and eliminates manual one-by-one downloads."

---

## Problem Statement

What problem are we solving and for whom? What is the current state of pain? Why does it matter now?

**Current state:** Describe what the user/system does today without this feature.

**Desired state:** Describe the outcome the user/system should reach after this feature ships.

**Why now:** What makes this the right time? (e.g., blocking a launch, compliance deadline, user churn signal, dependency just became available, technical debt reached a tipping point.) If there is no time pressure, say so — "quality-of-life improvement, no deadline."

**Success signal:** How will we know the problem is solved? (Measurable — e.g., "Finance admin can export 500 invoices in under 30 seconds, confirmed by integration test.")

---

## User Journey

Step-by-step flow from the user's perspective. This is NOT implementation — it's how the user experiences the feature from trigger to outcome.

1. **Trigger:** What causes the user to start this flow? (e.g., "User clicks 'Export' on the invoices page")
2. **Steps:** Walk through each interaction point. Number them.
3. **Outcome:** What does the user see/have when done?
4. **Alternate paths:** What happens on error, cancellation, or edge conditions from the user's view?

> Example:
> **Trigger:** Finance admin needs to reconcile unpaid invoices for the billing period.
> **Steps:**
> 1. Navigates to Invoices → Batch Actions
> 2. Selects billing period and clicks "Export All Unpaid"
> 3. System shows progress indicator with count
>
> **Outcome:** Browser downloads ZIP; toast confirms "328 invoices exported."
> **Alternate paths:** On error: toast shows "Export failed — 3 invoices could not be processed" with retry link. On cancellation: export stops, partial file is discarded, user sees "Export cancelled."

Note: This section owns the high-level user-visible flow. Deterministic ordering rules, precedence logic, and edge behavior detail belong in `behavior.spec.md`.

---

## Scope

**In scope:**
- <explicit list of what this spec covers — be specific enough that a developer knows what to build>
- <each item maps to at least one REQ-* below>

**Out of scope:**
- <explicit list of what this spec does not cover — prevents scope creep during implementation>
- <items that may be related but belong to other features or future iterations>

---

## Requirements

Numbered. Observable. Testable. No vague qualifiers ("fast", "robust", "intuitive", "seamless").
Every requirement must be independently verifiable. If a requirement cannot be tested, it is not a requirement.

- REQ-01: <requirement — written so that a test can be written directly from it>
- REQ-02: <requirement>
- REQ-03: <requirement>

<!-- Add more as needed. Numbers must not be reused, even if a requirement is removed. -->

---

## Acceptance Criteria

One or more per requirement. Every REQ-* must have at least one AC.
Format: `Given <precondition>, when <action>, then <observable, measurable outcome>.`
Priority: **P1** = must-have (blocks shipping), **P2** = should-have (high value, not blocking), **P3** = nice-to-have (can defer to next iteration).

- AC-01 (REQ-01) [P1]: Given <precondition>, when <action>, then <observable outcome>.
- AC-02 (REQ-01) [P1]: Given <alternate precondition>, when <same action>, then <different outcome>.
- AC-03 (REQ-02) [P1]: Given <precondition>, when <action>, then <observable outcome>.
- AC-04 (REQ-02) [P2]: Given <precondition>, when <action>, then <observable outcome>.
- AC-05 (REQ-03) [P2]: Given <precondition>, when <action>, then <observable outcome>.

<!-- Rules:
  - Every REQ-* has at least one AC.
  - Every AC has a [P1], [P2], or [P3] tag.
  - P1 ACs are independently testable — each can be verified without other stories complete.
  - No AC requires knowledge of the implementation to evaluate.
  - AC numbers are never reused.
-->

---

## Invariants

Conditions that must always hold regardless of input or state.
These become assertion sets in the TDD Agent's test suite.
Write them as absolute statements — not "should" but "must always" / "must never."

- INV-01: <condition that must never be violated — e.g., "An invoice total must never be negative.">
- INV-02: <condition — e.g., "A submitted batch job must always produce either a result artifact or an error record — never silence.">
- INV-03: <condition>

---

## Edge Cases

Concrete scenarios, not categories. "What happens when X?" not "Handle edge cases."
Each edge case maps to a test case. If you cannot name the scenario, it is not an edge case — it is vague scope.

- EC-01: What happens when <specific scenario — e.g., "the export batch contains zero invoices">?
  Expected behavior: <explicit description of correct system response>
- EC-02: What happens when <specific scenario — e.g., "the user triggers a second export while the first is still running">?
  Expected behavior: <explicit description>
- EC-03: What happens when <specific scenario — e.g., "the underlying storage layer returns a timeout during ZIP assembly">?
  Expected behavior: <explicit description>

---

## Dependencies

External systems, APIs, services, or internal modules this feature relies on.
For each dependency: what it provides, what happens if it is unavailable, and whether there is a fallback.

| Dependency | What It Provides | Failure Mode | Fallback |
|------------|------------------|--------------|----------|
| <system/API name> | <what this feature needs from it> | <what breaks if unavailable> | <fallback behavior or "none — blocks feature"> |

---

## Open Questions

Questions that do not block Software Architect dispatch but must be resolved before TDD begins.
Every item must have an owner and a resolution target date. Items without both are `[NEEDS CLARIFICATION]` markers, not Open Questions.

- OQ-01: <question> — Owner: <name/role> — Resolve by: <ISO-8601 date>
- OQ-02: <question> — Owner: <name/role> — Resolve by: <ISO-8601 date>

---

## Constitution Compliance

Completed by the Spec Agent. Verified by the Software Architect Agent.
Any EXCEPTION requires a justification row in the ADR's Complexity Justification table.

| Article | Status | Notes |
|---------|--------|-------|
| I — Library-First | COMPLIES / EXCEPTION / N/A | <what existing library covers this, or why a custom impl is needed> |
| II — Test-First | COMPLIES / EXCEPTION / N/A | <TDD Agent dispatched before Programmer — or why not> |
| III — Simplicity Gate | COMPLIES / EXCEPTION / N/A | <every module traces to a requirement — or document exception> |
| IV — Anti-Abstraction Gate | COMPLIES / EXCEPTION / N/A | <no speculative abstractions — or document at least 3 concrete uses> |
| V — Integration-First Testing | COMPLIES / EXCEPTION / N/A | <every AC has an integration-level test — or document exception> |
| VI — Security-by-Default | COMPLIES / EXCEPTION / N/A | <Security Agent review is required before merge — no exceptions> |
| VII — Spec Integrity | COMPLIES / EXCEPTION / N/A | <all agents reference this spec version and hash> |
| VIII — Observability | COMPLIES / EXCEPTION / N/A | <all error paths and external I/O are instrumented> |

---

## Implementation Readiness Gate

This checklist must be fully checked before the spec is handed off to the Software Architect Agent.
The Spec Agent completes this. The Coordinator verifies before routing.

- [ ] spec_id assigned and unique (verified against existing `<ADS_MEMORY_ROOT>/reports/pipeline/` folders)
- [ ] version set to correct semver
- [ ] status set to APPROVED (not DRAFT or REVIEW)
- [ ] content_hash computed using the Speckit canonical hash rule and verified by the provider-local validator
- [ ] feature_name matches the FEAT folder name exactly
- [ ] Zero `[NEEDS CLARIFICATION]` markers remain in this file
- [ ] All Open Questions have an owner and a resolution target date
- [ ] All REQ-* items are testable and contain no vague qualifiers
- [ ] All REQ-* items have at least one AC
- [ ] All AC items have a [P1], [P2], or [P3] priority tag
- [ ] All AC items follow Given/When/Then format
- [ ] All Invariants are written as absolute, falsifiable statements
- [ ] All Edge Cases have an explicit Expected Behavior
- [ ] Dependencies table is complete — no blank failure mode or fallback cells
- [ ] Constitution Compliance table complete — all 8 articles marked COMPLIES / EXCEPTION / N/A
- [ ] Scope: in-scope list present and non-empty
- [ ] Problem Statement: "Why now" field is filled (even if answer is "no deadline")
- [ ] User Journey: trigger, steps, outcome, and alternate paths are present
- [ ] Scope: out-of-scope list present and non-empty
- [ ] Full spec-system package present: all `PRESENT` files listed in spec-manifest.md exist
- [ ] behavior.spec.md complete (if feature has non-trivial ordering or precedence rules)
- [ ] traceability.spec.md complete (after implementation — or marked "pending implementation")
- [ ] spec-manifest.md complete — all 10 logical files listed with `PRESENT` or `OMITTED` and concrete reasons
- [ ] spec-dod.md filled and all items PASS or NA with concrete justification
- [ ] spec-dod.md Spec Agent sign-off row completed; Coordinator row is reserved for Coordinator Planning Preflight before `/plan`
- [ ] If `spec_mode` is `brownfield`, `reverse_spec`, or `migration`, brownfield/reverse-spec evidence paths are recorded in `spec-manifest.md`

**Gate result:** PASS / FAIL — <summary if FAIL>

---

## Agent Directives (optional)

Task-specific boundary rules that override or supplement global AGENTS.md rules for this spec only.

Always:
- <specific constraint for this task>

Ask before:
- <high-impact action requiring human confirmation>

Never:
- <hard stop specific to this task>
