# Seed Ledger — cr-eval-5-retry-idempotency-queue (v2 rewrite)

**Eval ID**: benchmark-suite / cr-eval-5-retry-idempotency-queue
**Purpose**: Test Code Review agent on retry, idempotency, poison-message,
rebalance, and backpressure defects that pass happy-path tests but cause
production failures under partner replay, sustained outages, and deploy
rebalances.
**Difficulty**: Hard staff+ fixture. Brief describes operational context only.

## Seeds

### SEED-CR-27

Retry delay calculation ignores max_delay_seconds cap and jitter_ratio.
Exponential without bound causes thundering herd on shared partner outages.

Evidence: `src/retry_queue.py` (`RetryPolicy.compute_delay` — computes
`base_delay * 2^attempt` but never applies `min(..., max_delay_seconds)` and
never adds jitter from `jitter_ratio`).
Expected severity: Major

### SEED-CR-28

Idempotency window (900s) shorter than partner documented replay window
(3600s). Duplicate side effects after key expires.

Evidence: `src/retry_queue.py` (`IdempotencyStore.__init__` — default
`window_seconds=900.0`) and `project-brief.md` (partners replay up to 3600s).
Expected severity: Critical

### SEED-CR-29

PermanentMessageError handler schedules retry instead of DLQ. Poison messages
loop infinitely.

Evidence: `src/retry_queue.py` (`PartitionConsumer._process_single` —
`except PermanentMessageError` branch calls `self._schedule_retry` instead
of `self.dlq.quarantine`).
Expected severity: Critical

### SEED-CR-30

Rebalance increments epoch but doesn't purge retry queue entries for revoked
partitions. Old consumer executes stale retries, duplicating side effects.

Evidence: `src/retry_queue.py` (`PartitionConsumer.on_rebalance` — updates
`self._epoch` and `self._assigned_partitions` but does not filter
`self._retry_heap`).
Expected severity: Critical

### SEED-CR-31

Backpressure pauses fetches but retry scheduling continues appending
unbounded. OOM during sustained outage.

Evidence: `src/retry_queue.py` (`PartitionConsumer._schedule_retry` — no
check of `self._backpressure.should_pause_retries()` or retry queue depth
before appending).
Expected severity: Major

### SEED-CR-32

Error classification maps 400 responses to "retryable" via substring match
on "service" in message. Deterministic failures retry infinitely against
healthy downstream.

Evidence: `src/retry_queue.py` (`ErrorClassifier.classify` — `"service" in
str(error).lower()` branch returns `ErrorClass.TRANSIENT` even for 400-level
responses containing "service" in the error description).
Expected severity: Critical

### SEED-CR-33

DLQ threshold keyed on consumer-group-id which changes on deploy. Poison
messages get fresh retry budget every deployment.

Evidence: `src/retry_queue.py` (`DeadLetterTracker.__init__` — keys on
`consumer_group_id`; `PartitionConsumer.__init__` — passes
`f"{service_name}-{instance_id}"` which rotates on deploy).
Expected severity: Major

## Negative Controls

### SEED-CR-NC-01

BackpressureMonitor's sliding-window pause logic correctly signals when
fetches should pause. The bug is it doesn't gate RETRY scheduling — but
the monitor class itself is correct.

Evidence: `src/retry_queue.py` (`BackpressureMonitor.should_pause_fetch`
and `should_pause_retries` — both methods are correctly implemented with
proper sliding window math).

### SEED-CR-NC-02

IdempotentReceiptCache returning prior receipt for duplicate keys is correct
dedup behavior. Do not misflag as skipped delivery or lost work.

Evidence: `src/retry_queue.py` (`IdempotentReceiptCache.get_or_create` —
returns cached receipt on second call for same key).

## Scoring Guide

| Score | Criteria |
|-------|----------|
| CAUGHT | CR identifies the seeded issue and its production consequence with correct severity. |
| CAUGHT_WRONG_SEVERITY | CR identifies the issue but misjudges severity by one+ level. |
| PARTIAL | CR identifies a related concern but misses the causal chain. |
| MISSED | CR does not flag the issue. |
| FALSE_POSITIVE | CR flags a negative-control behavior as a defect. |
