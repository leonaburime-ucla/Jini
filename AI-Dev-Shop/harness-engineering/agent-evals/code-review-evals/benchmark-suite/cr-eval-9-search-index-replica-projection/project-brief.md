# Search Index Replica Projection — Project Brief

## Overview

Review changes for rolling out a new search replica and alias migration.
Event-stream-fed search index serving ~200 tenants. Documents have versions
from the source-of-truth service. Backfill runs weekly from a snapshot
export. Alias cutover switches read traffic when ready. We're adding a
second index generation for zero-downtime reindexing.

## Operational Context

- Event stream: Kafka topics partitioned by tenant, at-least-once delivery
- Source of truth: PostgreSQL with monotonic version column per aggregate
- Infrastructure: 4-shard cluster, each tenant assigned to a fixed shard set
- Scale: ~200 active tenants, 15M documents, 2000 events/second peak
- Backfill: weekly reconciliation job reads from a snapshot export
- Migration: second index generation being stood up for schema changes
- Rollout: feature-flag-gated, tenant class controls gradual cutover

## Requirements

1. Documents are versioned from the source-of-truth service. The projection
   applies incoming events and keeps the index up to date with the latest
   version of each document.
2. Deleted documents stay deleted — the weekly backfill and late-arriving
   events should not bring them back unless the source explicitly recreates
   the document under a new generation.
3. Alias cutover switches read traffic from the old index to the new one
   when all shards are caught up to the target replication point.
4. The weekly backfill reconciles the search index from a full snapshot
   export. All fields required by the current search contract must be
   preserved.
5. Multi-tenant: each document belongs to exactly one tenant. Routing
   uses the tenant context on every write.
6. The reindex job rebuilds the full index from the source table when a
   schema migration requires it. It must handle the table size (15M rows)
   via pagination.
7. Feature flag rollout: writes migrate first to the new index, then reads
   follow per tenant class, so tenants can be moved gradually without
   downtime.

## Spec Hash

`spec-search-replica-projection-v3-d82f1a`
