# Traceability Matrix: <feature-name>

<!-- SPEC PACKAGE FILE: framework/spec-providers/speckit/templates/spec-system/traceability.spec.md -->
<!-- Part of the spec-system package. See framework/spec-providers/speckit/templates/spec-system/ for all required files. -->

---

## Header Metadata

| Field | Value |
|-------|-------|
| spec_id | SPEC-<NNN> |
| feature_name | FEAT-<NNN>-<short-feature-name> |
| version | <semver — must match feature.spec.md version> |
| content_hash | <sha256 — recompute on every edit> |
| last_edited | <ISO-8601 UTC> |
| traceability_status | PENDING IMPLEMENTATION \| IN PROGRESS \| COMPLETE |

**Purpose:** This matrix traces every requirement (REQ-*) and acceptance criterion (AC-*) from `feature.spec.md` through to:
1. The file and function that implements it.
2. The test ID that verifies it.

A requirement with no implementation entry is unimplemented. A requirement with no test entry is untested. Both are coverage gaps that block shipping.

**When to fill this file:**
- **Before TDD:** Create the file, list all REQ-* and AC-* rows, leave implementation and test columns as "pending".
- **During TDD:** Fill in test IDs as the TDD Agent writes tests.
- **During implementation:** Fill in implementation file/function as the Programmer Agent writes code.
- **Before ship:** All rows must be complete and the "Traceability Complete" checkbox at the bottom must be checked.

---

## 1. Requirement-to-Implementation-to-Test Matrix

<!--
Column definitions:
  REQ/AC ID      — the identifier from feature.spec.md (e.g., REQ-01, AC-03)
  Description    — copied verbatim from feature.spec.md (1-line summary)
  Priority       — P1 / P2 / P3 (from AC tag)
  Impl File      — relative path to the source file that implements this (e.g., "src/feature/createItem.ts")
  Impl Function  — the function, method, or component name (e.g., "createItem", "ItemCard")
  Test File      — relative path to the test file (e.g., "src/feature/__tests__/createItem.test.ts")
  Test ID        — the test name or ID (e.g., "createItem > success > returns server-confirmed item")
  Status         — PENDING / IMPLEMENTED / TESTED / VERIFIED (verified = code reviewed and approved)

If a REQ/AC is intentionally not implemented (deferred, out of scope), write "DEFERRED" in Status and
add a note explaining why. Do not delete rows — deferred requirements are still traced.
-->

| REQ/AC ID | Description | Priority | Impl File | Impl Function | Test File | Test ID | Status |
|-----------|-------------|----------|-----------|---------------|-----------|---------|--------|
| REQ-01 | <copied from feature.spec.md> | — | pending | pending | pending | pending | PENDING |
| AC-01 (REQ-01) | <copied from feature.spec.md> | P1 | pending | pending | pending | pending | PENDING |
| AC-02 (REQ-01) | <copied from feature.spec.md> | P1 | pending | pending | pending | pending | PENDING |
| REQ-02 | <copied from feature.spec.md> | — | pending | pending | pending | pending | PENDING |
| AC-03 (REQ-02) | <copied from feature.spec.md> | P1 | pending | pending | pending | pending | PENDING |
| AC-04 (REQ-02) | <copied from feature.spec.md> | P2 | pending | pending | pending | pending | PENDING |
| REQ-03 | <copied from feature.spec.md> | — | pending | pending | pending | pending | PENDING |
| AC-05 (REQ-03) | <copied from feature.spec.md> | P2 | pending | pending | pending | pending | PENDING |

<!-- Copy all REQ-* and AC-* rows from feature.spec.md into this table. Do not add rows that are not in feature.spec.md. -->

---

## 2. Invariant Traceability

<!-- Maps each invariant (INV-*) from feature.spec.md to the tests that assert it. -->

| INV ID | Invariant (copied from feature.spec.md) | Test File | Test ID | Status |
|--------|-----------------------------------------|-----------|---------|--------|
| INV-01 | <invariant description> | pending | pending | PENDING |
| INV-02 | <invariant description> | pending | pending | PENDING |

---

## 3. Edge Case Traceability

<!-- Maps each edge case (EC-*) from feature.spec.md to its test. -->

| EC ID | Edge Case (copied from feature.spec.md) | Test File | Test ID | Status |
|-------|-----------------------------------------|-----------|---------|--------|
| EC-01 | <edge case description> | pending | pending | PENDING |
| EC-02 | <edge case description> | pending | pending | PENDING |

---

## 4. Error Code Traceability

<!-- Maps each error code from errors.spec.md to the test that produces it. -->

