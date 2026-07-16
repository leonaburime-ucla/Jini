# Spec Definition of Done

- Version: 1.0.0
- Last Updated: 2026-02-23
- Authority: A spec is INVALID and MUST NOT advance past the Spec Agent unless it passes every gate in this document. The Coordinator enforces this before dispatching the Architect Agent.

Provider scope note:
- this document is the validated strict-mode DoD for the default `speckit` provider
- other providers should define or reference their equivalent readiness artifact in `framework/spec-providers/<provider>/provider.md`

> **Language note:** Code examples in this document use TypeScript syntax for illustration. Adapt them to your project's type system — Pydantic models, dataclasses, Go structs, Rust types, etc. The contracts are language-agnostic; the examples are not.

---

## Gate 0 — Implementation-Readiness Test (Applied Last, Enforced First)

Before marking any spec Done, apply this single test:

> **"Can a new developer — who has never spoken to anyone on this project — implement this feature correctly from these spec files alone, with no additional questions?"**

If the answer is NO for any reason, the spec is NOT done. Identify the gap, return to the Spec Agent, and fix it. This gate supersedes all checklist items below: a spec that passes every checklist item but fails this test is still invalid.

---

## Required Spec Package Files

A complete spec for feature `NNN-feature-name` always requires the canonical primary spec plus the package-governance files below. Contract files are required when the feature shape makes them applicable. Missing any always-required file, or any applicable contract file, is a blocking deficiency.

| File | Location | Purpose |
|---|---|---|
| `feature.spec.md` | `<user-specified>/<NNN>-<feature-name>/` | Human-readable spec: problem, scope, requirements, ACs, invariants, edge cases, dependencies, open questions, constitution compliance |
| `api.spec.md` | `<user-specified>/<NNN>-<feature-name>/` | Typed API contracts: request/response schemas, HTTP methods, status codes, error payloads (required only if the feature exposes or consumes an API) |
| `state.spec.md` | `<user-specified>/<NNN>-<feature-name>/` | Typed state shapes: before/after for every mutation, initial state, derived state (required only if the feature introduces or mutates stateful data) |
| `orchestrator.spec.md` | `<user-specified>/<NNN>-<feature-name>/` | Typed orchestration contracts: which services/repos are called, in what order, what they return, what errors they surface (required only if the feature has a coordinator/orchestrator layer) |
| `ui.spec.md` | `<user-specified>/<NNN>-<feature-name>/` | Typed UI contracts: component props, events emitted, loading/error/empty states, accessibility requirements (required only if the feature has a UI surface) |
| `errors.spec.md` | `<user-specified>/<NNN>-<feature-name>/` | Exhaustive error catalog: every error code, exact payload shape, HTTP status, user-facing message, retry behavior (required only if the feature defines error codes or recovery paths) |
| `behavior.spec.md` | `<user-specified>/<NNN>-<feature-name>/` | Deterministic behavior rules: precedence, ordering, defaults, limits, deduplication, tie-break logic — anything not expressible in types (required only when such rules exist) |
| `traceability.spec.md` | `<user-specified>/<NNN>-<feature-name>/` | Traceability matrix: REQ-* to function/component, REQ-* to test IDs |
| `spec-manifest.md` | `<user-specified>/<NNN>-<feature-name>/` | Records actual filenames, omitted files with justification, and whether the package uses prefixed or standard naming |
| `spec-dod.md` | `<user-specified>/<NNN>-<feature-name>/` | This DoD checklist, completed with pass/fail status for this spec |

Legacy single-file `spec.md` from the deleted `spec-template.md` flow is not valid for new work. New specs use `feature.spec.md` as the canonical primary file.

---

## Required Metadata Fields

Every spec package must carry the following metadata in `feature.spec.md`. Missing or placeholder values are a blocking deficiency.

| Field | Format | Valid Values | Invalid Values |
|---|---|---|---|
| `spec_id` | `SPEC-NNN` | `SPEC-001`, `SPEC-042` | `SPEC-?`, `TBD`, empty |
| `version` | semver `MAJOR.MINOR.PATCH` | `1.0.0`, `2.3.1` | `v1`, `draft`, empty |
| `status` | enum | `DRAFT`, `REVIEW`, `APPROVED`, `SUPERSEDED` | `WIP`, `done`, free text |
| `content_hash` | `sha256:<64 hex chars>` | Computed from file contents below the metadata block | `TBD`, `pending`, stale hash |

