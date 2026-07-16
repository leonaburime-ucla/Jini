# Seed Ledger

Ground truth answers for all 14 queries across 4 repo states. This file is HIDDEN from the executor during eval runs.

---

## Q1: Symbol Lookup — Find the definition of `calculateShippingCost`

| State | Answer | File | Line Range |
|-------|--------|------|-----------|
| Clean | `src/orders/shipping.ts` | shipping.ts | function declaration |
| Dirty | `src/orders/logistics.ts` | logistics.ts (moved via uncommitted edit) | appended function |
| Renamed | `src/orders/fulfillment/shipping.ts` | fulfillment/shipping.ts (git mv) | same function |
| Branch-switched | `src/orders/shipping.ts` | shipping.ts (unchanged on main) | function declaration |

**Stale trap (Dirty):** Backend returning `src/orders/shipping.ts` in dirty state = CRITICAL_STALE (function was moved to logistics.ts in working tree).

---

## Q2: Symbol Lookup — Find the definition of `PaymentProcessor` class

| State | Answer | File |
|-------|--------|------|
| Clean | `src/payments/PaymentProcessor.ts` | PaymentProcessor.ts |
| Dirty | `src/payments/PaymentProcessor.ts` | unchanged |
| Renamed | `src/payments/PaymentProcessor.ts` | unchanged |
| Branch-switched | `src/payments/PaymentProcessor.ts` | unchanged |

No stale traps — this symbol doesn't move across states. Tests baseline reliability.

---

## Q3: Callers/Callees — Who calls `validateInventory`?

| State | Callers (required set) | Notes |
|-------|----------------------|-------|
| Clean | OrderService.ts, InventoryService.ts (self-call), OrderController.ts, InventoryService.test.ts | 4 callers |
| Dirty | Same + `src/inventory/audit.ts` | 5 callers (new uncommitted file) |
| Renamed | Same as Clean | 4 callers |
| Branch-switched | Same as Clean | 4 callers |

**Stale trap (Dirty):** Backend missing `audit.ts` in dirty state = missed caller (PARTIAL). Backend should detect the new uncommitted file.

---

## Q4: Callers/Callees — What does `processOrder` call?

| State | Callees (required set) |
|-------|----------------------|
| Clean | findById, validateInventory, calculateShippingCost, charge, updateOrderStatus, sendOrderConfirmation, clearCart |
| Dirty | Same |
| Renamed | Same |
| Branch-switched | Same |

7 direct callees (includes data-access call `findById` on orderData). No state variation — tests baseline callee resolution.

---

## Q5: Dependency Path — Does `OrderController` transitively depend on `NotificationService`?

| State | Answer | Path |
|-------|--------|------|
| Clean | YES | OrderController → OrderService → NotificationService |
| Dirty | YES | Same |
| Renamed | YES | Same |
| Branch-switched | YES | Same |

---

## Q6: Dependency Path — Does `NotificationService` depend on `InventoryData`?

| State | Answer | Evidence |
|-------|--------|----------|
| Clean | NO | NotificationService has no import path to InventoryData (direct or transitive) |
| Dirty | NO | Same |
| Renamed | NO | Same |
| Branch-switched | NO | Same |

**False-positive trap:** Both are used by OrderService, but NotificationService only receives strings (email, orderId) — it has no knowledge of inventory internals.

---

## Q7: Architecture — Is there a circular dependency?

| State | Answer | Cycle |
|-------|--------|-------|
| Clean | YES | OrderService → InventoryService → OrderService |
| Dirty | YES | Same |
| Renamed | YES | Same |
| Branch-switched | YES | Same |

InventoryService imports OrderService (line: `import { OrderService } from '../orders/OrderService'`), and OrderService imports InventoryService.

---

## Q8: Architecture — Does any module violate layering?

| State | Answer | Violation |
|-------|--------|-----------|
| Clean | YES | OrderController (controller layer) imports InventoryData (data layer) directly, skipping the service layer |
| Dirty | YES | Same |
| Renamed | YES | Same |
| Branch-switched | YES | Same |

The import is `import { InventoryData } from '../inventory/InventoryData'` in OrderController.ts.

---

## Q9: Literal/Config — Where is the Redis connection timeout configured?

| State | Answer | Locations |
|-------|--------|-----------|
| Clean | `src/config/redis.json` (key: `timeout`, value: 5000), `src/config/env.ts` (env fallback: `REDIS_TIMEOUT`) | 2 locations |
| Dirty | Same | 2 locations |
| Renamed | Same | 2 locations |
| Branch-switched | Same | 2 locations |

---

## Q10: Literal/Config — What's the max retry count and where is it set?

| State | Answer | Locations |
|-------|--------|-----------|
| Clean | Value: 3. Set in: `src/config/index.ts` (MAX_RETRY_COUNT), `src/config/redis.json` (maxRetriesPerRequest), `src/payments/PaymentProcessor.ts` (MAX_RETRIES), `src/notifications/NotificationService.ts` (retryCount) | 4 locations |
| Dirty | Same | 4 locations |
| Renamed | Same | 4 locations |
| Branch-switched | Same | 4 locations |

Note: These are semantically different retry constants (app-level, Redis client, payment, notification) all set to 3.

---

## Q11: Semantic — What handles authentication/session validation?

| State | Answer | File |
|-------|--------|------|
| Clean | `src/auth/SessionManager.ts` | Session token creation, validation, and invalidation |
| Dirty | Same | |
| Renamed | Same | |
| Branch-switched | Same | |

---

## Q12: Semantic — What handles rate limiting?

| State | Answer | File |
|-------|--------|------|
| Clean | `src/middleware/RateLimiter.ts` | IP-based rate limiting, sliding window |
| Dirty | Same | |
| Renamed | Same | |
| Branch-switched | Same | |

---

## Q13: Change-Impact — If I rename `OrderStatus` enum, what files need updates?

| State | Affected Files |
|-------|---------------|
| Clean | `src/types/shared.ts`, `src/orders/OrderService.ts`, `src/orders/OrderData.ts`, `src/orders/OrderController.ts`, `tests/orders/OrderService.test.ts` |
| Dirty | Same as Clean |
| Renamed | Same as Clean |
| Branch-switched | Same as Clean + `src/orders/OrderReporting.ts` |

**Stale trap (Branch-switched):** Backend missing `OrderReporting.ts` = PARTIAL (file only exists on this branch).

---

## Q14: Change-Impact — If I change `calculateShippingCost` signature, what breaks?

| State | Affected Files |
|-------|---------------|
| Clean | `src/orders/shipping.ts` (definition + internal callers via getAvailableShippingOptions), `src/orders/OrderService.ts` (caller), `tests/orders/OrderService.test.ts` (test) |
| Dirty | `src/orders/logistics.ts` (definition moved here), `src/orders/shipping.ts` (still has dangling calls to removed function), `src/orders/OrderService.ts` (caller, import updated), `tests/orders/OrderService.test.ts` (test, import still points to shipping) |
| Renamed | `src/orders/fulfillment/shipping.ts` (definition moved here), `src/orders/OrderService.ts` (caller), `tests/orders/OrderService.test.ts` (test) |
| Branch-switched | Same as Clean |

**Stale trap (Dirty):** Backend returning ONLY `shipping.ts` and missing `logistics.ts` = CRITICAL_STALE. However, `shipping.ts` IS still affected in dirty state (dangling calls remain after function removal) — so the complete dirty answer includes both files.
