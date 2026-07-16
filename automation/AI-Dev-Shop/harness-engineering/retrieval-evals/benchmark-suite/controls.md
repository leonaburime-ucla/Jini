# Controls

## Positive Controls (Oracle MUST pass)

| ID | Query | State | Why Oracle Must Pass |
|----|-------|-------|---------------------|
| PC-01 | Q1 (symbol lookup: calculateShippingCost) | Clean | Trivial lookup — if oracle fails, executor or task is broken |
| PC-02 | Q4 (callees of processOrder) | Clean | Direct function body inspection — oracle has all needed context |
| PC-03 | Q9 (Redis timeout location) | Clean | Literal grep — oracle should always find config values |

## Negative Controls (Expected FAIL for search-only)

| ID | Query | State | Why FAIL is Correct |
|----|-------|-------|-------------------|
| NC-01 | "What is the runtime memory usage of OrderService?" | Clean | Requires runtime profiling, no search backend can answer |
| NC-02 | "What happens when Redis is unreachable under load?" | Clean | Requires integration testing, not discoverable from code |

## Stale Traps (CRITICAL_STALE detection)

| ID | Query | State | Stale Answer | Correct Answer |
|----|-------|-------|-------------|----------------|
| ST-01 | Q1 (calculateShippingCost) | Dirty | `src/orders/shipping.ts` | `src/orders/logistics.ts` |
| ST-02 | Q3 (validateInventory callers) | Dirty | 4 callers (missing audit.ts) | 5 callers (includes audit.ts) |
| ST-03 | Q14 (calculateShippingCost impact) | Dirty | ONLY shipping.ts (missing logistics.ts) | Both logistics.ts AND shipping.ts affected |
| ST-04 | Q13 (OrderStatus impact) | Branch-switched | 5 files (missing OrderReporting.ts) | 6 files |

## Regression Controls

| ID | Query | State | What This Catches |
|----|-------|-------|-------------------|
| RC-01 | Q7 (circular dep) | Clean | Graph tools should catch cycles; rg likely misses |
| RC-02 | Q5 (transitive dep) | Clean | Multi-hop path — graph advantage over rg |
| RC-03 | Q3 (callers) | Clean | Full call graph — graph vs rg completeness |
