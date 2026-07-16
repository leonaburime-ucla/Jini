# Behavior Rules Spec: <feature-name>

<!-- SPEC PACKAGE FILE: framework/spec-providers/speckit/templates/spec-system/behavior.spec.md -->
<!-- Part of the spec-system package. See framework/spec-providers/speckit/templates/spec-system/ for all required files. -->

---

## Header Metadata

| Field | Value |
|-------|-------|
| spec_id | SPEC-<NNN> |
| feature_name | FEAT-<NNN>-<short-feature-name> |
| version | <semver> |
| content_hash | <sha256 — recompute on every edit> |
| last_edited | <ISO-8601 UTC> |

**Purpose:** This file captures all deterministic, rule-based behavior that is not fully expressed by acceptance criteria alone. If the feature has ordering rules, precedence rules, default values, numeric limits, deduplication logic, or tie-break logic — it lives here.

**When to create this file:** Always, if the feature has any of the following:
- More than one source of truth for a computed value
- Rules about how conflicts between inputs are resolved
- Non-obvious default values
- Numeric bounds that affect behavior (not just validation)
- Ordering that affects correctness (not just display)
- Deduplication rules that affect what the system stores
- Tie-break logic that affects which item "wins"

**When to omit this file:** If the feature has no ordering rules, no precedence rules, all default values are obvious (e.g., `null`), no deduplication, and no tie-break logic — document "N/A" in each section and note this in `spec-dod.md`.

---

## EARS Syntax Guide

All behavior rules and acceptance criteria in this file MUST use EARS (Easy Approach to Requirements Syntax) format. This removes ambiguity and makes requirements directly machine-parsable and testable.

### EARS Patterns

| Pattern | Structure | Use when |
|---|---|---|
| Ubiquitous | `The <system> shall <response>` | Always-true system behavior |
| Event-driven | `WHEN <trigger>, the <system> shall <response>` | Triggered by a discrete event |
| State-driven | `WHILE <precondition>, the <system> shall <response>` | Active during a system state |
| Conditional | `WHERE <feature is included>, the <system> shall <response>` | Optional feature behavior |
| Unwanted behavior | `IF <unwanted condition>, THEN the <system> shall <response>` | Error/exception handling |
| Complex | `WHILE <precondition>, WHEN <trigger>, the <system> shall <response>` | State + event combined |

### Examples

```
# Ubiquitous
The cart service shall persist item quantities as integers between 0 and 999.

# Event-driven
WHEN a user submits the checkout form, the system shall validate all required fields before processing payment.

# State-driven
WHILE the user session is unauthenticated, the system shall redirect all /dashboard/* requests to /login.

# Unwanted behavior
IF the payment gateway returns a timeout after 30 seconds, THEN the system shall cancel the pending order and notify the user with error code PAYMENT_TIMEOUT.

# Complex
WHILE the cart is non-empty, WHEN the user navigates away from the checkout page, the system shall persist the cart state to the user's session.
```

### Rules
- Every row in the Edge Case Handling table must use one of the EARS patterns above
- Vague language ("should", "may", "typically") is forbidden — use "shall" for mandatory behavior
- Every EARS statement must be independently testable — it maps to exactly one test case
- If a statement cannot be written in EARS format, it is not specific enough to be a requirement

---

## 1. Precedence Rules

<!-- Precedence rules define which input, configuration, or value "wins" when multiple sources provide a value for the same output.

Examples:
- User preference > team default > system default
- Explicit filter parameter > saved filter > no filter
- Last-writer-wins vs first-writer-wins for concurrent edits

If there are no precedence rules, write: "N/A — this feature has no competing value sources." -->

### 1.1 <Rule Name>

**Situation:** When does this rule apply?

**Sources in precedence order (highest to lowest):**
1. `<source 1>` — <why it takes precedence>
2. `<source 2>` — <why it is second>
3. `<source 3 / fallback>` — <default when all others are absent>

**Example:**
- Scenario: <concrete example of what happens>
- Input: source 1 = X, source 2 = Y
- Result: X is used (source 1 wins)

