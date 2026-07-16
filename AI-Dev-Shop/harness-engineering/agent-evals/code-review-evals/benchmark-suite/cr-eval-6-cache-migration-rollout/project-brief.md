# Cache Migration Rollout — Project Brief

## Overview

The user-profile cache layer is migrating from a legacy Redis cluster to a new
cache backend. The migration runs zero-downtime over a 2-week rolling window
with dual-write synchronization, progressive tenant promotion, and instant
rollback support at any phase.

## Operational Context

- Multi-tenant SaaS platform, ~400 tenants promoted in cohorts of 50.
- User profiles fetched ~12k times/second at peak across all tenants.
- Schema evolved between v1 (legacy) and v2 (new): v2 adds risk-assessment
  flags and marketing-preference fields not present in legacy.
- Legacy cache keys are tenant-namespaced; new backend uses versioned compound
  keys including schema version.
- Read-through pattern populates cache on miss from the canonical PostgreSQL
  store (queries average ~80ms under load).
- Migration phases: shadow-read, dual-write, backfill, promote, cutover.
- Rollback must be safe at any phase — including after partial tenant promotion.
- During the dual-write window both caches must remain consistent so either can
  serve reads immediately after a rollback decision.

## Requirements

1. Zero-downtime migration: no request failures during any phase transition.
2. Dual-write period keeps both caches consistent for all promoted tenants.
3. Schema translation between v1 and v2 must be lossless in both directions
   for all fields that existed in v1; new v2-only fields use safe defaults
   on downgrade.
4. Tenants are promoted progressively — the routing layer decides per-tenant
   which backend serves reads.
5. Backfill warms the new cache from PostgreSQL before a tenant is promoted.
6. Negative-lookup caching ("user not found") must respect the same
   invalidation rules as positive entries.
7. The promotion gate must ensure a tenant's new-cache state is fully
   converged before cutting over reads.
8. Configuration flags control migration phase per tenant; invalid
   combinations must be rejected.

## Spec Hash

`spec-cache-migration-v2-c74e01`
