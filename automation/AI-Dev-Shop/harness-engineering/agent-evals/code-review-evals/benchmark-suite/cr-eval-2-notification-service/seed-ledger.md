# Seed Ledger — cr-eval-2-notification-service (v2 rewrite)

**Eval ID**: benchmark-suite / cr-eval-2-notification-service
**Purpose**: Test Code Review agent on multi-channel notification dispatch
defects involving deduplication scope, provider failover idempotency, fallback
privacy enforcement, template cache boundaries, timezone handling, and PII
leakage — without the brief naming the invariants.
**Difficulty**: Hard staff+ fixture. Brief describes operational context only.

## Seeds

### SEED-CR-07

Dedup key uses only (user_id, notification_id) — omits tenant_id, channel,
provider. Cross-tenant collision suppresses legitimate sends.

Evidence: `src/notification_service.py` (`DeduplicationStore.build_key`).
Expected severity: Critical

### SEED-CR-08

Provider timeout treated as clean failure. Primary may have delivered, fallback
sends again with no shared idempotency fence between providers. Duplicate
delivery.

Evidence: `src/notification_service.py` (`NotificationDispatcher._attempt_send`
and `ProviderClient.deliver` timeout handling).
Expected severity: Critical

### SEED-CR-09

Privacy suppression checked only on original channel. Fallback to SMS bypasses
user's SMS suppression for that topic.

Evidence: `src/notification_service.py` (`NotificationDispatcher.dispatch` —
suppression check before fallback loop).
Expected severity: Major

### SEED-CR-10

Template cache keyed only on template_id — ignores locale and
content_sensitivity. Stale/wrong content served cross-locale.

Evidence: `src/notification_service.py` (`TemplateCache.get_rendered`).
Expected severity: Major

### SEED-CR-11

Quiet-hours enforcement uses server timezone (UTC) instead of user's configured
timezone. Notifications delivered at 3am user-local time.

Evidence: `src/notification_service.py` (`QuietHoursPolicy.is_in_quiet_hours`
— compares against UTC hour).
Expected severity: Major

### SEED-CR-12

Failed notification error log includes user's full email and phone number for
"debugging". PII leakage in logs.

Evidence: `src/notification_service.py` (`NotificationDispatcher._log_failure`).
Expected severity: Critical

### SEED-CR-NC-01

Exponential backoff with jitter in the provider retry loop — looks aggressive
but is correct. The real bug is the missing idempotency BETWEEN primary and
fallback, not the retry mechanism within one provider.

Evidence: `src/notification_service.py` (`RetryPolicy.next_delay`).

### SEED-CR-NC-02

Template cache invalidation on version bump IS correct — the bug is that LOCALE
isn't in the cache key, not that the cache invalidation itself is broken.

Evidence: `src/notification_service.py` (`TemplateCache.invalidate`).

## Scoring Guide

| Score | Criteria |
|-------|----------|
| CAUGHT | CR identifies the seeded issue and its production consequence with correct severity. |
| CAUGHT_WRONG_SEVERITY | CR identifies the issue but misjudges severity by one+ level. |
| PARTIAL | CR identifies a related concern but misses the causal chain. |
| MISSED | CR does not flag the issue. |
| FALSE_POSITIVE | CR flags a negative-control behavior as a defect. |