The content hash MUST be recomputed every time any content below the metadata block changes. A stale hash is treated as a spec integrity violation (Constitution Article VII).

---

## Typed I/O Contracts (api.spec.md)

`api.spec.md` is not done until ALL of the following are present for every endpoint or external interface this feature exposes or consumes.

### Per Endpoint

- HTTP method, path, and path parameters — typed
- Request body schema — typed using the language's type system; no untyped escape hatches without an explicit narrowing strategy documented in a comment
- Response body schema for every HTTP status code this endpoint can return — typed
- Query parameter schema — typed; required vs optional explicit
- Header requirements (auth headers, content-type, correlation IDs) — documented as inline comments

### Example

```typescript
// POST /api/v1/cart/items
export interface AddCartItemRequest {
  productId: string;   // UUID v4
  quantity: number;    // 1–99 inclusive
  variantId?: string;  // UUID v4; omit for products with no variants
}

export interface AddCartItemResponse {
  cartId: string;        // UUID v4
  itemId: string;        // UUID v4
  totalItems: number;    // count of distinct line items
  totalPrice: Money;
  updatedAt: string;     // ISO-8601 UTC
}

// HTTP 200: AddCartItemResponse
// HTTP 400: ErrorPayload (see errors.spec.md) — CART_ITEM_INVALID_QUANTITY, CART_ITEM_PRODUCT_NOT_FOUND
// HTTP 409: ErrorPayload — CART_ITEM_DUPLICATE
// HTTP 422: ErrorPayload — CART_ITEM_EXCEEDS_STOCK
// HTTP 500: ErrorPayload — INTERNAL_ERROR
```

### What Is NOT Acceptable

- "Returns a cart object" — not a typed contract
- `response: object` — no type information
- Missing error status codes — if the implementation can return a 409, the spec must define it
- Schemas described only in prose — prose descriptions in `feature.spec.md` are supplementary; the `.spec.md` contract file is the authoritative typed contract

---

## Typed State Contracts (state.spec.md)

`state.spec.md` is not done until ALL of the following are present.

- Initial state shape — typed
- Every possible state transition — documented as before/after snapshots with typed shapes
- Derived state (computed values) — typed and documented with the derivation rule
- State invariants — enforced constraints typed and commented (e.g., "items.length === 0 implies totalPrice === 0")

### Example

```typescript
// Initial state
export interface CartState {
  cartId: string | null;
  items: CartItem[];
  totalPrice: Money;
  status: 'idle' | 'loading' | 'error';
  lastError: ErrorPayload | null;
}

export const CART_INITIAL_STATE: CartState = {
  cartId: null,
  items: [],
  totalPrice: { amount: 0, currency: 'USD' },
  status: 'idle',
  lastError: null,
};

// State after addItem succeeds
// Before: { items: [], totalPrice: { amount: 0, currency: 'USD' } }
// After:  { items: [{ itemId, productId, quantity, unitPrice }], totalPrice: { amount: unitPrice * quantity, currency } }
// Invariant: totalPrice.amount === sum(items.map(i => i.unitPrice.amount * i.quantity))
```

---

## Typed Orchestrator Contracts (orchestrator.spec.md)

`orchestrator.spec.md` is not done until the following are specified for every use-case or orchestration flow in the feature.

- The services or repositories called, in order — typed as method signatures
- What each call receives — typed
- What each call returns on success — typed
- What each call returns on failure — typed (use the error catalog from `errors.spec.md`)
- Conditional branching — documented with the condition and both branches
- Transaction boundaries — explicitly annotated (what is atomic, what is compensating)

### Example

```typescript
// AddCartItemOrchestrator
// 1. CartRepository.findOrCreate({ userId }) → CartEntity | CART_CREATE_FAILED
// 2. ProductRepository.findById({ productId }) → ProductEntity | CART_ITEM_PRODUCT_NOT_FOUND
// 3. if (product.stock < quantity) → throw CART_ITEM_EXCEEDS_STOCK
// 4. CartRepository.addItem({ cartId, productId, quantity, variantId? }) → CartItemEntity | CART_ITEM_DUPLICATE
// 5. PriceCalculationService.recalculate({ cartId }) → Money | PRICE_CALCULATION_FAILED
// 6. CartRepository.save({ cartId, updatedAt: now() }) → void | CART_SAVE_FAILED
// Steps 4–6 are atomic. If any fail, compensate by calling CartRepository.removeItem({ cartId, itemId }).
```

