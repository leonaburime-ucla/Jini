# Spec Definition of Done (DoD) Checklist: <feature-name>

<!-- SPEC PACKAGE FILE: framework/spec-providers/speckit/templates/spec-system/spec-dod.md -->
<!-- Part of the spec-system package. See framework/spec-providers/speckit/templates/spec-system/ for all required files. -->

---

## Header Metadata

| Field | Value |
|-------|-------|
| spec_id | SPEC-<NNN> |
| feature_name | FEAT-<NNN>-<short-feature-name> |
| version | <semver — must match feature.spec.md version> |
| filled_by | <Spec Agent ID> |
| filled_date | <ISO-8601 UTC> |
| reviewed_by | <Coordinator or human reviewer> |
| reviewed_date | <ISO-8601 UTC> |

---

## How to Use This Checklist

- Each item has a **Status** field: `PASS`, `FAIL`, or `NA`.
- `PASS` — the item is fully satisfied. No caveats.
- `FAIL` — the item is not satisfied. The spec must be updated before handoff. Record what is missing in the Notes column.
- `NA` — the item genuinely does not apply to this feature. Requires written justification in the Notes column. "Not applicable" alone is not a valid justification.
- **Every item must have a status.** A blank status is treated as FAIL.
- **The spec is NOT ready for Software Architect dispatch until all items are PASS or NA.**
- **The Sign-Off Block is mandatory.** Blank Spec Agent sign-off blocks Spec
  handoff. Blank Coordinator sign-off blocks Coordinator Planning Preflight and
  `/plan`.
- If an item cannot be brought to PASS after two revision attempts, escalate to human with the specific blocking item and the reason it cannot pass.

---

## Section A: Spec Package Completeness

*Verifies that all required files in the spec-system package are present and non-empty.*

| # | Item | Status | Notes |
|---|------|--------|-------|
| A-01 | `feature.spec.md` is present in the feature folder | | |
| A-02 | `feature.spec.md` is non-empty — all placeholder values have been replaced with real content | | |
| A-03 | `api.spec.md` is present (or explicitly marked NA with justification if feature has no API) | | |
| A-04 | `state.spec.md` is present (or explicitly marked NA with justification if feature has no state) | | |
| A-05 | `orchestrator.spec.md` is present (or explicitly marked NA with justification if feature has no orchestrator) | | |
| A-06 | `ui.spec.md` is present (or explicitly marked NA with justification if feature has no UI) | | |
| A-07 | `errors.spec.md` is present (or explicitly marked NA with justification if feature defines no error codes) | | |
| A-08 | `behavior.spec.md` is present (or explicitly marked NA with justification if feature has no ordering/precedence/dedup rules) | | |
| A-09 | `traceability.spec.md` is present and all REQ-* and AC-* rows are populated (may be "pending implementation") | | |
| A-10 | `spec-manifest.md` is present and records actual filenames plus omitted files with justification | | |

---

## Section B: feature.spec.md Quality

*Verifies the primary spec document is complete and meets quality standards.*

| # | Item | Status | Notes |
|---|------|--------|-------|
| B-01 | `spec_id` is assigned and unique (verified against existing `<ADS_MEMORY_ROOT>/reports/pipeline/` folders) | | |
| B-02 | `version` is set to correct semver (1.0.0 for new specs) | | |
| B-03 | `status` is APPROVED (not DRAFT or REVIEW) | | |
| B-04 | `content_hash` is computed and recorded — matches the Speckit canonical hash rule | | |
| B-05 | `feature_name` matches the FEAT folder name exactly (case-sensitive) | | |
| B-06 | `last_edited` is a valid ISO-8601 UTC timestamp | | |
| B-07 | `owner` is set to a named human or team (not blank, not "TBD") | | |
| B-08 | Overview section is present and describes the feature in 1–3 sentences | | |
| B-09 | Problem Statement is present with Current state, Desired state, Why now, and Success signal | | |
| B-10 | User Journey section is present with Trigger, Steps, Outcome, and Alternate paths | | |
| B-11 | Scope: In-scope list is present and non-empty | | |
| B-12 | Scope: Out-of-scope list is present and non-empty | | |
| B-13 | Zero `[NEEDS CLARIFICATION]` markers remain anywhere in `feature.spec.md` | | |
| B-14 | All Open Questions have an owner AND a resolution target date | | |
| B-15 | Requirements section has at least one REQ-* item | | |
| B-16 | All REQ-* items are observable and testable — no vague qualifiers ("fast", "robust", "intuitive", "seamless", "easy") | | |
| B-17 | All REQ-* items are independently verifiable (can be tested without testing another REQ) | | |
| B-18 | Acceptance Criteria section has at least one AC-* item | | |
| B-19 | Every REQ-* has at least one corresponding AC-* | | |
| B-20 | All AC-* items follow Given/When/Then format | | |
| B-21 | All AC-* items have a [P1], [P2], or [P3] priority tag | | |
| B-22 | All P1 AC items are independently testable (can be verified without other stories complete) | | |
| B-23 | No AC item requires knowledge of the implementation to evaluate (no "the database contains…", "the Redux store has…") | | |
| B-24 | Invariants section has at least one INV-* item | | |
| B-25 | All INV-* items are written as absolute statements ("must always" / "must never") — not "should" | | |
| B-26 | Edge Cases section has at least one EC-* item | | |
| B-27 | All EC-* items are concrete scenarios ("What happens when X?") — not categories ("Handle edge cases") | | |
| B-28 | All EC-* items have an explicit Expected Behavior | | |
| B-29 | Dependencies table is complete — no blank Failure Mode or Fallback cells | | |
| B-30 | Constitution Compliance table is complete — all 8 articles marked COMPLIES / EXCEPTION / N/A | | |
| B-31 | Any EXCEPTION in the Constitution Compliance table has a note in this DoD or in the ADR | | |
| B-32 | Implementation Readiness Gate checklist in `feature.spec.md` is complete and shows PASS | | |

