# Seed Ledger — cr-eval-10-billing-usage-reconciliation

**Eval ID**: benchmark-suite / cr-eval-10-billing-usage-reconciliation
**Purpose**: Tier 2 hard-mode Code Review fixture for weak-spec review of a
multi-tenant billing usage reconciliation worker.
**Difficulty**: Hard staff+ fixture. The brief gives business and operational
signals without naming the invariants.

## Seeds

### SEED-CR-62

Usage metering converts `Decimal` quantity and unit price into a Python `float`
before aggregation. The later decimal quantization hides cent-level drift until
high-volume tenant invoices reconcile across hundreds of thousands of events.

Evidence: `src/billing_reconciliation.py` (`UsageMeter.record` stores
`billable_amount` as `float(quantity) * float(unit_price)`).
Expected severity: Required

### SEED-CR-63

Reconciliation prices usage with the current plan rather than the plan epoch
carried by the rated usage window. Mid-cycle plan changes can reprice older
usage under the new contract epoch.

Evidence: `src/billing_reconciliation.py` (`ReconciliationEngine.reconcile`
calls `PlanCache.current_plan` while `RatedUsage.plan_epoch` is available).
Expected severity: Required

### SEED-CR-64

Credit application debits balance before appending the ledger entry and audit
record. A crash after the balance mutation but before durable event recording
creates a reconciliation window where credits appear unused or vanish from the
audit trail.

Evidence: `src/billing_reconciliation.py` (`CreditLedger.apply_credit`).
Expected severity: Critical

### SEED-CR-65

Reconciliation cursor claim is a check-then-mark sequence. Multiple collectors
can claim the same tenant/hour window before either marks it processed and both
write invoice adjustments.

Evidence: `src/billing_reconciliation.py` (`ReconciliationCursor.claim_window`
and `ReconciliationEngine.reconcile`).
Expected severity: Critical

### SEED-CR-66

Rate-limit enforcement reads only completed hourly aggregation totals. Burst
usage can exceed the contract ceiling for the current hour before aggregation
updates the source used by enforcement.

Evidence: `src/billing_reconciliation.py` (`RateLimitEnforcer.check` uses
`HourlyAggregator.tenant_usage`).
Expected severity: Required

### SEED-CR-67

Tenant tax profile cache is keyed by `(region, product_code)`, omitting tenant.
One tenant's exemption profile can be reused for another tenant in the same
region/product.

Evidence: `src/billing_reconciliation.py` (`TaxProfileStore.profile_for`).
Expected severity: Critical

## Negative Controls

### SEED-CR-NC-15

`CreditLedger.reserve_under_lock` performs a double read, but both reads happen
inside the tenant advisory lock. It should not be flagged as a TOCTOU bug. The
real credit issue is the non-transactional mutation/event boundary in
`apply_credit`.

Evidence: `src/billing_reconciliation.py` (`TenantLockRegistry` and
`CreditLedger.reserve_under_lock`).

### SEED-CR-NC-16

`HourlyAggregator._flush_bucket` uses `Decimal` accumulation and explicit money
quantization. This is correct and should not be flagged as unnecessary
complexity. The precision bug is upstream in `UsageMeter.record`.

Evidence: `src/billing_reconciliation.py` (`HourlyAggregator._flush_bucket`).

## Scoring Guide

| Score | Criteria |
|-------|----------|
| CAUGHT | CR identifies the seeded issue and its production consequence with correct severity. |
| CAUGHT_WRONG_SEVERITY | CR identifies the issue but misjudges severity by one+ level. |
| PARTIAL | CR identifies a related concern but misses the causal chain. |
| MISSED | CR does not flag the issue. |
| FALSE_POSITIVE | CR flags a negative-control behavior as a defect. |
