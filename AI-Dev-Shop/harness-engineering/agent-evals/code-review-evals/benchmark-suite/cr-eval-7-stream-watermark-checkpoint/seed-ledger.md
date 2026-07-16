# Seed Ledger — cr-eval-7-stream-watermark-checkpoint

**Eval ID**: benchmark-suite / cr-eval-7-stream-watermark-checkpoint
**Purpose**: Test Code Review agent on stream processing defects involving
watermark advancement, late-event routing, checkpoint ordering, rebalance
state management, clock-source mixing, and window boundary precision —
without the brief naming the invariants.
**Difficulty**: Hard staff+ fixture. Brief describes operational context only.

## Seeds

### SEED-CR-41

Global watermark uses max() across partitions instead of min(). Fast
partition advances past slow ones, causing premature window closure and
data loss for the lagging partition.

Evidence: `src/stream_watermarks.py` (`StreamProcessor._advance_global_watermark`
— uses `max(self._partition_watermarks.values())` instead of `min()`).
Expected severity: Critical

### SEED-CR-42

Late events beyond allowed lateness are silently dropped — counter
incremented but never routed to late-event sink. Data vanishes without
trace.

Evidence: `src/stream_watermarks.py` (`StreamProcessor.process_event` —
`self._metrics.record_late_drop()` but no call to late-event router).
Expected severity: Major

### SEED-CR-43

Checkpoint committed BEFORE sink emission. Crash between checkpoint
commit and output delivery loses output permanently — downstream sees
no result but position is advanced past the window.

Evidence: `src/stream_watermarks.py` (`StreamProcessor._flush_closed_windows`
— `self._checkpoint.commit(...)` precedes `self._sink.emit(...)`).
Expected severity: Critical

### SEED-CR-44

Rebalance loads new partition checkpoints but doesn't purge active
windows for revoked partitions. Stale windows flush duplicates on
the next flush cycle.

Evidence: `src/stream_watermarks.py` (`StreamProcessor.on_partitions_reassigned`
— adds new partitions, does not remove old window state).
Expected severity: Critical

### SEED-CR-45

One code path uses wall-clock time to advance watermark while rest
uses event timestamps. Incorrect window closure under replay/backfill
when wall-clock is far ahead of event time.

Evidence: `src/stream_watermarks.py` (`StreamProcessor._maybe_advance_idle`
— uses `self._clock()` to advance partition watermark instead of only
using it for idle detection).
Expected severity: Critical

### SEED-CR-46

Window boundary off-by-one: events exactly AT window boundaries are
excluded from aggregation. The guard `window_start < event_time < window_end`
uses strict less-than on the lower bound, so when `event_time` is exactly
divisible by `window_size`, `_assign_window` floors to `window_start =
event_time`, and the guard `window_start < event_time` is false. The event
is silently discarded.

Evidence: `src/stream_watermarks.py` (`StreamProcessor._aggregate_event` and
`_aggregate_late_within_tolerance` — strict inequality `window_start <
event.event_time < window_end` silently returns when event_time equals
window_start).
Expected severity: Major

## Negative Controls

### SEED-CR-NC-01

`PartitionWatermarkTracker` correctly uses per-partition max and global
min — looks like the same logic as StreamProcessor's max() but is
actually the CORRECT implementation. Correct review should not misflag
the partition-local max update as the global max-watermark defect.

Evidence: `src/stream_watermarks.py` (`PartitionWatermarkTracker.global_watermark`
— correctly returns `min(active_watermarks)`).

### SEED-CR-NC-02

`LateEventRouter` correctly routes beyond-window events to sink with
metadata — looks like data loss but is correct late-event handling.
Correct review should not misflag routing to the late sink as silent
data discard.

Evidence: `src/stream_watermarks.py` (`LateEventRouter.route_late_event`
— publishes full event metadata to `self._sink`).

## Scoring Guide

| Score | Criteria |
|-------|----------|
| CAUGHT | CR identifies the seeded issue and its production consequence with correct severity. |
| CAUGHT_WRONG_SEVERITY | CR identifies the issue but misjudges severity by one+ level. |
| PARTIAL | CR identifies a related concern but misses the causal chain. |
| MISSED | CR does not flag the issue. |
| FALSE_POSITIVE | CR flags a negative-control behavior as a defect. |
