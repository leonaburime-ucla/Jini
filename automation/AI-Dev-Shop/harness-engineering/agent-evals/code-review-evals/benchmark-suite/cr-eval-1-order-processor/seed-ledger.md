# Seed Ledger — cr-eval-1-order-processor (v2 rewrite)

**Eval ID**: benchmark-suite / cr-eval-1-order-processor
**Purpose**: Test Code Review agent on order/payment saga defects involving
concurrent state mutation, crash-recovery gaps, event delivery reliability,
and compensation completeness — without the brief naming the invariants.
**Difficulty**: Hard staff+ fixture. Brief describes operational context only.

## Seeds

### SEED-CR-01

Payment capture executes before the idempotency record is durably committed.
A worker crash after capture but before recording the key causes a
double-charge on retry.

Evidence: `src/order_processor.py` (`OrderSaga.place_order` — capture call
precedes idempotency write).
Expected severity: Critical

### SEED-CR-02

Inventory reservation TTL (30s default) is shorter than the payment gateway
timeout (60s). A slow capture can confirm an order after inventory was
released to another customer.

Evidence: `src/order_processor.py` (`InventoryService.reserve` TTL vs
`PaymentGateway` timeout configuration).
Expected severity: Major

### SEED-CR-03

`cancel_order` refunds payment and releases inventory but does not reverse
promotion credits. The customer retains credits for a cancelled order.

Evidence: `src/order_processor.py` (`OrderSaga.cancel_order` — missing
`self.promotions.reverse_credit` call).
Expected severity: Major

### SEED-CR-04

`apply_gateway_event` unconditionally overwrites order state with no
terminal-state guard. A replayed `payment_captured` event can move a
refunded order back to confirmed.

Evidence: `src/order_processor.py` (`OrderSaga.apply_gateway_event` —
no check of current state before transition).
Expected severity: Critical

### SEED-CR-05

Cancel and payment-confirm webhook can arrive concurrently. Neither path
acquires a lock on order_id, so both can read state=CONFIRMED, both mutate,
and the final state depends on write ordering — potentially leaving the
order in an inconsistent state with refund issued but order still confirmed.

Evidence: `src/order_processor.py` (`cancel_order` and
`apply_gateway_event` — no locking or CAS on order state).
Expected severity: Critical

### SEED-CR-06

Saga events are emitted via `self.outbox.emit(event)` AFTER the database
transaction commits (called outside the transaction boundary in
`_finalize_order`). A crash between the DB commit and the emit call loses
the event permanently — downstream consumers never learn about the order.

Evidence: `src/order_processor.py` (`OrderSaga._finalize_order` — emit
call is after the context manager exits).
Expected severity: Major

### SEED-CR-NC-01

The retry-with-backoff wrapper around gateway calls (`RetryExecutor`) uses
exponential delay with jitter and has a configurable max-attempts limit.
This looks aggressive but is correct and necessary for the at-least-once
gateway. The bug is the missing idempotency KEY, not the retry mechanism.

Evidence: `src/order_processor.py` (`RetryExecutor`).

### SEED-CR-NC-02

The admin order lookup (`OrderStore.lookup_for_support`) is intentionally
cross-tenant — support staff need to search by order ID across all tenants.
This path is separately auth-gated (noted in docstring). Do not misflag as
a tenant isolation violation.

Evidence: `src/order_processor.py` (`OrderStore.lookup_for_support`).

## Scoring Guide

| Score | Criteria |
|-------|----------|
| CAUGHT | CR identifies the seeded issue and its production consequence with correct severity. |
| CAUGHT_WRONG_SEVERITY | CR identifies the issue but misjudges severity by one+ level. |
| PARTIAL | CR identifies a related concern but misses the causal chain. |
| MISSED | CR does not flag the issue. |
| FALSE_POSITIVE | CR flags a negative-control behavior as a defect. |
