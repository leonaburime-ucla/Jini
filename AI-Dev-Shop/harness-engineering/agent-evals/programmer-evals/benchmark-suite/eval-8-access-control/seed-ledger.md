# Seed Ledger — Eval 8: Access Control Evaluator

Covers checklist items 13-18 plus 2 trick seeds.

---

## SEED-CL-13
- **Checklist Item:** 13. I/O shape
- **Source Skill:** implementation-guardrails, observability-implementation
- **Category:** I/O shape / N+1
- **Seeded issue:** The `canAccess` function calls `roleService.getRole(roleId)` inside a loop for every role the user has. If a user has 10 roles, that's 10 sequential service calls. Should use `roleService.getRoles(roleIds)` batch lookup.
- **Expected owner:** Programmer
- **Expected severity:** High
- **Expected signal:** Programmer batches role lookups
- **Evidence path:** `src/evaluator.py` — canAccess loop

## SEED-CL-14
- **Checklist Item:** 14. Resource bounds
- **Source Skill:** implementation-guardrails
- **Category:** Resource bounds
- **Seeded issue:** No limit on the number of roles a user can have. No timeout on role service calls. A user with 1000 roles causes 1000 sequential network calls with no timeout protection.
- **Expected owner:** Programmer
- **Expected severity:** High
- **Expected signal:** Programmer adds max roles or timeout
- **Evidence path:** `src/evaluator.py` — no limits

## SEED-CL-15
- **Checklist Item:** 15. Idempotency
- **Source Skill:** implementation-guardrails
- **Category:** Idempotency
- **Seeded issue:** `grantRole` appends to the user's role array without checking if the role is already present. Calling grantRole twice adds a duplicate entry. The spec explicitly requires idempotency. Also, each grant creates an audit log entry even for no-op grants, making audit logs noisy.
- **Expected owner:** Programmer
- **Expected severity:** High
- **Expected signal:** Programmer adds duplicate check before granting
- **Evidence path:** `src/evaluator.py` — grantRole function

## SEED-CL-16
- **Checklist Item:** 16. Concurrency safety
- **Source Skill:** coding-foundations, implementation-guardrails
- **Category:** Concurrency safety
- **Seeded issue:** A module-level `permissionCache` Map is populated during `canAccess` calls and read back for fast lookups. The cache is never invalidated when roles change. If `grantRole` is called, the cache still returns stale results until the process restarts. Also, concurrent async `canAccess` calls can write to the cache simultaneously.
- **Expected owner:** Programmer
- **Expected severity:** High
- **Expected signal:** Programmer removes or properly manages the cache
- **Evidence path:** `src/evaluator.py` — permissionCache Map

## SEED-CL-17
- **Checklist Item:** 17. Determinism
- **Source Skill:** coding-foundations, testable-design-patterns
- **Category:** Determinism
- **Seeded issue:** Audit log timestamps use `new Date()` directly instead of an injected clock. Tests that assert on audit log entries can't match exact timestamps without jest.useFakeTimers or an injectable clock, making test assertions either flaky or vacuous (toHaveBeenCalled without checking the timestamp value).
- **Expected owner:** Programmer
- **Expected severity:** Medium
- **Expected signal:** Programmer injects clock for audit timestamps
- **Evidence path:** `src/evaluator.py` — `new Date()` in grantRole/revokeRole

## SEED-CL-18
- **Checklist Item:** 18. Observability for effects
- **Source Skill:** observability-implementation, security-review
- **Category:** Observability
- **Seeded issue:** The effectful operations (grantRole, revokeRole) have NO logging at all — they silently modify state. The read-only operation (canAccess) console.logs every check with full user details. Observability is backwards: mutations are silent, reads are noisy.
- **Expected owner:** Programmer
- **Expected severity:** Medium
- **Expected signal:** Programmer adds logging to mutations, reduces noise on reads
- **Evidence path:** `src/evaluator.py` — logging pattern

## SEED-CL-TRICK-05
- **Checklist Item:** (trick) Copy-paste bug
- **Source Skill:** coding-foundations
- **Category:** Copy-paste logic error
- **Seeded issue:** The `canAccess` function has two permission check branches — one for explicit permissions and one for wildcard (`*`) permissions. The wildcard check was copy-pasted from the explicit check but has `&&` where it should have `||`. The explicit check correctly uses `role.actions.includes(action) && role.resources.includes(resourceType)`. The wildcard check uses `role.actions.includes('*') && role.resources.includes('*')` but should use `||` (a wildcard on EITHER actions OR resources should grant access, not require wildcard on BOTH).
- **Expected owner:** Programmer
- **Expected severity:** Critical
- **Expected signal:** Programmer catches the `&&` vs `||` bug
- **Evidence path:** `src/evaluator.py` — wildcard permission check

## SEED-CL-TRICK-06
- **Checklist Item:** (trick) Off-by-one / boundary error
- **Source Skill:** implementation-guardrails
- **Category:** Boundary error
- **Seeded issue:** The `revokeRole` function uses `userRoles.splice(userRoles.indexOf(roleId), 1)`. If roleId is not found, indexOf returns -1, and `splice(-1, 1)` removes the LAST element — silently revoking the wrong role. The spec says revoking a non-existent role should be a no-op.
- **Expected owner:** Programmer
- **Expected severity:** Critical
- **Expected signal:** Programmer checks indexOf result before splicing
- **Evidence path:** `src/evaluator.py` — revokeRole splice
