# Seed Ledger — cr-eval-8-webhook-signature-rotation

**Eval ID**: benchmark-suite / cr-eval-8-webhook-signature-rotation
**Purpose**: Test Code Review agent on webhook signature verification defects
involving tenant routing bypass, replay protection gaps, key rotation logic,
and payload canonicalization — without the brief naming the invariants.
**Difficulty**: Hard staff+ fixture. Brief describes operational context only.

## Seeds

### SEED-CR-48

Tenant routing falls back to an unsigned JSON body field when the
header-extracted `route_tenant_id` is empty. An attacker can craft the
request body with a victim's tenant_id, bypassing the signed routing
metadata. The signature covers the raw body bytes, but the routing decision
trusts a parsed field that the attacker controls.

Evidence: `src/webhook_rotation.py` (`WebhookGateway._resolve_tenant` —
fallback to `payload.get("tenant_id")` when header value is empty).
Expected severity: Critical

### SEED-CR-49

Nonce cache key is constructed from the raw nonce value alone, omitting
tenant_id and provider. Two different tenants receiving webhooks with the
same nonce value (legitimate for different providers) will collide, causing
one to be falsely rejected as a replay.

Evidence: `src/webhook_rotation.py` (`NonceStore.check_and_store` — key is
just the nonce string without namespace).
Expected severity: Critical

### SEED-CR-50

Timestamp tolerance check uses `abs()`, accepting timestamps arbitrarily far
in the future. Combined with the nonce TTL equaling the tolerance window, an
attacker can send a future-dated payload whose nonce expires from the cache
before the timestamp becomes "current" — enabling deferred replay.

Evidence: `src/webhook_rotation.py` (`WebhookGateway._check_timestamp` —
`abs(now - ts) <= self.config.timestamp_tolerance`).
Expected severity: Major

### SEED-CR-51

Legacy signing key is accepted whenever it is configured — there is no grace
period boundary check. The rotation window has no expiration, so a
compromised old key remains valid indefinitely as long as the configuration
entry exists.

Evidence: `src/webhook_rotation.py` (`SignatureVerifier.verify` — tries
legacy key with no `grace_deadline` check).
Expected severity: Critical

### SEED-CR-52

The verifier always re-serializes the JSON payload (sorted keys, compact
separators) instead of using the raw request bytes. Providers sign the raw
HTTP body — canonicalization changes whitespace, key ordering, or Unicode
escaping, causing intermittent signature mismatches on valid webhooks.

Evidence: `src/webhook_rotation.py` (`SignatureVerifier._compute_signature` —
`json.dumps(payload, sort_keys=True, separators=...)`).
Expected severity: Major

### SEED-CR-53

The nonce is marked as consumed (stored in cache) BEFORE signature
verification succeeds. An attacker can burn a valid nonce by submitting a
request with the correct nonce but an invalid signature. When the real
webhook arrives, it is rejected as a replay. This enables denial-of-service
against specific webhook deliveries.

Evidence: `src/webhook_rotation.py` (`WebhookGateway.process_webhook` —
`nonce_store.check_and_store` called before `verifier.verify`).
Expected severity: Critical

### SEED-CR-54

When multiple `X-Signature` headers are present, the code takes the first
match without validating its format. A crafted header value (e.g., empty
string or malformed prefix) can cause the HMAC comparison to succeed against
an empty digest, bypassing signature verification entirely.

Evidence: `src/webhook_rotation.py` (`WebhookGateway._extract_signature` —
takes `headers["X-Signature"]` first element, no format validation).
Expected severity: Critical

### SEED-CR-NC-01

The `constant_time_compare` helper uses `hmac.compare_digest` correctly for
signature comparison. While the code path around it may look like it has a
timing side-channel (early return on length check is in the stdlib
implementation), the actual comparison is constant-time and safe.

Evidence: `src/webhook_rotation.py` (`constant_time_compare` function).

### SEED-CR-NC-02

`DualKeyGraceVerifier` correctly rejects the legacy key after the grace
period expires. Its structure looks similar to the broken `verify()` method
in `SignatureVerifier`, but it properly checks `datetime.utcnow() <=
grace_deadline` before attempting the legacy key. Do not misflag as having
the same rotation vulnerability.

Evidence: `src/webhook_rotation.py` (`DualKeyGraceVerifier.verify`).

## Scoring Guide

| Score | Criteria |
|-------|----------|
| CAUGHT | CR identifies the seeded issue and its production consequence with correct severity. |
| CAUGHT_WRONG_SEVERITY | CR identifies the issue but misjudges severity by one+ level. |
| PARTIAL | CR identifies a related concern but misses the causal chain. |
| MISSED | CR does not flag the issue. |
| FALSE_POSITIVE | CR flags a negative-control behavior as a defect. |
