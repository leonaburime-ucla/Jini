# Eval Seed Taxonomy — Reusable Issue Bank

Canonical reference of all issue types that can be seeded into agent eval
fixtures. Covers real bugs, traps, negative controls, ambiguities, and
design trade-offs.

When building an eval for ANY agent, draw from this pool. The eval designer
decides which items are relevant for the specific agent and fixture context.
No issue type "belongs" to any single agent — the same failure mode tests
different capabilities depending on what the agent is asked to do.

## ID Convention

Each entry has a stable ID in the form `CATEGORY-TYPE` (e.g., `CONC-RACE`,
`SEC-SSRF`, `DATA-OVERFLOW`). Reference these IDs in seed-ledgers and
coverage-matrices. Do not use row numbers.

## Relationship to seed-ledger.md

This file is a MENU — it lists what bugs exist in the world.

The per-eval `seed-ledger.md` is the ORACLE — it records:
- Which taxonomy IDs were planted in that specific fixture
- Exact evidence path (file:line)
- Expected severity given the fixture's operational context
- Scoring criteria (what a correct finding must mention)
- False-positive neighbors

Keep this taxonomy lean and browsable. Keep oracle precision in the
seed-ledger.

## Eval Design Rules (from cowork session 2026-05-29)

- Don't name the bug in the brief.
- Let requirements imply the invariant indirectly.
- Put the issue across code + tests + config when possible.
- Include plausible but wrong code, not cartoon bugs.
- Place at least one negative control adjacent to each hard bug.
- Keep the seed-ledger hidden from the evaluated agent.
- Severity traps are context-dependent — always specify the fixture
  constraints that make the severity non-obvious.

---

## Seed Roles

Every item planted in a fixture serves one of these roles:

| Role | What it is | What the agent should do |
|------|-----------|--------------------------|
| **Bug** | Genuinely broken code that will cause production issues | Identify it, explain the consequence |
| **Negative Control** | Correct code that looks suspicious or unusual | NOT flag it as a defect |
| **Trap / Distractor** | Correct code designed to waste attention or tempt a false positive | Recognize it's fine and move on |
| **Ambiguity** | Code where the correct answer is "this needs clarification" or "depends on context" | Flag uncertainty, not assert a bug |
| **Design Trade-off** | Working code that uses a suboptimal approach | Identify the trade-off, not call it broken |
| **Severity Trap** | Real issue that looks Critical but is actually Minor (or vice versa) | Get the severity right |

---

## I. Real Bugs

### Concurrency & Coordination

| ID | Type | Description |
|---|------|-------------|
| CONC-RACE | Check-then-act race | Read a value, make decision, act — but value changed between read and act |
| CONC-LOST-UPDATE | Lost update | Two writers read same value, both modify, second write overwrites first |
| CONC-STALE-READ | Stale read model | Decision made on eventually-consistent projection, mutation on live store |
| CONC-NO-LOCK | Missing lock / CAS | Concurrent access with no fencing, optimistic locking, or compare-and-swap |
| CONC-DEADLOCK | Lock-order inversion / deadlock | Two operations acquire locks in opposite order |
| CONC-ABA | ABA problem | Value changes A→B→A, CAS succeeds but intervening state was different |
| CONC-WRITE-SKEW | Write skew in snapshot isolation | Two transactions read overlapping data, write non-overlapping — constraint violated |
| CONC-PHANTOM | Phantom reads | Query result changes between two reads in same operation |
| CONC-NONATOMIC | Non-atomic multi-step mutation | Two separate writes where crash between them leaves inconsistent state |
| CONC-REENTRANT | Reentrant call on non-reentrant lock | Self-deadlock via recursive/callback path |

### State & Lifecycle

