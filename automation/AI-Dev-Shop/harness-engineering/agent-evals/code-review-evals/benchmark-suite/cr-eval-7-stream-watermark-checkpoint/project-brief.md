# Stream Watermark Checkpoint — Project Brief

## Overview

Our IoT analytics platform ingests sensor telemetry from hundreds of
edge gateways. This change ships the stream processing layer that
reduces raw events into sub-minute aggregation windows for the
real-time dashboard. The goal is lower aggregation latency while
maintaining exactly-once output delivery to the downstream warehouse.

## Operational Context

- Sources: ~400 IoT edge gateways across 12 regional deployments,
  publishing to a partitioned message bus (32 partitions).
- Throughput: 50k events/sec aggregate; partitions have highly variable
  rates — some sensors disconnect for minutes then burst-replay buffered
  data.
- Deploys: rolling restart 2x/day; workers are reassigned partitions via
  consumer-group rebalance during deploys.
- Late data: disconnected sensors reconnect after minutes or hours and
  replay buffered readings. Late arrivals within a tolerance window
  should still be included in aggregations. Data arriving beyond that
  tolerance must be routed to a late-event sink for offline
  reconciliation — it must not vanish.
- Delivery: downstream warehouse expects exactly-once semantics. Duplicate
  or missing window outputs break billing reconciliation.
- Windows: tumbling 60-second aggregation windows; the team wants
  sub-minute end-to-end latency from window close to output delivery.

## Requirements

1. Aggregate sensor values into 60-second tumbling windows per partition.
2. Multiple partitions with variable throughput must be supported; a
   slow partition must not block other partitions indefinitely.
3. Late events within the allowed lateness tolerance are aggregated into
   the correct window.
4. Late events beyond the tolerance must be sent to the late-event sink
   with full metadata for reconciliation.
5. Window outputs must be delivered exactly once — a crash should not
   cause a window to be output twice or lost entirely.
6. During worker rebalance (deploy), ownership changes must be handled
   cleanly so that output is not duplicated or lost.
7. Aggregation windows must close correctly at boundaries even during
   replay and backfill from reconnected sensors.

## Spec Hash

`spec-stream-watermark-v2-d4f81a`
