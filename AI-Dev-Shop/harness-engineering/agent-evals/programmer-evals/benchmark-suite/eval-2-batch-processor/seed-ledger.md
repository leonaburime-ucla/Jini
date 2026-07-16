Seeds targeting: batching boundaries, idempotency, contract shape, hidden state, observability, and regression coverage.

Rewritten against the current Python fixture on `2026-04-29`.
Seed IDs are retained for suite backfill compatibility.

ID: SEED-2A
Category: I/O shape / N+1
Seeded issue: `_process_one()` resolves the user and renders the template separately for every notification. Chunking limits concurrency, but the implementation still performs per-item external lookups instead of reusing or batching repeated user/template work across a batch.
Expected owner: Programmer
Expected severity: Required
Expected signal: Batch or cache repeated user/template lookups across the current batch.
Evidence path: `src/processor.py` — `_process_one()`
False positive risk: Low

ID: SEED-2B
Category: Resource bounds
Seeded issue: Runtime overrides are not validated. `chunkSize=0` breaks `_chunk()`, `maxRetries=0` silently skips the send loop, and negative delay / batch-size overrides produce nonsense behavior while still passing the public type surface.
Expected owner: Programmer
Expected severity: Required
Expected signal: Validate operational options before processing begins.
Evidence path: `src/processor.py` — `process_batch()` options handling and `_chunk()`
False positive risk: Low

ID: SEED-2C
Category: Idempotency
Seeded issue: Retry still resends the email without any stable idempotency key at the email boundary. If the provider times out after actually delivering, the retried send duplicates the notification.
Expected owner: Programmer
Expected severity: Critical
Expected signal: Add an idempotency token derived from the notification identity and pass it to the effect boundary.
Evidence path: `src/processor.py` — `_process_one()` retry loop
False positive risk: Low

ID: SEED-2D
Category: Explicit dependencies
Seeded issue: The batch result's `elapsedMs` still depends on direct `time.time()` reads. Delay injection exists for backoff, but the clock used for duration measurement is not injectable, so the timing contract is only partially deterministic.
Expected owner: Programmer
Expected severity: Recommended
Expected signal: Inject the clock used for elapsed-time measurement, not just the delay function.
Evidence path: `src/processor.py` — `process_batch()` start/end timing
False positive risk: Low

ID: SEED-2E
Category: Deduplication correctness
Seeded issue: Deduplication only keys on `userId` and `templateId`. Distinct notifications for the same user/template but different `data` payloads or `priority` collapse into a single send and are reported as duplicates.
Expected owner: Programmer
Expected severity: Required
Expected signal: Define the dedup identity explicitly and include the fields that make two notifications meaningfully different.
Evidence path: `src/processor.py` — dedup key in `process_batch()`
False positive risk: Low

ID: SEED-2F
Category: Observability for effects
Seeded issue: Structured logs exist, but there is no batch/run correlation ID and no per-attempt duration metric. When a chunk partially fails, the logs are hard to group back into one batch execution.
Expected owner: Programmer
Expected severity: Recommended
Expected signal: Add a batch identifier and richer attempt metadata so retries and failures can be correlated.
Evidence path: `src/processor.py` — logger calls in `process_batch()` and `_process_one()`
False positive risk: Medium

ID: SEED-2G
Category: Typed/stable result
Seeded issue: `ItemResult.status` is still just `str`, and several option hooks are typed as `Any`. The runtime behavior is more specific than the public contract, so the boundary still allows invalid status values and malformed option callables.
Expected owner: Programmer
Expected severity: Recommended
Expected signal: Tighten the status and option types to reflect the actual supported contract.
Evidence path: `src/processor.py` — `ItemResult`, `ProcessBatchOptions`
False positive risk: Low

ID: SEED-2H
Category: Test anti-patterns / missing regression coverage
Seeded issue: The tests correctly avoid real sleeps now, but they do not cover the rewritten failure modes: invalid runtime overrides, deduplication of distinct payloads, or the missing idempotency boundary at the send step.
Expected owner: Code Review
Expected severity: Required
Expected signal: Add regression coverage for the rewritten edge cases instead of relying only on the legacy happy-path suite.
Evidence path: `tests/test_processor.py`
False positive risk: Low