| ID | Type | Description |
|---|------|-------------|
| STATE-TERMINAL | Terminal state not guarded | Event/callback overwrites a final state back to an active state |
| STATE-TOMBSTONE | Tombstone resurrection | Delete marker overwritten by late update or backfill |
| STATE-REPLAY | Same-version replay overwrites | Dedup gate uses >= instead of > |
| STATE-UNREACHABLE | Unreachable state defined | State enum has value that no code path ever produces |
| STATE-COMP-ORDER | Compensation in wrong order | Rollback steps execute in wrong sequence, leaving partial state |
| STATE-COMP-MISS | Missing compensation step | Cancel/rollback doesn't reverse all forward steps |
| STATE-PARTIAL | Partial failure leaves inconsistent state | Exception mid-operation, no cleanup for completed steps |
| STATE-LEAK | State leak between instances | Module-level mutable state shared across callers/tests |

### Timing & Ordering

| ID | Type | Description |
|---|------|-------------|
| TIME-TTL-SHORT | TTL shorter than operation timeout | Hold expires before dependent operation can complete |
| TIME-IDEMP-WINDOW | Idempotency window shorter than replay window | Dedup record expires before retries stop arriving |
| TIME-CKPT-ORDER | Checkpoint before emit | Crash between commit and delivery = lost output |
| TIME-EMIT-OUTSIDE | Emit outside transaction | Side effect after commit boundary, lost on crash |
| TIME-CLOCK-MIX | Wall-clock mixed with event-time | Two time domains conflated, causes incorrect windowing |
| TIME-BOUNDARY | Off-by-one at window boundary | Events exactly on boundary dropped or double-counted |
| TIME-DST | DST / timezone transition | Duplicate or missing hour causes scheduling/billing errors |
| TIME-NOW-TWICE | now() called twice gets different values | Non-monotonic time use creates inconsistency |
| TIME-EPOCH-UNIT | Epoch seconds vs milliseconds confusion | 1000x error in timeout/TTL/timestamp |
| TIME-CRON-TZ | Scheduled job fires at wrong local time | UTC vs local timezone in cron expression |

### Data Integrity

| ID | Type | Description |
|---|------|-------------|
| DATA-FIELD-DROP | Field dropped during schema translation | Lossy transformation on version boundary |
| DATA-UNSAFE-DEFAULT | Unsafe default on missing field | Absent field defaults to permissive value (opt-in=True) |
| DATA-STATIC-ALLOWLIST | Backfill uses static field allowlist | New fields not included, data silently lost |
| DATA-NO-SNAPSHOT | Non-snapshot pagination | Concurrent writes cause skip/duplicate during iteration |
| DATA-OVERFLOW | Integer overflow / counter wrap | Wraps at 2^32 or 2^53, produces incorrect value |
| DATA-FLOAT-DRIFT | Floating point accumulation drift | Repeated addition without intermediate rounding |
| DATA-TRUNCATION | Integer division truncation | Loses fractional cents/units |
| DATA-SIGN-CONFUSE | Signed/unsigned confusion | Negative value interpreted as large positive |
| DATA-ENCODING | Encoding mismatch | UTF-8 vs Latin-1, null bytes in strings, BOM in parsing |
| DATA-SOFT-DELETE | Soft-delete not filtered in queries | Deleted records appear in results |
| DATA-CASCADE-MISS | Cascade delete misses junction table | Related records orphaned |
| DATA-UNIT-CONFUSE | Cents vs dollars / unit confusion | 100x error in monetary calculation |

### Security & Trust Boundaries

| ID | Type | Description |
|---|------|-------------|
| SEC-TENANT-LEAK | Cross-tenant data access | Query/cache/routing missing tenant filter |
| SEC-TOCTOU | TOCTOU (time-of-check/time-of-use) | Permission checked, then resource fetched separately — revocation between |
| SEC-FAIL-OPEN | Fail-open on malformed input | Missing field defaults to wildcard/allow |
| SEC-LEGACY-CRED | Legacy credential accepted indefinitely | No grace period enforcement on rotated secrets |
| SEC-NONCE-BURN | Nonce consumed before verification | Attacker burns nonce, legitimate request rejected |
| SEC-UNSIGNED-TRUST | Unsigned data used for routing/trust | Fallback to body field when header missing |
| SEC-TIMING | Timing attack | String comparison on secret reveals length/content |
| SEC-SQLI | SQL/NoSQL injection | User input interpolated into query |
| SEC-CMDI | Command injection | User input passed to shell/exec |
| SEC-PATH-TRAVERSAL | Path traversal | User input used in file path without sanitization |
| SEC-SSRF | SSRF | User-controlled URL fetched server-side |
| SEC-DESER | Unsafe deserialization | YAML/pickle/JSON parsed with code execution |
| SEC-SESSION-FIX | Session fixation | Attacker sets session ID before victim authenticates |
| SEC-TOKEN-RACE | Refresh token reuse race | Two concurrent refreshes, both succeed, one should be invalidated |
| SEC-CSRF | CSRF on state-changing route | Missing token on POST/PUT/DELETE |
| SEC-CORS | Permissive CORS | Origin wildcard or reflect-any on credentialed endpoint |
| SEC-WEAK-RAND | Weak randomness | math.random/time-seeded for security-sensitive value |
| SEC-NONCE-REUSE | Nonce/IV reuse | Same nonce with same key = plaintext recovery |
| SEC-JWT-ALGO | JWT algorithm confusion | Server accepts "none" or HS256 when expecting RS256 |
| SEC-IDOR | IDOR via sequential ID | Predictable resource ID allows enumeration |
| SEC-PII-LOG | PII in logs | Email, phone, card number in error/debug output |
| SEC-SECRET-URL | Secret in logged URL | API key as query parameter, logged at INFO |
| SEC-PRESIGN-BROAD | Presigned URL too broad | Wildcard path or excessive expiry |
| SEC-CONTENT-SPOOF | Content-type spoofing | Uploaded file extension doesn't match content |

### Cache & Invalidation

| ID | Type | Description |
|---|------|-------------|
| CACHE-KEY-MISS | Cache key missing dimension | Omits tenant, locale, version, policy — serves wrong data |
| CACHE-REVOKE | Revocation doesn't invalidate cache | Revoked permission/access served from stale cache |
| CACHE-POLICY | Policy change doesn't invalidate | New policy active but old decisions still cached |
| CACHE-STALE-REPOP | Stale repopulation overwrites fresh | Slow read-through writes old data over recent write |
| CACHE-NEG-PERSIST | Negative cache survives creation | "Not found" persists after entity is created |
| CACHE-STAMPEDE | Cache stampede on expiry | All clients miss simultaneously, hammer backend |
| CACHE-NEG-POISON | Negative cache poisoning by attacker | Force "not found" cache entry for valid resource |
| CACHE-COLLISION | Cache key collision between entities | Unrelated items share cache slot |

### Error Handling & Classification

| ID | Type | Description |
|---|------|-------------|
| ERR-PERM-RETRY | Permanent error retried | Unrecoverable failure put back on retry queue |
| ERR-4XX-RETRY | Deterministic error classified as retryable | 400 Bad Request retried forever |
| ERR-DLQ-RESET | DLQ threshold resets on deploy | Counter keyed on instance/group that changes |
| ERR-SWALLOW | Catch-all swallows important signal | Exception caught, logged, but not propagated |
| ERR-FIRE-FORGET | Async fire-and-forget drops errors | Failure in background task never surfaces |
| ERR-HEALTH-LIE | Health check passes while core is broken | Liveness probe doesn't check actual functionality |
| ERR-PARTIAL-OK | Result marked success despite partial failure | Some items failed but batch reported as complete |
| ERR-SUBSTR-MATCH | Error message substring matching | Fragile classification that breaks when message changes |

### Resource Management

| ID | Type | Description |
|---|------|-------------|
| RES-POOL-LEAK | Connection pool leak on error path | Acquired resource not released in exception handler |
| RES-HANDLE-LEAK | File handle leak in async exception | Open file not closed when coroutine cancelled |
| RES-THREAD-LEAK | Thread/goroutine leak | Spawned worker never terminates |
| RES-MEM-LEAK | Memory leak via unbounded collection | Map/list grows without eviction |
| RES-LISTENER-LEAK | Event listener registered never unregistered | Accumulates handlers over time |
| RES-TEMP-FILE | Temporary file accumulation | Created but never cleaned up |
| RES-RETRY-STORM | Retry storm / thundering herd | All clients retry at same time without jitter |
| RES-UNBOUNDED | Unbounded query / traversal | No limit on result set or graph walk = DoS |
| RES-BACKPRESSURE | Backpressure not applied to retries | Fetch paused but retry queue grows unbounded |
| RES-OOM-BATCH | Batch size causes OOM | Deserializer loads full payload into memory |

### Deployment & Configuration

| ID | Type | Description |
|---|------|-------------|
| DEPLOY-SCHEMA-BREAK | Non-additive schema migration | Rename instead of add/migrate/drop |
| DEPLOY-ORDER | Consumer deployed before topic exists | Startup crash loop |
| DEPLOY-CONFIG-RACE | Config not propagated before service starts | Dependency on not-yet-available value |
| DEPLOY-FLAG-COMBO | Feature flag A + B untested together | Combination produces unexpected behavior |
| DEPLOY-FLAG-DEAD | Flag cleanup leaves dead branch | Gate removed but unreachable code remains |
| DEPLOY-ENV-LEAK | Dev config leaks to production | Env var override or fallback serves wrong value |
| DEPLOY-RELOAD-STALE | Config reload doesn't restart connections | Old config still active on existing connections |
| DEPLOY-IAC-DRIFT | IaC drift undetected | Prod differs from declared state |
| DEPLOY-NO-LIMITS | Missing resource limits | No memory/CPU limit = noisy neighbor or OOM kill |
| DEPLOY-SCALE-SIGNAL | Wrong autoscaling signal | Scales on CPU when bottleneck is I/O wait |
| DEPLOY-SECRET-STALE | Secret rotation not propagated | New secret active but old consumers still use expired one |
| DEPLOY-ROLLBACK-SER | Rollback-incompatible serialization | New format unreadable by old code on rollback |

### Distributed Systems

| ID | Type | Description |
|---|------|-------------|
| DIST-SPLIT-BRAIN | Split brain / dual leader | Two coordinators active after network partition |
| DIST-NO-FENCE | Missing fencing token | Stale leader commits work after new leader elected |
| DIST-2PC-CRASH | 2PC coordinator crash | Participants stuck in prepared state |
| DIST-COMP-ORDER | Saga compensates in wrong order | Dependent steps reversed without respecting order |
| DIST-EVENT-ORDER | Event ordering violated across partitions | Consumer assumes total order but gets partial |
| DIST-FIFO-LOST | FIFO lost during failover | Queue loses ordering guarantee on failover |
| DIST-PRIORITY-INV | Priority inversion under backpressure | High-priority blocked behind low-priority batch |
| DIST-REBALANCE-LOSS | Rebalance loses in-flight state | In-memory work dropped during partition reassignment |

### Observability & Operations

| ID | Type | Description |
|---|------|-------------|
| OBS-COUNTER-WRAP | Metric counter overflow/reset | Counter wraps, rate calculation goes negative |
| OBS-PERCENTILE | Percentile on pre-aggregated data | p99 of averages ≠ actual p99 |
| OBS-AVG-HIDES | Alert on average hides per-tenant outage | One tenant broken but average looks fine |
| OBS-CARDINALITY | High-cardinality metric melts monitoring | Unique label per request exhausts storage |
| OBS-SAMPLING | Log sampling drops all errors for one tenant | Sampling rate masks concentrated failures |
| OBS-NOISY-ALERT | Noisy alert suppresses real incident | Alert fatigue causes real pages to be ignored |
| OBS-SPIKE-FP | Alert fires on deploy spike not real issue | Threshold too sensitive to transient spikes |

### API & Contract

| ID | Type | Description |
|---|------|-------------|
| API-VERSION-MISMATCH | Header says v2 but body uses v1 schema | Version mismatch between envelope and content |
| API-SUNSET-BREAK | Deprecated field removed without sunset | Clients break on upgrade |
| API-OPTIONAL-REQUIRED | Optional field becomes required silently | No migration path for existing consumers |
| API-ENUM-UNHANDLED | Enum gains value not handled by consumers | Switch/match has no default, crashes on new value |
| API-COMPAT-BREAK | Backwards-incompatible response change | New field required, old clients can't parse |
| API-PROVIDER-DRIFT | Third-party changes error contract | Provider returns different error shape, our parsing breaks |
| API-IDEMP-MISMATCH | Provider idempotency differs from ours | Our retry relies on provider dedup that doesn't exist |
| API-STRICT-REJECT | Webhook schema adds field we don't handle | Unknown field causes strict parser to reject |