**Test requirement:** The TDD Agent must write a test for each pair of competing sources.

---

### 1.2 <Rule Name>

<!-- Add one section per distinct precedence rule. -->

---

## 2. Ordering Rules

<!-- Ordering rules define the sequence in which items are displayed, processed, or evaluated.

If there are no ordering rules, write: "N/A — this feature does not define an ordering requirement. Display order is determined by the consumer." -->

### 2.1 Default Sort Order

**Field used for sorting:** `<field name>` (e.g., `createdAt`)

**Direction:** Descending (newest first) / Ascending (oldest first)

**Stability:** The sort is stable — items with equal values for the sort field are returned in a consistent secondary order: `<secondary sort field>` ascending.

**When overridden:** The default order is overridden when: <describe override conditions, e.g., "the caller provides a sort parameter">

**Invariant:** Items returned by the API must always be ordered by this rule unless the caller explicitly overrides it. Out-of-order results are a bug.

---

### 2.2 Processing Order (if applicable)

**Context:** When the system processes multiple items in a batch or queue, what order governs processing?

**Order:** <description — e.g., "Items are processed in FIFO order by submittedAt timestamp.">

**Tie-break:** If two items have identical `submittedAt` values, the item with the lower lexicographic `id` is processed first.

**Invariant:** No item may be skipped in favor of a later item unless the earlier item is in a terminal failure state.

---

## 3. Default Values

<!-- Document every field in the system that has a non-null/non-zero/non-empty default.
"The default is obvious" is not a reason to omit a field. Every default must be documented.

The "Why" column must explain the rationale — not just restate the value. -->

| Field | Scope | Default Value | Why |
|-------|-------|---------------|-----|
| `pageSize` | API query parameter | `20` | Balances response size against latency for typical list views. Larger defaults increase first-load time. |
| `options.maxRetries` | CreateItemRequest | `3` | Provides resilience against transient upstream errors without unbounded retry loops. |
| `options.notifyOnComplete` | CreateItemRequest | `true` | Opt-in silence is safer than opt-in notification — miss a notification is worse than receive an unwanted one. |
| `status` | Newly created item | `'pending'` | All items are created in an unconfirmed state until the system validates them. |
| `autoFetch` | Orchestrator InputProps | `true` | Consumers expect data immediately on mount without a manual trigger call. |
| `cancelLabel` | ConfirmActionDialog | `'Cancel'` | Standard label per platform convention. Override only if context demands a different label. |
| `<field>` | `<scope>` | `<value>` | `<why>` |

---

## 4. Limits and Bounds

<!-- Document every numeric or size constraint.
"Enforcement" describes where the constraint is checked: API validation (server), client-side validation (UI), both, or neither (informational only). -->

| Constraint | Value | Enforcement | Notes |
|------------|-------|-------------|-------|
| Minimum name length | 1 character (post-trim) | API + client | Blank-only strings (e.g., "   ") are rejected even if length > 0 after raw char count. |
| Maximum name length | 255 characters | API + client | Measured in Unicode code points, not bytes. |
| Maximum items per page | 100 | API | Values above 100 are rejected with VALUE_OUT_OF_RANGE, not silently clamped. |
| Minimum page size | 1 | API | Requesting page size 0 is rejected with VALUE_OUT_OF_RANGE. |
| Maximum retry attempts | 5 | API | Values above 5 are rejected. Values below 0 are rejected. 0 means no retries. |
| Minimum retry attempts | 0 | API | |
| Maximum items in a single response | 100 | API | Determined by max pageSize. |
| Rate limit: write operations | 30 req / 60s per user | API | See api.spec.md for full rate limit policy. |
| Rate limit: read operations | 300 req / 60s per user | API | |
| Idempotency key TTL | 86400 seconds (24 hours) | API | After TTL expires, the same Idempotency-Key may produce a new result. |
| `<constraint>` | `<value>` | `<enforcement>` | `<notes>` |

---

## 5. Deduplication Rules

