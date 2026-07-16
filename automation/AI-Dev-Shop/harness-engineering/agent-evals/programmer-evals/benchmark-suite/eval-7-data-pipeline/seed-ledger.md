# Seed Ledger — Eval 7: Data Pipeline Transformer

Targets checklist items 7-12 plus 2 trick seeds.

---

ID: SEED-CL-07
Checklist Item: 7. Single responsibility
Source Skill: coding-foundations, testable-design-patterns
Category: Single responsibility
Seeded issue: The main `transformPipeline` function validates, transforms, enriches, filters, computes stats, and logs — all in one 90-line function. It mixes pure validation/transformation with effectful enrichment and logging.
Expected owner: Programmer
Expected severity: High
Expected signal: Programmer extracts validate, transform, enrich, filter into separate functions
Evidence path: src/pipeline.py — transform_pipeline function
Caught by Programmer:
Caught by Code Review:

---

ID: SEED-CL-08
Checklist Item: 8. Small testable unit
Source Skill: testable-design-patterns
Category: Small testable unit
Seeded issue: The 90-line transformPipeline function has CC=7 (3 nested if/else chains, try/catch, and a conditional enrichment path). It requires mocking the plan service, setting up valid/invalid records, and configuring the logger to test any single behavior. Cannot be unit tested in isolation.
Expected owner: Programmer
Expected severity: High
Expected signal: Programmer reduces CC by extracting logic into testable units
Evidence path: src/pipeline.py — CC analysis
Caught by Programmer:
Caught by Code Review:

---

ID: SEED-CL-09
Checklist Item: 9. Test anti-pattern avoidance
Source Skill: testable-design-patterns, test-design
Category: Test anti-patterns
Seeded issue: Tests use `expect(result).toBeTruthy()` and `expect(result.valid.length).toBeGreaterThan(0)` instead of exact assertions. One test mocks the internal `validateEmail` function (implementation probing). Another test has a race condition: it uses `setTimeout` to simulate async enrichment but doesn't await properly.
Expected owner: Programmer / Code Review
Expected severity: High
Expected signal: Replace with exact assertions, remove implementation mocks, fix async
Evidence path: tests/test_pipeline.py
Caught by Programmer:
Caught by Code Review:

---

ID: SEED-CL-10
Checklist Item: 10. Predictable error handling
Source Skill: testable-design-patterns, api-design
Category: Predictable errors
Seeded issue: For validation failures: missing name returns `null`, invalid email throws `Error`, invalid phone returns `{ valid: false, reason: 'bad phone' }`, and invalid date logs a warning and continues (silently skips the record). Four different error signaling mechanisms for the same category (invalid record).
Expected owner: Programmer
Expected severity: High
Expected signal: Programmer normalizes to one consistent error shape
Evidence path: src/pipeline.py — validation blocks
Caught by Programmer:
Caught by Code Review:

---

ID: SEED-CL-11
Checklist Item: 11. No hidden state or hidden branching
Source Skill: coding-foundations, testable-design-patterns
Category: Hidden branching
Seeded issue: The pipeline reads `process.env.PIPELINE_MODE` inline to decide whether to skip enrichment (if mode is 'fast'). Also uses a module-level `lastRunTimestamp` to skip records that were already processed in a previous run — creating hidden state that affects behavior across calls.
Expected owner: Programmer
Expected severity: High
Expected signal: Programmer removes env read and module-level state, makes both injectable
Evidence path: src/pipeline.py — os.environ['PIPELINE_MODE'] and last_run_timestamp
Caught by Programmer:
Caught by Code Review:

---

ID: SEED-CL-12
Checklist Item: 12. Complexity and scale
Source Skill: implementation-guardrails
Category: Complexity and scale
Seeded issue: The email validation uses `records.filter(r => ...).find(r => r.email === current.email)` inside the main loop — O(n^2) duplicate detection disguised as a simple chain. For 10,000 records this is 100 million comparisons. No complexity annotation.
Expected owner: Programmer
Expected severity: High
Expected signal: Programmer flags O(n^2) and refactors to Set-based dedup
Evidence path: src/pipeline.py — duplicate email detection
Caught by Programmer:
Caught by Code Review:

---

ID: SEED-CL-TRICK-03
Checklist Item: (trick) Mutation trap
Source Skill: coding-foundations
Category: Mutation trap
Seeded issue: The function sorts the input records array by signupDate using `records.sort(...)` which mutates the caller's array. Then it spreads the record objects with `{...record}` for transformation, but record.address is a nested object — the spread only shallow-copies it, so mutating `transformed.address.normalized = true` mutates the original record's address too.
Expected owner: Programmer
Expected severity: High
Expected signal: Programmer uses spread + structuredClone or creates new objects
Evidence path: src/pipeline.py — records.sort() and shallow dict copy
Caught by Programmer:
Caught by Code Review:

---

ID: SEED-CL-TRICK-04
Checklist Item: (trick) Dead code inflating coverage
Source Skill: testable-design-patterns
Category: Dead code
Seeded issue: There's a `formatPhoneInternational` function that's exported and fully tested (5 test cases) but never actually called by the pipeline — the pipeline uses inline phone formatting instead. The function inflates the test count and coverage numbers while the actual inline formatting code has zero test coverage.
Expected owner: Code Review
Expected severity: Medium
Expected signal: Code Review notices tested-but-unused function and untested inline code
Evidence path: src/pipeline.py — format_phone_international (dead code) vs inline formatting
Caught by Programmer:
Caught by Code Review:
