# Seed Ledger — Eval 4: Rate Limiter Cache

Rewritten against the current Python fixture on `2026-04-29`.
Seed IDs are retained for suite backfill compatibility.

ID: SEED-4A
Category: Concurrency safety
Seeded issue: The limiter closes over a shared `windows` dict with mutable per-client timestamp lists. The API is synchronous, but nothing protects that state if the limiter is used from multiple threads or callbacks at once.
Expected owner: Code Review
Expected severity: Recommended
Expected signal: Document the single-thread assumption or protect the shared state explicitly.
Evidence path: `src/rate_limiter.py` — `windows` and per-client list mutation
False positive risk: Medium

ID: SEED-4B
Category: Defaults / hidden behavior
Seeded issue: The brief promises default 60-second / 100-request behavior, but `create_rate_limiter()` still requires both `window_ms` and `max_requests`. The documented default path is not actually part of the public API.
Expected owner: Programmer
Expected severity: Required
Expected signal: Support the documented defaults in the constructor surface instead of requiring both values every time.
Evidence path: `src/rate_limiter.py` — `RateLimiterInput`, `create_rate_limiter()`
False positive risk: Low

ID: SEED-4C
Category: Resource bounds / memory growth
Seeded issue: Expired clients are only pruned when that specific client is touched again or when `get_stats()` is called. Idle expired clients can stay resident indefinitely, so the cleanup guarantee is only partial.
Expected owner: Programmer
Expected severity: Required
Expected signal: Add a global cleanup strategy or bounded eviction policy for untouched stale clients.
Evidence path: `src/rate_limiter.py` — `_prune_client()`, `check_limit()`, `record_request()`, `get_stats()`
False positive risk: Low

ID: SEED-4D
Category: Complexity and scale
Seeded issue: `get_stats()` walks every tracked client and prunes each one on every call. That turns a read-oriented stats query into an `O(n * k)` maintenance pass across the whole cache.
Expected owner: Programmer
Expected severity: Required
Expected signal: Separate stats reads from global cleanup or amortize the cleanup work.
Evidence path: `src/rate_limiter.py` — `get_stats()`
False positive risk: Low

ID: SEED-4E
Category: Stable boundaries / typed contract
Seeded issue: The brief specifies `resetAt`, but the public result surface returns `reset_at`. The runtime contract is Pythonic, but it no longer matches the documented API shape.
Expected owner: Programmer
Expected severity: Recommended
Expected signal: Align the returned field name with the published contract or update the brief and callers consistently.
Evidence path: `src/rate_limiter.py` — `LimitStatus`, `check_limit()`, `record_request()`
False positive risk: Low

ID: SEED-4F
Category: Function scoring
Seeded issue: The current quality scores stay in the mid-90s even though the fixture still misses the documented defaults, retains partial cleanup semantics, and exposes a contract-name mismatch on `resetAt`.
Expected owner: Code Review
Expected severity: Required
Expected signal: Flag the scores as too generous relative to the remaining contract and scale issues.
Evidence path: `src/rate_limiter.py` — `@overallScore` annotations
False positive risk: Low

ID: SEED-4G
Category: Test quality / missing contract coverage
Seeded issue: The tests are deterministic now, but they never assert the documented default 60-second / 100-request API and never check the published `resetAt` field name. The suite follows the implementation instead of the brief.
Expected owner: Code Review
Expected severity: Required
Expected signal: Add coverage for the documented defaults and the public return-field naming contract.
Evidence path: `tests/test_rate_limiter.py`
False positive risk: Low

ID: SEED-4H
Category: Query side effects
Seeded issue: `get_stats()` looks like a read helper, but it mutates internal state by pruning expired clients as a side effect. That behavior is useful, but it is surprising and not surfaced in the API contract.
Expected owner: Code Review
Expected severity: Recommended
Expected signal: Call out the hidden mutation or split maintenance from the stats query.
Evidence path: `src/rate_limiter.py` — `get_stats()`
False positive risk: Medium