---

## Error Codes and Payloads (errors.spec.md)

`errors.spec.md` is not done until EVERY error the feature can produce is cataloged with ALL of the following fields.

| Field | Required | Example |
|---|---|---|
| Error code constant | Yes | `CART_ITEM_INVALID_QUANTITY` |
| HTTP status code | Yes | `400` |
| User-facing message | Yes — literal string, not a description | `"Quantity must be between 1 and 99."` |
| Machine-readable payload type | Yes — typed interface | `{ code: string; message: string; field?: string }` |
| Retry behavior | Yes — one of: `no-retry`, `retry-safe`, `retry-idempotent` | `no-retry` |
| Recovery action | Yes — what the client should do | `"Re-submit with quantity between 1 and 99."` |

### Example

```typescript
export const CART_ERRORS = {
  CART_ITEM_INVALID_QUANTITY: {
    httpStatus: 400,
    message: 'Quantity must be between 1 and 99.',
    field: 'quantity',
    retry: 'no-retry',
    recovery: 'Re-submit with a quantity value between 1 and 99.',
  },
  CART_ITEM_PRODUCT_NOT_FOUND: {
    httpStatus: 400,
    message: 'The requested product does not exist.',
    field: 'productId',
    retry: 'no-retry',
    recovery: 'Verify the productId and re-submit.',
  },
  CART_ITEM_EXCEEDS_STOCK: {
    httpStatus: 422,
    message: 'Requested quantity exceeds available stock.',
    field: 'quantity',
    retry: 'retry-safe',
    recovery: 'Reduce quantity or wait for stock to replenish.',
  },
  CART_ITEM_DUPLICATE: {
    httpStatus: 409,
    message: 'This item is already in your cart.',
    field: 'productId',
    retry: 'no-retry',
    recovery: 'Use the update-quantity endpoint to change quantity for an existing item.',
  },
} as const;

export type CartErrorCode = keyof typeof CART_ERRORS;
export interface ErrorPayload {
  code: CartErrorCode;
  message: string;
  field?: string;
  traceId?: string;
}
```

---

## Deterministic Behavior Rules (behavior.spec.md)

`behavior.spec.md` is not done until EVERY behavior rule that cannot be expressed as a type is written as an explicit, testable rule. Vague prose is a blocking deficiency.

Required sections:

### Precedence Rules
When two rules conflict, which one wins? Document for every conflict point.
Example: "If both a percentage discount and a fixed-amount discount apply, the percentage discount is applied first, then the fixed-amount discount is applied to the discounted total."

### Ordering Rules
When order matters, what determines it? Document the sort key, tie-break key, and stability guarantees.
Example: "Cart items are displayed in insertion order. Insertion order is determined by `addedAt` ascending. If two items share the same `addedAt` millisecond (unlikely but possible in bulk-add flows), tie-break by `productId` ascending."

### Default Values
Every field with a default must state the default explicitly.
Example: "If `variantId` is omitted, the item is treated as a non-variant product. The stored `variantId` is `null`. The system does not infer a default variant."

### Limits and Caps
Every numeric limit must state: the limit, what happens when it is exceeded, and whether the limit is enforced at the API layer, service layer, or both.
Example: "Maximum 50 distinct line items per cart. Enforced at the service layer before persistence. Exceeding returns `CART_ITEM_LIMIT_EXCEEDED` (HTTP 422). The API layer does not pre-validate this limit."

### Deduplication Rules
When is a duplicate detected? What is the identity key? What happens to duplicates?
Example: "A cart item is a duplicate if `(cartId, productId, variantId)` already exists. Duplicate detection occurs in the service layer, not the database. Duplicates return `CART_ITEM_DUPLICATE` (HTTP 409). They do not silently merge."

### Tie-Break Logic
For any operation that could produce non-deterministic results, define the tie-break.
Example: "When multiple promotions are eligible, apply in ascending order of `promotion_id` (lexicographic). This is deterministic and auditable."

---

## Acceptance Scenarios

Every acceptance criterion (AC-NN) in `feature.spec.md` must have at least one acceptance scenario in this format. Acceptance scenarios are NOT the same as test cases — they define the exact expected observable output for a concrete input. They do not describe "what should happen in general."

### Required Format

