# Seed Ledger — Eval 1: Discount Rule Engine

Rewritten against the current Python fixture on `2026-04-29`.
Seed IDs are retained for suite backfill compatibility.

## Seeds

ID: SEED-1A
Category: Adversarial aggregate behavior
Seeded issue: `bulk_discount()` checks each line item independently. If the cart splits the same SKU across multiple lines, the engine never aggregates quantity across those lines, so a 6 + 5 split for the same SKU misses the 10+ threshold.
Expected owner: Programmer
Expected severity: High
Expected signal: Aggregate repeated-SKU quantities before applying the bulk rule, or normalize the cart first.
Evidence path: `src/rules.py` — `bulk_discount()`
False positive risk: Low

ID: SEED-1B
Category: Hidden branching / determinism
Seeded issue: The 40% cap is applied in the order the injected `rules` list happens to run. Two callers with the same cart but different rule ordering can get different totals, and the engine does not document a priority contract for rule order under the cap.
Expected owner: Programmer
Expected severity: Medium
Expected signal: Define and document rule priority, or make cap application independent of caller-provided ordering.
Evidence path: `src/engine.py` — `apply_discounts()` rule loop and cap handling
False positive risk: Medium

ID: SEED-1C
Category: Extension point
Seeded issue: Extensibility still relies on raw callables and a mutable shared `DEFAULT_RULES` list. Adding a new rule by mutating that module-level list changes global behavior for every later caller and test in the process.
Expected owner: Programmer
Expected severity: Medium
Expected signal: Prefer an immutable default registry or explicit rule injection at the call site instead of shared mutable module state.
Evidence path: `src/rules.py` — `DEFAULT_RULES`
False positive risk: Low

ID: SEED-1D
Category: Function scoring / score calibration
Seeded issue: The current quality annotations still score the core functions in the low-to-mid 90s even though the engine misses split-line bulk aggregation and leaves cap behavior dependent on implicit rule order. The scores read cleaner than the fixture really is.
Expected owner: Code Review
Expected severity: Required
Expected signal: Flag that the quality scores are overstated relative to the remaining correctness and contract risks.
Evidence path: `src/engine.py`, `src/rules.py`, `src/validation.py` — `@overallScore` annotations
False positive risk: Low

ID: SEED-1E
Category: Predictable errors
Seeded issue: `validate_cart()` raises generic `Exception` for user-input failures. Callers cannot distinguish expected validation errors from programmer/system failures without string-matching the message.
Expected owner: Programmer
Expected severity: Medium
Expected signal: Raise a specific validation exception type such as `ValueError` or a domain error class.
Evidence path: `src/validation.py` — `validate_cart()`
False positive risk: Low

ID: SEED-1F
Category: Stable boundaries / typed contract
Seeded issue: The rule contract is still under-specified. `ApplyDiscountsOptions.rules` is `List[Callable]` and `AppliedDiscount` is `TypedDict(total=False)`, so custom rules can omit required fields and still satisfy the type surface.
Expected owner: Programmer
Expected severity: Medium
Expected signal: Tighten the rule callable type and make the returned discount shape fully required.
Evidence path: `src/types.py` — `AppliedDiscount`, `ApplyDiscountsOptions`, `DiscountRule`
False positive risk: Low

ID: SEED-1G
Category: Single responsibility
Seeded issue: `apply_discounts()` still validates input, computes subtotal, orchestrates rule execution, enforces the discount cap, assembles warnings, and formats the final result in one place. The core flow remains hard to reason about when rules or cap behavior change.
Expected owner: Programmer
Expected severity: Medium
Expected signal: Extract subtotal/cap orchestration into focused helpers and leave the top-level function as an orchestration shell.
Evidence path: `src/engine.py` — `apply_discounts()`
False positive risk: Low

ID: SEED-1H
Category: State leakage
Seeded issue: The shared `DEFAULT_RULES` module list is process-wide mutable state. Any code that appends, removes, or reorders rules mutates later behavior for unrelated callers and tests.
Expected owner: Programmer
Expected severity: Medium
Expected signal: Freeze the default registry or copy it defensively before use.
Evidence path: `src/rules.py` — `DEFAULT_RULES`
False positive risk: Low

ID: SEED-1I
Category: Test anti-patterns / missing adversarial coverage
Seeded issue: The tests never cover the split-line duplicate-SKU case or the rule-order-dependent cap behavior. The happy-path coverage makes the engine look more complete than it is.
Expected owner: Code Review
Expected severity: Required
Expected signal: Call out the missing adversarial cases and add explicit tests for them.
Evidence path: `tests/test_engine.py`
False positive risk: Low