### Code Bloat & Unnecessary Complexity

| ID | Type | Description |
|---|------|-------------|
| BLOAT-PASSTHROUGH | Passthrough wrapper hiding defect | Delegation layer with no added behavior obscures a bug in the inner call |
| BLOAT-DRIFT-DUPE | Drifted duplication | Copy-pasted code where one copy was fixed but the other retains the bug |
| BLOAT-DEAD-MASK | Dead code masking coverage gap | Unreachable branch inflates coverage metrics, real path untested |
| BLOAT-PREMATURE-GEN | Premature generalization | Generic framework for single use case, complexity enables misconfiguration |
| BLOAT-PARAM-THREAD | Unused parameter threaded through layers | Parameter passed N levels deep, never used — callers assume it's effective |
| BLOAT-INDIRECTION | Excessive indirection hiding fault | Bug only visible by tracing through 3+ delegation layers that add no logic |
| BLOAT-DEAD-BRANCH | Dead conditional branch | Condition can never be true given upstream constraints, code is unreachable |
| BLOAT-ADAPTER-DRIFT | Adapter outlives its purpose | Compatibility shim for migration that completed, now masks interface changes |

### Domain / Business Logic

| ID | Type | Description |
|---|------|-------------|
| BIZ-RATELIMIT-BYPASS | Rate limit bypass | Per-IP limit but attacker rotates IPs; internal calls not limited |
| BIZ-RATELIMIT-RESET | Rate limit resets on key format change | New key = fresh quota |
| BIZ-GDPR-PARTIAL | GDPR delete misses replicas | Primary deleted but search/cache/blob retains PII |
| BIZ-LEGAL-HOLD | Legal hold ignored | Retention policy deletes evidence under hold |
| BIZ-AUDIT-MUTABLE | Audit log mutable | Admin can edit/delete audit trail |
| BIZ-AUDIT-AFTER | Audit written after side effect | Crash between effect and audit = lost record |
| BIZ-ORPHAN-BLOB | Orphaned blob after DB rollback | File stored but reference row rolled back |
| BIZ-UPLOAD-ORPHAN | Multipart upload not finalized | Parts uploaded but never composed |
| BIZ-CRON-DUPE | Duplicate scheduled job on multiple nodes | Cron without distributed lock |
| BIZ-STALE-LEASE | Stale lease owner continues writing | Old holder writes after lease expired |
| BIZ-LOCALE-PARSE | Locale decimal parsing (comma vs dot) | "1.234" vs "1,234" interpreted differently |
| BIZ-CURRENCY-PREC | Currency without precision spec | Rounding rules depend on currency but code assumes 2 decimals |
| BIZ-ID-COLLISION | ID too short for collision resistance | Birthday paradox causes collisions at scale |
| BIZ-CURSOR-NONMONO | Non-monotonic cursor ID | Cursor-based pagination misses/duplicates |
| BIZ-N-PLUS-ONE | N+1 external call in loop | Per-row service call instead of batch |

---

## II. Negative Controls (Correct Code That Looks Suspicious)

Plant these ADJACENT to real bugs. The agent must NOT flag them.
Every hard fixture should have at least one NC in the same conceptual
neighborhood as a real bug.

