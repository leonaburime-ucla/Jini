# Seed Ledger — cr-eval-6-cache-migration-rollout

**Eval ID**: benchmark-suite / cr-eval-6-cache-migration-rollout
**Purpose**: Test Code Review agent on cache-migration defects involving stale
repopulation races, schema translation data loss, consent-default violations,
configuration validation gaps, premature promotion, and negative-cache
invalidation failures — without the brief naming the invariants.
**Difficulty**: Hard staff+ fixture. Brief describes operational context only.

## Seeds

### SEED-CR-34

Read-through cache population writes data without checking the current cache
generation. A slow PostgreSQL query that started before a fresh write completes
after it, overwriting the fresh value with stale generation-0 data.

Evidence: `src/cache_migration.py` (`CacheMigrationRouter.repopulate_legacy_cache`
— sets value unconditionally without comparing generation counters).
Expected severity: Critical

### SEED-CR-35

The v2-to-v1 schema translator omits the `risk_flags` field when downgrading
a profile for legacy cache storage. A rollback after promotion loses
safety-sensitive risk-assessment data that was written during the dual-write
period.

Evidence: `src/cache_migration.py` (`SchemaTranslator.v2_to_v1` — builds v1
dict without including `risk_flags`).
Expected severity: Critical

### SEED-CR-36

The v1-to-v2 schema translator defaults the `marketing_opt_in` field to `True`
when the field is absent in the v1 record. A user who never consented is
treated as opted-in after upgrade — a GDPR consent violation.

Evidence: `src/cache_migration.py` (`SchemaTranslator.v1_to_v2` — defaults
`marketing_opt_in` to `True`).
Expected severity: Critical

### SEED-CR-37

Tenant migration configuration flags (`read_new`, `write_v2`, `dual_write`,
`backfill_running`) are independent booleans with no mutual-exclusion
validation. The combination `dual_write=True` with `write_v2=False` is
accepted silently but results in writes only reaching legacy — the new cache
diverges without any error signal.

Evidence: `src/cache_migration.py` (`TenantMigrationConfig` dataclass — no
validation of flag combinations).
Expected severity: Major

### SEED-CR-38

Tenant promotion only checks the `backfill_complete` flag. It does not verify
that the new cache generation has converged with the latest writes. A tenant
can be promoted while the new cache still serves data from an earlier
generation — missing any writes that occurred after backfill started.

Evidence: `src/cache_migration.py` (`MigrationController.promote_tenant` —
checks `backfill_complete` but not generation convergence).
Expected severity: Major

### SEED-CR-39

Negative cache entries (tombstones for "user not found") written to legacy
cache are never invalidated when a user is subsequently created in the new
system. The stale tombstone persists and serves 404s for a user who now exists.

Evidence: `src/cache_migration.py` (`CacheMigrationRouter.get_profile` —
negative entry check does not verify creation timestamp against tombstone age).
Expected severity: Major

## Negative Controls

### SEED-CR-NC-01

`versioned_cache_key` builds a compound key incorporating schema version,
tenant ID, and user ID. This looks like redundant complexity but is necessary
for cache isolation across schema versions during the migration. The actual
bug is in `repopulate_legacy_cache` which bypasses this key format.

Evidence: `src/cache_migration.py` (`versioned_cache_key` function).

### SEED-CR-NC-02

`DualWriteCompatibilityShim.write_profile` writes the full profile to both
legacy and new cache on every mutation. This appears to be wasteful duplicate
work but is required to maintain rollback safety during the dual-write window.
Both copies must stay in sync.

Evidence: `src/cache_migration.py` (`DualWriteCompatibilityShim.write_profile`).

## Scoring Guide

| Score | Criteria |
|-------|----------|
| CAUGHT | CR identifies the seeded issue and its production consequence with correct severity. |
| CAUGHT_WRONG_SEVERITY | CR identifies the issue but misjudges severity by one+ level. |
| PARTIAL | CR identifies a related concern but misses the causal chain. |
| MISSED | CR does not flag the issue. |
| FALSE_POSITIVE | CR flags a negative-control behavior as a defect. |
