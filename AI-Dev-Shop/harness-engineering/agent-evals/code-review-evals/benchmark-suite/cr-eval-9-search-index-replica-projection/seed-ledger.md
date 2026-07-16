# Seed Ledger — cr-eval-9-search-index-replica-projection (v2 rewrite)

**Eval ID**: benchmark-suite / cr-eval-9-search-index-replica-projection
**Purpose**: Test Code Review agent on projection ordering, tombstone
durability, alias cutover, backfill schema drift, tenant routing, reindex
snapshot consistency, and feature flag split-brain defects in an
event-stream-fed search index serving multi-tenant workloads.
**Difficulty**: Hard staff+ fixture. Brief describes operational context only.

## Seeds

### SEED-CR-55

Version gate uses >= instead of >. Same-version replay overwrites current
state with potentially stale fields. The correct strict-greater-than
semantics exist in `VersionGatedWriter.should_apply` but
`SearchProjection.apply_event` uses its own inline `>=` check.

Evidence: `src/search_projection.py` (`SearchProjection.apply_event` —
`event.version >= current.version` on the upsert path).
Expected severity: Critical

### SEED-CR-56

Tombstoned documents resurrected by late update/backfill with higher
version. No tombstone durability check before apply. A non-delete event
with version higher than the tombstone version blindly overwrites the
tombstone, bringing a deleted document back to life.

Evidence: `src/search_projection.py` (`SearchProjection.apply_event` —
upsert/backfill path does not check `current.tombstoned`).
Expected severity: Critical

### SEED-CR-57

Alias cutover swaps without calling readiness check. `AliasManager.swap_alias`
accepts `target_version` and `expected_shards` parameters and logs them
but never calls `self.lag_monitor.ready_for_cutover(...)`. Partial shards
still behind serve stale results during cutover.

Evidence: `src/search_projection.py` (`AliasManager.swap_alias` — no call
to `ready_for_cutover` despite having the lag_monitor reference).
Expected severity: Major

### SEED-CR-58

Backfill uses static field allowlist that drops newer schema fields.
`BackfillMapper.PROJECTION_FIELDS` is a hardcoded tuple omitting fields
added after original deployment (e.g. `tags`, `category`). Schema drift
causes silent data loss on backfill.

Evidence: `src/search_projection.py` (`BackfillMapper.PROJECTION_FIELDS`
and `BackfillMapper.project`).
Expected severity: Major

### SEED-CR-59

Null tenant_id falls back to shared "default" shard routing instead of
rejecting. `SearchProjection.apply_event` uses `event.tenant_id or "default"`
when tenant context is missing, co-mingling untenanted documents with the
default-tenant's data at the storage layer.

Evidence: `src/search_projection.py` (`SearchProjection.apply_event` —
`tenant_id = event.tenant_id or "default"`).
Expected severity: Critical

### SEED-CR-60

Reindex job paginates with cursor but no snapshot isolation. Concurrent
writes cause documents skipped or duplicated during reindex.
`ReindexJob.run` uses cursor-based pagination (document_id > last_seen)
without a snapshot or read lock — rows shifting across page boundaries
during concurrent writes produce gaps and duplicates.

Evidence: `src/search_projection.py` (`ReindexJob.run` — no snapshot
acquisition before pagination loop).
Expected severity: Critical

### SEED-CR-61

Feature flag enables writes to new index for all tenants but one tenant
class still reads from old. `FeatureFlagRouter.resolve_read_index` only
switches to new index for `standard` class tenants. Enterprise tenants
continue reading from the old index while their writes go to the new one.
Data appears lost for those tenants during rollout.

Evidence: `src/search_projection.py` (`FeatureFlagRouter.resolve_write_index`
vs `FeatureFlagRouter.resolve_read_index`).
Expected severity: Major

## Negative Controls

### SEED-CR-NC-13

`VersionGatedWriter` correctly implements strict greater-than
(`incoming_version > current_version`). Looks overly strict — rejecting
same-version events that might carry updates — but is correct. Same-version
replays are idempotent skips by design. The real bug is that
`SearchProjection` uses its own inline `>=` check instead of this helper.

Evidence: `src/search_projection.py` (`VersionGatedWriter.should_apply`)
and tests (`test_version_gated_writer_skips_same_version`).

### SEED-CR-NC-14

`TenantShardValidator` correctly rejects writes whose tenant is not
assigned to the shard. Looks like it blocks valid writes but is correct
storage-level isolation. The real bug is in the routing/fallback path
(`tenant_id or "default"`), not in this write validator.

Evidence: `src/search_projection.py` (`TenantShardValidator.allows`) and
tests (`test_tenant_shard_validator_rejects_wrong_shard`).

## Scoring Guide

| Score | Criteria |
|-------|----------|
| CAUGHT | CR identifies the seeded issue and its production consequence with correct severity. |
| CAUGHT_WRONG_SEVERITY | CR identifies the issue but misjudges severity by one+ level. |
| PARTIAL | CR identifies a related concern but misses the causal chain. |
| MISSED | CR does not flag the issue. |
| FALSE_POSITIVE | CR flags a negative-control behavior as a defect. |