<!-- If the system must detect and handle duplicate entries, document the deduplication rules here.
"Duplicate" must be precisely defined — not "same content" but "same value for field X within scope Y."

If there is no deduplication logic, write: "N/A — this feature does not deduplicate inputs." -->

### 5.1 What Counts as a Duplicate

A resource is considered a duplicate of an existing resource if all of the following conditions hold:
1. They share the same `parentId`.
2. Their `name` values are identical after case-insensitive comparison and Unicode normalization (NFC form).
3. The existing resource is in a non-terminal status (not `archived` or `failed`).

**Not a duplicate if:** The existing resource has status `archived` or `failed`. An archived or failed item's name may be reused.

### 5.2 How Duplicates Are Handled

**At creation time:** If the incoming name would be a duplicate, the API returns RESOURCE_CONFLICT (409). The request is not processed. No resource is created.

**At import/batch time:** If the feature supports bulk creation, duplicates within the batch are evaluated against existing resources only. Within a single batch, if two items share the same name, the first item in the batch is created and the second is rejected with RESOURCE_CONFLICT.

**User-facing behavior:** The UI surfaces RESOURCE_CONFLICT as an inline field error on the name field: "An item with this name already exists."

### 5.3 Idempotency vs. Deduplication

These are distinct concepts. Deduplication is based on content (name within parent). Idempotency is based on the `Idempotency-Key` header. They are not interchangeable:
- Same Idempotency-Key = same operation, return the same result.
- Same content but different Idempotency-Key = deduplication check applies (may return RESOURCE_CONFLICT).

---

## 6. Tie-Break Logic

<!-- When two or more items are equally valid candidates for a "winner" (e.g., matching a filter, being the "current" record, being the "active" version), how is the tie broken?

If there is no tie-break scenario, write: "N/A — this feature has no scenarios where multiple items compete for the same role." -->

### 6.1 <Tie-Break Scenario Name>

**When does this apply:** <describe the scenario — e.g., "when two items have identical priority scores and the system must pick one to process next">

**Tie-break rule:** <precise, unambiguous rule — e.g., "The item with the earlier `createdAt` timestamp wins. If timestamps are equal (same millisecond), the item with the lexicographically smaller `id` wins.">

**Rationale:** <why this rule is correct — e.g., "FIFO ordering is fairer and predictable; lexicographic id is a deterministic last resort that does not require a counter.">

**Invariant:** The tie-break rule is deterministic — identical inputs always produce the same winner.

---

## 7. Edge Case Handling

<!-- This table captures edge cases that affect behavior rules (ordering, precedence, limits) — not general edge cases, which belong in feature.spec.md.
These are rule-boundary cases: what happens at the exact limit, when inputs are at the edge of valid/invalid, or when a precedence chain has all sources absent. -->

| Edge Case | Expected Behavior | Test Required? |
|-----------|-------------------|----------------|
| `name` contains only whitespace characters | Rejected with INVALID_NAME at API layer. Client-side validation shows inline error before submission. | Yes |
| `name` is exactly 255 characters | Accepted. | Yes |
| `name` is exactly 256 characters | Rejected with INVALID_NAME. | Yes |
| `pageSize` = 0 | Rejected with VALUE_OUT_OF_RANGE. Not silently clamped to 1. | Yes |
| `pageSize` = 101 | Rejected with VALUE_OUT_OF_RANGE. Not silently clamped to 100. | Yes |
| All precedence sources absent for `<field>` | System uses the documented default value in the Defaults table. | Yes |
| Two batch items share the same name | First item is created; second is rejected with RESOURCE_CONFLICT. | Yes |
| Tie-break invoked with identical id values | Impossible — IDs are UUID v4 and guaranteed unique. If this occurs, it is a system integrity violation and must be logged as INTERNAL_ERROR. | Yes (negative case) |
| `maxRetries` = 0 | Item is created with no automatic retry on transient failure. First failure is final. | Yes |
| Rate limit window resets between requests | After resetAt has passed, rate limit counter is cleared. Next request succeeds. | Yes |
| <edge case> | <expected behavior> | Yes / No |