| ID | Pattern | Why It Looks Wrong | Why It's Actually Correct |
|---|---------|-------------------|--------------------------|
| NC-RETRY-AGGRO | Retry with aggressive backoff | Looks like it might cause storms | Has jitter, max cap, and bounded attempts |
| NC-CROSS-TENANT | Cross-tenant query in admin path | Looks like tenant isolation violation | Intentionally cross-tenant for support staff |
| NC-BATCH-WALK | O(n) batch walk in scheduled job | Looks like performance bug | Weekly batch, n is bounded, latency doesn't matter |
| NC-UNUSED-API | Unused API methods on a class | Looks like dead code | Part of the interface contract, used by other callers |
| NC-EXPONENTIAL | Exponential algorithm on small input | Looks like performance issue | Input is bounded by config to max 8 items |
| NC-MANUAL-CLEANUP | Manual memory management pattern | Looks like resource leak risk | Cleanup is in finally block / context manager |
| NC-GLOBAL-STATE | Global mutable state (injected) | Looks like shared state bug | DI pattern — each test injects fresh instance |
| NC-BROAD-CATCH | Catching broad exception | Looks like error swallowing | Re-raises after logging, or is the outermost handler |
| NC-SLEEP-PROD | time.sleep in production code | Looks like blocking call | Rate limiter / debounce with configurable duration |
| NC-RAW-SQL | Direct DB query instead of ORM | Looks like SQL injection risk | Uses parameterized query with placeholders |
| NC-RECURSIVE | Recursive function without depth limit | Looks like stack overflow risk | Data structure guarantees max depth (tree height bounded) |
| NC-MUTABLE-DEFAULT | Mutable default argument | Looks like classic Python bug | Used intentionally as sentinel / shared accumulator |
| NC-NO-EXPIRY | Cache that never expires | Looks like stale data risk | Data is immutable (versioned, write-once) |
| NC-DUAL-WRITE | Dual-write to two stores | Looks like redundant/inconsistent | Required for migration rollback safety |
| NC-OLD-FORMAT | Accept old + new key format | Looks like legacy debt | Backwards compatibility during rolling deploy |
| NC-BIG-TRY | Large try/except block | Looks like exception masking | Handles known recovery cases, re-raises unknown |
| NC-CONST-TIME | Constant-time comparison helper | Looks over-engineered | Necessary for timing-attack prevention on secrets |
| NC-NO-THREAD-SAFE | Thread-unsafe code in single-threaded service | Looks like race condition | Service is guaranteed single-threaded by architecture |
| NC-HARDCODED-TIMEOUT | Hardcoded timeout value | Looks like should be configurable | Matches external contract SLA exactly |
| NC-EMPTY-EXCEPT | Empty except pass | Looks like error swallowing | Expected exception from probe/health check |

---

## III. Traps & Distractors (Attention Sinks)

Code that draws review attention but has no issue. Tests signal-to-noise discrimination.

| ID | Pattern | Why It Wastes Attention |
|---|---------|------------------------|
| TRAP-DEP-BUMP | Large dependency version bump diff | Huge lockfile change, no actual bug |
| TRAP-COMPLEX-ALGO | Complex but correct algorithm | Looks intimidating, takes time to verify correctness |
| TRAP-VERBOSE-OBS | Extensive logging/metrics code | Verbose but correct observability |
| TRAP-COMMENT-DEBATE | Code comment debate about design | Long comment thread, no actual defect |
| TRAP-MIGRATION | Migration script (correct) | Intimidating DDL but executed safely |
| TRAP-RENAME | Renamed variables/functions | Large diff, pure refactor, no behavior change |
| TRAP-GENERATED | Generated code (protobuf, OpenAPI) | Huge file, machine-generated, correct |
| TRAP-CONFIG-REORG | Configuration file reorganization | Moved settings between files, same values |
| TRAP-TEST-FIXTURE | Test helper with complex setup | Elaborate fixture, but correctly constructed |
| TRAP-THIN-ADAPTER | Adapter layer with many thin methods | Looks like over-engineering but fulfills interface contract |

---

## IV. Ambiguities (Where "Needs Clarification" Is Valid)

| ID | Situation | Why It's Ambiguous |
|---|-----------|-------------------|
| AMB-RETRY-COUNT | Retry count: 3 or 5? | Brief doesn't specify, both are defensible |
| AMB-LOG-LEVEL | Should failures be logged at WARN or ERROR? | Depends on business context not given |
| AMB-PAGE-SIZE | Pagination default: 20 or 100? | Performance vs UX tradeoff, no right answer |
| AMB-FLAG-DEFAULT | Feature flag default: on or off for new tenants? | Business decision, not engineering one |
| AMB-SYNC-ASYNC | Should this operation be sync or async? | Depends on latency requirements not stated |
| AMB-CACHE-TTL | Cache TTL duration | Depends on data freshness requirements not given |
| AMB-ERROR-DETAIL | Error response detail level | Security (less) vs debuggability (more) tradeoff |
| AMB-BATCH-SIZE | Backfill batch size | Throughput vs resource pressure tradeoff |
| AMB-DELETE-MODE | Soft delete vs hard delete | Compliance vs storage tradeoff |
| AMB-INDEX-NEED | Whether to add an index | Query frequency not stated |