```
Scenario: <AC-NN> — <short name>
Given:
  - <concrete precondition with exact values — not "a valid cart" but "cart C1 containing 2 units of product P1">
  - <additional preconditions>
When:
  - <exact action with exact inputs — not "user adds an item" but "POST /api/v1/cart/items with { productId: 'P2', quantity: 3 }">
Then:
  - <exact expected output — not "returns success" but "HTTP 200 with body { cartId: 'C1', itemId: <new UUID>, totalItems: 2, totalPrice: { amount: 2950, currency: 'USD' } }">
  - <side effects — e.g., "CartUpdated event emitted with payload { cartId: 'C1', updatedAt: <timestamp> }">
  - <state after — e.g., "Cart C1 now contains 2 line items">
```

### What Is NOT an Acceptance Scenario

- "When the user adds an item, they see the cart updated." — no concrete inputs, no exact outputs.
- "Returns a 200 with cart data." — "cart data" is not a defined output.
- "The state is updated correctly." — "correctly" is a vague qualifier (see Banned Language below).

---

## Traceability Matrix (traceability.spec.md)

`traceability.spec.md` is not done until every requirement and every function or component has a two-way mapping.

### Required Tables

**Table 1: REQ-* to Implementation**

| Requirement ID | Function / Component | File Path |
|---|---|---|
| REQ-01 | `CartService.addItem()` | `src/cart/cart.service.ts` |
| REQ-01 | `AddCartItemHandler` (HTTP handler) | `src/cart/cart.controller.ts` |
| REQ-02 | `CartRepository.findOrCreate()` | `src/cart/cart.repository.ts` |

**Table 2: REQ-* to Tests**

| Requirement ID | Test ID | Test File |
|---|---|---|
| REQ-01 | `AC-01-add-item-success` | `tests/cart/add-item.integration.test.ts` |
| REQ-01 | `AC-02-add-item-duplicate` | `tests/cart/add-item.integration.test.ts` |
| REQ-02 | `AC-03-cart-created-on-first-add` | `tests/cart/cart-creation.integration.test.ts` |

**Completeness rules:**
- Every REQ-* must appear in Table 1. A requirement with no implementation mapping is unimplemented.
- Every REQ-* must appear in Table 2. A requirement with no test mapping is untested.
- Every AC-NN must trace to at least one test ID. An AC with no test is untestable until mapped.
- The TDD Agent fills in Table 2 test IDs after producing tests. The Spec Agent fills Table 1 with the expected implementation targets. The Programmer Agent confirms Table 1 paths match actual implementation.

---

## Coordinator Blocking Conditions

The Coordinator MUST NOT dispatch the Architect Agent unless ALL of the following are true. Each condition is a hard gate — not a recommendation.

| # | Condition | How to Verify |
|---|---|---|
| 1 | `feature.spec.md` exists and contains all required sections | File exists; all section headers present; no empty sections |
| 2 | `spec_id` is set and follows `SPEC-NNN` format | Metadata block parsed; regex match |
| 3 | `version` is set to valid semver | Metadata block parsed; semver regex match |
| 4 | `status` is `APPROVED` | Metadata block parsed; human has explicitly approved |
| 5 | `content_hash` is present and matches the current file content | Recompute sha256; compare to stored hash |
| 6 | Zero unresolved `[NEEDS CLARIFICATION]` markers in the spec | Grep the spec file for `[NEEDS CLARIFICATION]`; count must be 0 |
| 7 | All applicable typed contract files exist and are non-empty | File system check for the contract files the feature actually requires |
| 8 | If `behavior.spec.md` applies, it exists and all required sections are present | File exists when needed; section headers checked |
| 9 | `traceability.spec.md` and `spec-manifest.md` exist and are populated | Every REQ-* has at least one implementation target; manifest records omitted files with justification |
| 10 | `spec-dod.md` exists and all items are PASS or NA with justification | No items marked FAIL, TODO, or left blank |
| 11 | Constitution Compliance table in `feature.spec.md` is complete | Every article marked COMPLIES, EXCEPTION, or N/A; no blanks |
| 12 | Every EXCEPTION in the Constitution table has a justification noted | Justification column is non-empty for all EXCEPTION rows |
| 13 | Every acceptance scenario uses concrete inputs and exact expected outputs | Manual review; no vague qualifiers (see Banned Language section) |
| 14 | Red-Team Agent review completed with no BLOCKING findings unresolved | Red-Team report exists; BLOCKING count is 0 |
| 15 | Implementation-readiness test passes | New-developer test (Gate 0) passed by reviewer |

If any condition is false, the Coordinator MUST return the spec to the Spec Agent with a list of which conditions failed and why.

