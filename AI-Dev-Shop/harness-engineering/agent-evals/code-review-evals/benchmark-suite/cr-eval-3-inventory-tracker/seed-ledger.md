# Seed Ledger — cr-eval-3-inventory-tracker (v2 rewrite)

**Eval ID**: benchmark-suite / cr-eval-3-inventory-tracker
**Purpose**: Test Code Review agent on inventory reservation and transfer
defects involving stale read models, lost updates, non-atomic operations,
narrow idempotency keys, shared mutable module state, and silent data masking
— without the brief naming the invariants.
**Difficulty**: Hard staff+ fixture. Brief describes operational context only.

## Seeds

### SEED-CR-13

`reserve()` checks the eventually-consistent read model for availability but
mutates the store without compare-and-swap. Two concurrent workers both pass
the stale check and oversell because the read model snapshot is never
refreshed between the availability guard and the store decrement.

Evidence: `src/inventory_tracker.py` (`InventoryTracker.reserve` — the
`self.read_model.available()` guard followed by direct `record.available -=`
with no CAS or version check on the store record).
Expected severity: Critical

### SEED-CR-14

Two concurrent reservations read the same stale projected value from the read
model, both pass the availability check, and both decrement the store's
`available` field. No optimistic locking or version check prevents the second
writer from overselling. The `version` field on `InventoryRecord` exists but
is never checked or incremented.

Evidence: `src/inventory_tracker.py` (`InventoryTracker.reserve` — no
`record.version` assertion before mutation; `InventoryRecord.version` field
defined but unused).
Expected severity: Critical

### SEED-CR-15

`release_reservation()` decrements `record.reserved` and then increments
`record.available` as two separate field assignments. If an exception or crash
occurs between the two mutations the reserved count is reduced but available
is never restored — inventory is permanently lost.

Evidence: `src/inventory_tracker.py` (`InventoryTracker.release_reservation` —
sequential assignments `record.reserved -= ...` then `record.available += ...`).
Expected severity: Major

### SEED-CR-16

`transfer()` debits the source warehouse before crediting the destination. If
the destination `get_or_raise` call raises (record missing, network partition
in a real persistence layer), the source has already been debited with no
rollback or compensation. Stock vanishes permanently.

Evidence: `src/inventory_tracker.py` (`InventoryTracker.transfer` —
`source.available -= request.quantity` before the destination lookup).
Expected severity: Critical

### SEED-CR-17

`_adjustment_idempotency_key()` produces `tenant:adjustment_id:sku`. Two
legitimate adjustments sharing the same external `adjustment_id` and SKU but
targeting different warehouses or carrying different reason codes collide.
The second adjustment is silently dropped as a "duplicate."

Evidence: `src/inventory_tracker.py`
(`InventoryTracker._adjustment_idempotency_key`).
Expected severity: Major

### SEED-CR-18

`DEFAULT_CLOCK` and `CURRENT_TENANT` are module-level mutable singletons used
as fallbacks when constructor arguments are omitted. In a multi-worker process
or test suite, any mutation to `DEFAULT_CLOCK` (e.g., `advance()`) or
reassignment of `CURRENT_TENANT` leaks between all tracker instances that did
not inject their own values.

Evidence: `src/inventory_tracker.py` (module-level `DEFAULT_CLOCK` and
`CURRENT_TENANT`; `InventoryTracker.__init__` fallback logic).
Expected severity: Major

## Negative Controls

### SEED-CR-NC-01

The `ManualClock` class is mutable and injected into `InventoryTracker`. This
looks like hidden mutable state, but it is actually correct dependency
injection for deterministic testing. The real bug is the *fallback* to the
module-level `DEFAULT_CLOCK`, not the injection mechanism itself. A correct
review should NOT flag the injected clock pattern as a defect.

Evidence: `src/inventory_tracker.py` (`ManualClock` dataclass and its use via
`clock=clock` in `__init__`); `tests/test_inventory_tracker.py`
(`TestClockInjection` class).

### SEED-CR-NC-02

The `reconcile()` method walks all warehouse records for a SKU using
`list_by_sku()`. This looks expensive (O(n) scan), but is correct for its
weekly batch purpose during low-traffic windows. The real bug is that it
silently zeros negatives instead of surfacing the oversell to operators. A
correct review should NOT flag the iteration pattern as a performance defect.

Evidence: `src/inventory_tracker.py` (`InventoryTracker.reconcile` — the
`for record in records` loop).

## Scoring Guide

| Score | Criteria |
|-------|----------|
| CAUGHT | CR identifies the seeded issue and its production consequence with correct severity. |
| CAUGHT_WRONG_SEVERITY | CR identifies the issue but misjudges severity by one+ level. |
| PARTIAL | CR identifies a related concern but misses the causal chain. |
| MISSED | CR does not flag the issue. |
| FALSE_POSITIVE | CR flags a negative-control behavior as a defect. |