---

## V. Design Trade-offs (Working But Suboptimal)

Code that works but a senior reviewer might suggest improvements.

| ID | Pattern | Trade-off |
|---|---------|-----------|
| TRADE-POLL | Polling instead of webhooks | Works but wastes resources |
| TRADE-HEAVY-SAGA | Heavyweight saga for simple flow | Correct but over-engineered for the use case |
| TRADE-SYNC-ASYNC | Synchronous call in async pipeline | Works but adds latency and blocks |
| TRADE-MONOLITH-FN | Monolithic function (100+ lines) | Works but hard to test/maintain |
| TRADE-STRING-CODE | String-based error codes | Works but not type-safe |
| TRADE-GLOBAL-STATE | Global state instead of DI | Works in prod but breaks test isolation |
| TRADE-RAW-SQL | Raw SQL instead of query builder | Works but maintenance risk |
| TRADE-IN-PROC-QUEUE | In-process queue instead of external | Works until you need horizontal scaling |
| TRADE-SINGLE-THREAD | Single-threaded processing | Works but leaves capacity unused |
| TRADE-STORED-COMPUTED | Storing computed values | Works but can drift from source data |

---

## VI. Severity Traps

Items where the severity is non-obvious — tests whether the agent can
calibrate correctly. Always specify fixture constraints that make the
severity non-obvious (severity is context-dependent, not universal).

| ID | Situation | Appears To Be | Actually Is (given constraints) |
|---|-----------|--------------|-------------|
| SEV-INTERNAL-API | Missing input validation on internal API | Critical (injection?) | Minor — given: callers are trusted internal services only |
| SEV-ADMIN-RACE | Race condition in admin-only path | Critical (data corruption?) | Minor — given: admin has 2 users, never concurrent |
| SEV-FLOAT-BILLING | Floating point rounding in billing | Minor (pennies?) | Critical — given: compounds across millions of transactions |
| SEV-HEALTH-RATELIMIT | Missing rate limit on health check | Critical (DoS?) | Minor — given: not user-facing, internal only |
| SEV-TRACE-PII | PII in debug log at TRACE level | Critical (data leak?) | Minor — given: TRACE never enabled in production, config enforced |
| SEV-CRON-UNBOUNDED | Unbounded query on cron job | Critical (OOM?) | Minor — given: table has <1000 rows by design constraint |
| SEV-WEBHOOK-NOAUTH | No auth on webhook endpoint | Critical (unauthenticated?) | Minor — given: signature-verified, auth IS the signature |
| SEV-TEST-SECRET | Hardcoded secret in test file | Critical (leaked cred?) | Minor — given: test-only value, not a real secret |
| SEV-COUNTER-UNSAFE | Thread-unsafe counter | Critical (data corruption?) | Major — given: counter is advisory metric, not critical path |
| SEV-STALE-CACHE | Stale cache for 5 minutes | Critical (wrong data?) | Minor — given: marketing content, staleness explicitly acceptable |

---

## Difficulty Tiers

| Tier | Description | Example |
|------|-------------|---------|
| T1 | Visible in the changed function | Off-by-one, missing null check, wrong operator |
| T2 | Requires reading another file or contract | API shape changed but caller not updated |
| T3 | Requires understanding lifecycle, rollout, auth, or async | Checkpoint ordering, cache dimension, split-brain |
| T4 | Requires inferring "code is correct but design is risky" | TOCTOU, feature flag interaction, no circuit breaker |

### Recommended distribution per eval:
- 20% T1 (baseline calibration)
- 40% T2 (solid reviewer)
- 30% T3 (senior/staff level)
- 10% T4 (principal level)