---

## Banned Vague Language

The following phrases are FORBIDDEN in any spec file unless they are immediately followed by a measurable criterion in the same sentence. Finding any of these phrases without a measurable criterion is a blocking deficiency.

| Banned Phrase | Why It Is Banned | Acceptable Alternative |
|---|---|---|
| "should work" | Not testable. "Work" has no definition. | State the observable output for a specific input. |
| "remains unchanged" | Does not specify what is being checked or at what boundary. | List exactly which fields or state keys are unchanged and name the test that verifies it. |
| "consumer model only" | Does not define which model, which fields, or which exclusions. | List the exact fields included in the consumer view by name. |
| "handles gracefully" | "Gracefully" is subjective. | State the exact error code, HTTP status, user-facing message, and retry behavior. |
| "performs well" | No baseline, no metric, no measurement method. | State: p99 latency ≤ X ms under Y concurrent users measured by Z. |
| "is user-friendly" | Subjective. Not testable. | Describe the specific interaction and the observable outcome (e.g., "form field highlights in red and displays message 'Required'"). |
| "and so on" / "etc." | Indicates an incomplete enumeration. | Complete the list explicitly. If the list is unbounded, state the rule that governs it. |
| "as needed" | Does not define when the need arises or who decides. | State the triggering condition explicitly. |
| "reasonable" | Subjective. Not measurable. | Replace with the specific value or range. |
| "appropriate" | Subjective. Not measurable. | Replace with the specific criteria for what counts as appropriate. |
| "efficiently" | No baseline, no metric. | Replace with a measured latency, throughput, or resource budget. |
| "correctly" | "Correctly" has no definition without a spec. | Reference the AC or invariant that defines correct behavior. |
| "properly" | Same as "correctly". | Same fix as above. |
| "standard behavior" | Does not define which standard or which RFC. | Reference the standard explicitly (e.g., "per RFC 7231 Section 6.3.1"). |
| "best practices" | Not actionable. | Name the specific practice and cite the source. |
| "minimal impact" | No metric. | State the maximum acceptable degradation in measurable terms. |

**Enforcement:** The Spec Agent must grep for each of these phrases before declaring the spec Done. The Red-Team Agent includes banned-language checks in its review pass.

---

## DoD Checklist Template

The file `spec-dod.md` must be generated for each spec and completed before Architect dispatch. Template:

```markdown
# Spec DoD Checklist — SPEC-NNN

- spec_id: SPEC-NNN
- version: <semver>
- date_checked: <ISO-8601 UTC>
- checked_by: <agent or human>

## Package Completeness
- [ ] feature.spec.md exists and all sections populated
- [ ] all applicable typed contract files exist and are complete (`api.spec.md`, `state.spec.md`, `orchestrator.spec.md`, `ui.spec.md`, `errors.spec.md`)
- [ ] behavior.spec.md exists when the feature has non-trivial behavior rules
- [ ] traceability.spec.md exists and Table 1 populated
- [ ] spec-manifest.md exists and records actual filenames plus omitted files with justification
- [ ] spec-dod.md (this file) exists

## Metadata
- [ ] spec_id set to SPEC-NNN format
- [ ] version set to valid semver
- [ ] status is APPROVED
- [ ] content_hash present and matches current file content

## Contracts
- [ ] Every API endpoint has typed request, response, and error schemas
- [ ] Every state mutation has before/after snapshot
- [ ] Every error has code, HTTP status, user message, retry behavior, and recovery action
- [ ] Every orchestration flow has ordered service call list with success and failure types

## Behavior
- [ ] All precedence rules documented
- [ ] All ordering rules documented with tie-break logic
- [ ] All defaults documented explicitly
- [ ] All limits documented with enforcement layer specified
- [ ] All deduplication rules documented

## Acceptance Scenarios
- [ ] Every AC has at least one scenario with concrete inputs and exact expected outputs
- [ ] No scenario uses banned vague language

## Traceability
- [ ] Every REQ-* maps to at least one implementation target in Table 1
- [ ] Every REQ-* maps to at least one test ID in Table 2

## Coordinator Gates
- [ ] Zero [NEEDS CLARIFICATION] markers
- [ ] Constitution Compliance table complete (no blank rows)
- [ ] All EXCEPTION rows have justification text
- [ ] Red-Team review complete, zero BLOCKING findings

## Implementation Readiness
- [ ] Gate 0 new-developer test passed by reviewer
```
