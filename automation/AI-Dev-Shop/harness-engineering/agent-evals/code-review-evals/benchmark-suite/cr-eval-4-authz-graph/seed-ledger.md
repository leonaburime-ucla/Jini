# Seed Ledger — cr-eval-4-authz-graph (v2 rewrite)

**Eval ID**: benchmark-suite / cr-eval-4-authz-graph
**Purpose**: Test Code Review agent on multi-tenant authorization graph defects
involving delegation traversal, cache coherence, policy parsing, and
time-of-check/time-of-use gaps — without the brief naming the invariants.
**Difficulty**: Hard staff+ fixture. Brief describes operational context only.

## Seeds

### SEED-CR-20

`_walk_delegations` traverses across tenant boundaries — no tenant filter on
delegation edges. Cross-tenant privilege escalation.

Evidence: `src/authz_graph.py` (`_walk_delegations` — frontier expansion does
not check `assignment.tenant_id` against `resource.tenant_id`).
Expected severity: Critical

### SEED-CR-21

Cache key is `(user_id, resource_id, permission)` — omits `tenant_id` and
`policy_version`. Stale grants survive revocation and policy changes.

Evidence: `src/authz_graph.py` (`_decision_cache_key` returns a 3-tuple
missing tenant and version components).
Expected severity: Critical

### SEED-CR-22

`PolicyEnvelope.from_payload` defaults missing `tenant_scope` to `"*"`
(wildcard) instead of denying. Fail-open on malformed policy.

Evidence: `src/authz_graph.py` (`PolicyEnvelope.from_payload` — `get` with
default `"*"`).
Expected severity: Critical

### SEED-CR-23

`_walk_delegations` has no depth/edge limit in the production path. DoS via
deep delegation graph.

Evidence: `src/authz_graph.py` (`_walk_delegations` — unbounded `while
frontier` loop vs. the safe `bounded_role_walk` helper).
Expected severity: Major

### SEED-CR-24

`revoke_assignment` does not invalidate cached positive decisions. Revoked
users retain access until cache expires.

Evidence: `src/authz_graph.py` (`revoke_assignment` — removes from
`self._assignments` but does not touch `self._decision_cache`).
Expected severity: Critical

### SEED-CR-25

Break-glass grant cached — expiry check runs inside direct evaluation but
cache returns before it can fire. Emergency access persists past time limit.

Evidence: `src/authz_graph.py` (`can_access` returns cached `True` before
`_has_direct_permission` re-checks `expires_at`; `grant_break_glass` sets
30-minute expiry but cached decision outlives it).
Expected severity: Major

### SEED-CR-26

TOCTOU — `can_access` returns `True`, resource fetched in separate call.
Revocation between the two still allows access.

Evidence: `src/authz_graph.py` (`fetch_resource` is a standalone call;
`can_access` result is not bound to a transaction or token that the resource
fetch validates).
Expected severity: Critical

## Negative Controls

### NC-01

`bounded_role_walk` has depth limits, visited tracking, and tenant filtering —
looks like `_walk_delegations` but is the SAFE version. The real bug is that
the production path uses the UNSAFE `_walk_delegations`.

Evidence: `src/authz_graph.py` (`bounded_role_walk` — explicit `max_depth`,
`max_edges`, and `tenant_id` filter on each edge).

### NC-02

Break-glass grant mechanism itself is correctly time-bound and audited — the
bug is the CACHE not respecting expiry, not the grant mechanism.

Evidence: `src/authz_graph.py` (`grant_break_glass` — sets `expires_at`,
requires `reason`, records audit entry).

## Scoring Guide

| Score | Criteria |
|-------|----------|
| CAUGHT | CR identifies the seeded issue and its production consequence with correct severity. |
| CAUGHT_WRONG_SEVERITY | CR identifies the issue but misjudges severity by one+ level. |
| PARTIAL | CR identifies a related concern but misses the causal chain. |
| MISSED | CR does not flag the issue. |
| FALSE_POSITIVE | CR flags a negative-control behavior as a defect. |