| Error Code | Produced By (file/function) | Test File | Test ID | Status |
|------------|-----------------------------|-----------|---------|--------|
| RESOURCE_NOT_FOUND | pending | pending | pending | PENDING |
| PARENT_NOT_FOUND | pending | pending | pending | PENDING |
| RESOURCE_CONFLICT | pending | pending | pending | PENDING |
| VALIDATION_ERROR | pending | pending | pending | PENDING |
| INVALID_NAME | pending | pending | pending | PENDING |
| FORBIDDEN | pending | pending | pending | PENDING |
| UNAUTHENTICATED | pending | pending | pending | PENDING |
| RATE_LIMIT_EXCEEDED | pending | pending | pending | PENDING |
| INTERNAL_ERROR | pending | pending | pending | PENDING |

<!-- Add or remove rows to match the error codes defined in errors.spec.md. -->

---

## 5. Behavior Rule Traceability

<!-- Maps each rule in behavior.spec.md to its test. Only fill this section if behavior.spec.md was created. -->

| Rule | Section in behavior.spec.md | Test File | Test ID | Status |
|------|-----------------------------|-----------|---------|--------|
| Default sort order | § 2.1 | pending | pending | PENDING |
| Default value: pageSize = 20 | § 3 | pending | pending | PENDING |
| Deduplication: same name + same parentId = conflict | § 5.1 | pending | pending | PENDING |
| Tie-break: earlier createdAt wins | § 6.1 | pending | pending | PENDING |
| Edge case: name = 256 chars rejected | § 7 | pending | pending | PENDING |

<!-- Add or remove rows to match the rules in behavior.spec.md. -->

---

## 6. Coverage Gaps

<!-- List any REQ/AC/INV/EC that does not yet have a corresponding implementation or test.
This section must be empty (or contain only intentionally deferred items) before the feature ships.
Update this section whenever you fill in a row in the matrices above. -->

### 6.1 Unimplemented Requirements

<!-- Requirements that have no implementation file/function yet. -->

| REQ/AC ID | Reason Unimplemented | Target Completion | Owner |
|-----------|---------------------|-------------------|-------|
| — | — | — | — |

### 6.2 Untested Requirements

<!-- Requirements that have an implementation but no test. -->

| REQ/AC ID | Reason Untested | Target Completion | Owner |
|-----------|----------------|-------------------|-------|
| — | — | — | — |

### 6.3 Untested Error Codes

<!-- Error codes that have no test producing them. -->

| Error Code | Reason Untested | Target Completion | Owner |
|------------|----------------|-------------------|-------|
| — | — | — | — |

### 6.4 Deferred Items

<!-- Requirements that are intentionally not included in this iteration.
These must reference an Open Question or a future spec, not just be left blank. -->

| REQ/AC ID | Deferred To | Reason | Approved By |
|-----------|-------------|--------|-------------|
| — | — | — | — |

---

## 7. Untraced Requirements

<!-- Requirements that appear in feature.spec.md but are NOT yet in the matrix above.
This section should always be empty. It exists as a cross-check.
If a REQ-* or AC-* from feature.spec.md is missing from Section 1, it must be listed here as a gap. -->

| REQ/AC ID | Reason Not In Matrix |
|-----------|---------------------|
| — | — |

---

## 8. Traceability Completeness Checklist

This checklist must be completed before the feature ships.

- [ ] All REQ-* from feature.spec.md appear in the Section 1 matrix
- [ ] All AC-* from feature.spec.md appear in the Section 1 matrix
- [ ] All INV-* from feature.spec.md appear in the Section 2 matrix
- [ ] All EC-* from feature.spec.md appear in the Section 3 matrix
- [ ] All error codes from errors.spec.md appear in the Section 4 matrix
- [ ] All behavior rules from behavior.spec.md appear in the Section 5 matrix (if applicable)
- [ ] Section 6.1 (unimplemented) is empty or all entries are DEFERRED with approval
- [ ] Section 6.2 (untested) is empty or all entries are DEFERRED with approval
- [ ] Section 6.3 (untested error codes) is empty or all entries are DEFERRED with approval
- [ ] Section 7 (untraced) is empty
- [ ] All VERIFIED rows have been reviewed and signed off by the Code Review Agent

**[ ] TRACEABILITY COMPLETE** — all requirements are implemented and tested. Feature is ready to ship.

---

## Sign-Off

| Role | Name / Agent | Date (ISO-8601) | Notes |
|------|--------------|-----------------|-------|
| Spec Agent | | | |
| TDD Agent | | | |
| Programmer Agent | | | |
| Code Review Agent | | | |
| Coordinator | | | |