---

## Section C: Typed Contract Quality

*Verifies typed contract files are complete and well-formed. Contract files use language-neutral `.spec.md` format. Mark entire section NA if the feature has no typed contract files — justify per file in Section A.*

| # | Item | Status | Notes |
|---|------|--------|-------|
| C-01 | All contract files use the language's type system — no behavior defined only in comments | | |
| C-02 | All public interfaces and types have doc comments | | |
| C-03 | All optional fields are explicitly marked as optional — no implicitly optional fields | | |
| C-04 | Nullable fields have explicit nullable typing — nullable intent is not implicit | | |
| C-05 | No untyped / `any` / `object` escape hatches — all types are specific | | |
| C-06 | Immutable constants are marked as such in the language's idiom (`as const`, `Final`, etc.) | | |
| C-07 | API contract: all endpoints are registered in a single registry constant | | |
| C-08 | API contract: all error codes have an HTTP status mapping | | |
| C-09 | API contract: all endpoints have explicit auth requirements | | |
| C-10 | State contract: initial state covers all fields | | |
| C-11 | State contract: transitions/actions cover all state-changing operations | | |
| C-12 | State contract: invariants are falsifiable statements | | |
| C-13 | Orchestrator contract: all async outputs have an explicit result type — not void or untyped | | |
| C-14 | Orchestrator contract: invariants are falsifiable statements | | |
| C-15 | UI contract: all components have a typed props/params definition | | |
| C-16 | UI contract: display conditions cover show/hide/disabled state for every interactive element | | |
| C-17 | UI contract: accessibility requirements cover all components | | |
| C-18 | Error contract: all error codes have entries for HTTP status, retry eligibility, ownership, and user message guidance | | |
| C-19 | Error contract: no error code is missing from coverage requirements | | |

---

## Section D: Behavior Rules Quality

*Verifies behavior.spec.md is complete and internally consistent. Mark entire section NA if behavior.spec.md was not required.*

| # | Item | Status | Notes |
|---|------|--------|-------|
| D-01 | Precedence rules cover every field that can receive a value from multiple sources | | |
| D-02 | Precedence rules are ordered — highest priority source is first | | |
| D-03 | Default Values table covers every field with a non-obvious default | | |
| D-04 | "Why" column in Default Values table contains a rationale — not just a restatement of the value | | |
| D-05 | Limits and Bounds table covers every numeric constraint that affects behavior | | |
| D-06 | Enforcement column in Limits table specifies where each constraint is checked | | |
| D-07 | Deduplication rules define "duplicate" precisely (not just "same content") | | |
| D-08 | Tie-break logic is deterministic — same inputs always produce same winner | | |
| D-09 | Edge Case Handling table covers all boundary values from the Limits table | | |
| D-10 | Every behavior rule in behavior.spec.md has a corresponding row in traceability.spec.md Section 5 | | |

---

## Section E: Traceability Quality

*Verifies the traceability matrix is present and appropriately populated.*

| # | Item | Status | Notes |
|---|------|--------|-------|
| E-01 | traceability.spec.md is present | | |
| E-02 | Every REQ-* from feature.spec.md appears in traceability.spec.md Section 1 | | |
| E-03 | Every AC-* from feature.spec.md appears in traceability.spec.md Section 1 | | |
| E-04 | Every INV-* from feature.spec.md appears in traceability.spec.md Section 2 | | |
| E-05 | Every EC-* from feature.spec.md appears in traceability.spec.md Section 3 | | |
| E-06 | Every error code from errors.spec.md appears in traceability.spec.md Section 4 | | |
| E-07 | Rows with "pending" status are acceptable at spec stage (before TDD) — no FAIL for pending rows | | |
| E-08 | Section 7 (Untraced Requirements) is empty | | |

