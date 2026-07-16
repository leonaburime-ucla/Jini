# Retry Queue — Project Brief

## Overview

The partner integration pipeline processes payment and fulfillment messages
from external partners via a partitioned queue. This change ships the retry
queue worker from prototype to production hardened delivery.

## Operational Context

- Partners: each partner has a documented replay window (up to 3600s) during
  which they may redeliver the same message with the same idempotency key
- Infrastructure: 4 worker pods, deployed via rolling update 2-3x daily;
  each deploy triggers a consumer group rebalance
- Downstream services: occasional outages lasting 2-30 minutes; shared
  partner outages affect all tenants simultaneously
- Message types: some messages are permanently malformed (schema drift,
  encoding corruption) and will never succeed regardless of retries
- Scale: ~2000 messages/minute at peak across partitions

## Requirements

1. Transient downstream failures retry with exponential backoff, capped delay,
   and jitter to avoid thundering herd on shared outages.
2. Idempotency keys prevent duplicate side effects across the full partner
   replay window, including delayed retries and queue redelivery.
3. Permanently malformed messages are quarantined to a dead-letter sink
   without blocking the partition or consuming retry budget.
4. Partition rebalances during deploys must not allow both the old and new
   consumer to execute the same side effect.
5. Backpressure limits resource consumption during sustained downstream
   outages so workers remain stable.
6. Dead-letter threshold tracking must survive deployments so poison messages
   do not receive fresh retry budgets.
7. Error classification correctly distinguishes retryable transient failures
   from deterministic permanent failures.

## Spec Hash

`spec-retry-queue-v2-d83fa7`
