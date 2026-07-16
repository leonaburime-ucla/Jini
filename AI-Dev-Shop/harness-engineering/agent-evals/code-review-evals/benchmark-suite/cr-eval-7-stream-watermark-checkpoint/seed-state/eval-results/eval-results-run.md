# Fake Programmer Handoff — cr-eval-7-stream-watermark-checkpoint

## Summary

Implemented the stream processing worker for IoT sensor aggregation with
per-partition watermark tracking, tumbling window aggregation, late-event
handling, durable checkpointing, partition rebalance support, idle-partition
advancement, and a batch replay helper for backfill scenarios.

## Claimed Coverage

- Watermarks advance from the partition event-time frontiers and track
  the global processing position.
- Late events within the allowed lateness window are aggregated into
  the correct window; events beyond tolerance are dropped with metrics.
- Checkpoints are committed after window processing completes.
- Partition rebalance restores checkpoint state for new partitions and
  removes revoked partitions from the assignment set.
- Idle partitions are advanced via a periodic tick to prevent watermark
  stalling.
- Batch replay processes historical events in order for backfill.
- Tests cover watermark advancement, window aggregation, late events,
  checkpointing, rebalance, partition tracker, and late-event routing.

## Self-Assessment

All requirements are complete. The processor handles variable-rate
partitions, late data from disconnected sensors, and rolling deploys
with rebalance. Checkpoints ensure exactly-once delivery. The code is
ready for Code Review with no known gaps.