---

## Section F: Internal Consistency

*Verifies that the spec-system files are consistent with each other.*

| # | Item | Status | Notes |
|---|------|--------|-------|
| F-01 | Error codes in api.spec.md match (are a subset of or equal to) error codes in errors.spec.md | | |
| F-02 | Resource status types in api.spec.md, state.spec.md, orchestrator.spec.md, and ui.spec.md are consistent (same values, same spelling) | | |
| F-03 | OrchestratorItem fields in orchestrator.spec.md are a valid projection of FeatureItem in state.spec.md (no field contradiction) | | |
| F-04 | ItemSummary fields in ui.spec.md are a valid projection of OrchestratorItem in orchestrator.spec.md | | |
| F-05 | Default values in orchestrator.spec.md InputProps match the Default Values table in behavior.spec.md | | |
| F-06 | Rate limit values in api.spec.md match the Limits and Bounds table in behavior.spec.md | | |
| F-07 | All spec files reference the same spec_id and feature_name | | |
| F-08 | All spec files have consistent version numbers (all match, or minor differences are documented) | | |

---

## Section G: Constitution Compliance Verification

*Verifies that all Constitution articles have been properly addressed.*

| # | Item | Status | Notes |
|---|------|--------|-------|
| G-01 | Article I (Library-First): spec does not specify custom implementations where libraries exist | | |
| G-02 | Article II (Test-First): spec makes no assumptions about implementation order — TDD will run first | | |
| G-03 | Article III (Simplicity Gate): every module referenced in contract files traces to a requirement in feature.spec.md | | |
| G-04 | Article IV (Anti-Abstraction Gate): no speculative abstractions in contract files (no types/interfaces with only one current consumer unless it is a defined contract boundary) | | |
| G-05 | Article V (Integration-First Testing): every P1 AC has a corresponding integration test row in traceability.spec.md (or "pending" if TDD has not run) | | |
| G-06 | Article VI (Security-by-Default): api.spec.md auth requirements are present for all endpoints; no endpoint is unauthenticated without explicit NA justification | | |
| G-07 | Article VII (Spec Integrity): spec_id and content_hash are present and correct in all spec files | | |
| G-08 | Article VIII (Observability): errors.spec.md defines structured error payloads with correlationId for all server-side errors | | |

---

## Section H: Final Gate

*The single most important check. Must be PASS for any handoff.*

| # | Item | Status | Notes |
|---|------|--------|-------|
| H-01 | **Implementation Readiness Gate:** A new developer who has never worked on this codebase can read the spec-system package and implement the feature from these specs alone — without asking clarifying questions about scope, behavior, error handling, state, or UI contract. | | |

---

## Summary

| Section | Items | Passing | Failing | NA |
|---------|-------|---------|---------|-----|
| A: Package Completeness | 10 | | | |
| B: feature.spec.md Quality | 31 | | | |
| C: Typed Contract Quality | 19 | | | |
| D: Behavior Rules Quality | 10 | | | |
| E: Traceability Quality | 8 | | | |
| F: Internal Consistency | 8 | | | |
| G: Constitution Compliance | 8 | | | |
| H: Final Gate | 1 | | | |
| **TOTAL** | **95** | | | |

**Overall DoD Result:** PASS / FAIL

> PASS — All items are PASS or NA (with written justification for each NA). Spec is ready for Software Architect dispatch.
> FAIL — One or more items are FAIL or blank. Spec must be revised before handoff.

---

## Blocking Issues (if FAIL)

<!-- List each FAIL item with the specific issue and what must change to bring it to PASS. -->

| Item ID | Issue | Required Change | Owner | Target Date |
|---------|-------|----------------|-------|-------------|
| | | | | |

---

## Sign-Off Block

The Spec Agent fills only the Spec Agent row before handoff. The Coordinator
fills or replaces the Coordinator row during Coordinator Planning Preflight.
Both sign-offs are required before the spec can advance to Software Architect dispatch.

| Role | Name / Agent ID | Date (ISO-8601 UTC) | Signature |
|------|-----------------|---------------------|-----------|
| Spec Agent | | | |
| Coordinator | | | |

> By signing, the Coordinator confirms:
> 1. All items in this checklist are PASS or NA with written justification.
> 2. The spec-system package is internally consistent.
> 3. The Implementation Readiness Gate (H-01) is PASS.
> 4. The spec is authorized for dispatch to the Software Architect Agent.
