# Function Quality Seeded Evals

Version: 2.0.0
Last Updated: 2026-04-26

Use this plan to test whether Programmer, Code Review, and Refactor apply the
coding foundations, implementation guardrails, testable design rules, and
function-quality assessment discipline under pressure.

This doc now sits under the generic isolation framework and coverage model:

- `harness-engineering/quality/agent-isolation-eval-framework.md`
- `harness-engineering/quality/eval-coverage-model.md`

## Why This Was Reworked

The earlier seeded evals proved that planted-defect testing works, but they were
still too easy to over-interpret:

- one-seed-per-item designs were clean but unrealistically isolated
- `Easy / Medium / Hard` existed without structural calibration
- reported percentages could hide missing bug classes and missing controls
- small suites could look authoritative even when they were still pilot-scale

This version fixes that by making bug nature, seed structure, controls, and
saved runs mandatory parts of the eval design.

## Status Labels For Function-Quality Suites

Use these labels explicitly:

| Label | Minimum bar |
|---|---|
| `exploratory` | Seeds exist, but no explicit coverage matrix or no saved reruns |
| `pilot` | Matrix exists, but fewer than 30 seeds or missing advanced structures |
| `benchmark` | 36+ seeds, controls present, all tiers covered, 3 saved runs |
| `stable benchmark` | 54+ seeds, regression pack preserved through later framework changes |

An 18-seed suite can still be useful, but it is pilot evidence, not a stable
capability benchmark.

## Required Artifacts

Each suite should include the generic framework files:

- `coverage-matrix.tsv`
- `seed-catalog.tsv`
- `seed-ledger.md`
- `controls.md`
- `run-manifest.tsv`
- `run-results.tsv`

Use the templates under `harness-engineering/quality/templates/`.

Validate the suite with:

```bash
python3 harness-engineering/validators/validate_eval_suite.py <suite-dir> --require-run-results --min-runs 3
```

For a regression-only rerun pack that intentionally re-tests only previously
missed or partial seeds, validate with:

```bash
python3 harness-engineering/validators/validate_eval_suite.py <suite-dir> --suite-kind targeted_regression --require-run-results --min-runs 3
```

This is the efficient rerun path. Do not re-run cleanly caught seeds after
every framework tweak.

## Execution Surface Rule

Function-quality evals default to the matching repo persona, not to external
peer models.

- Default: `repo_persona_subagent`
- Fallback when helper agents are unavailable or explicitly disabled:
  `repo_persona_host`
- Comparison-only mode: `external_peer_cli`

Use `external_peer_cli` only when the user explicitly asks to compare the repo
agent against Claude, Gemini, Codex CLI, or another outside model. Those runs
are useful comparison evidence, but they are not the default proof of
Programmer, Code Review, or Refactor capability.

Record the chosen execution mode and model provenance in
`run-manifest.tsv`, then persist the per-seed grading evidence in
`run-results.tsv` for every saved run.

## Function-Quality Coverage Axes

### 1. Domain Dimensions

These are still the core function-quality dimensions that seeds should exercise.

| Dimension | Typical failure pressure |
|---|---|
| Stable boundaries | positional args, boolean flags, unstable return contracts |
| Explicit dependencies | hidden clock, random, env, cache, module state |
| Pure logic vs effects | logging, I/O, or mutation inside decision logic |
| Single responsibility | orchestration, validation, persistence, and routing collapsed together |
| Small testable units | branch-heavy units with no seams |
| Predictable errors | mixed `null` / `false` / throw / strings for one failure class |
| Typed/stable result | shape-shifting outputs and leaked third-party errors |
| Hidden branching | environment or time-based behavior with no contract |
| Complexity and scale | quadratic loops, recursion, unbounded memory |
| I/O shape | N+1 calls, per-item external operations, hidden retries |
| Resource bounds | no chunking, timeout, payload cap, or retry cap |
| Idempotency | retries duplicate writes or effects |
| Concurrency safety | shared mutable cache, singleton state, order dependence |
| Determinism | real time, real randomness, sleep-based tests |
| Observability for effects | missing or unsafe logs, metrics, or traces |
| Security/privacy | PII logging, unsafe interpolation, caller-owned identifiers |
| Extension point | adding a rule requires editing core orchestration |
| Deletion/refactor signal | oversized logic with no structural fix path |
| Test anti-patterns | brittle mocks, implementation assertions, shared fixtures |
| Adversarial aggregate behavior | repeated keys, combined totals, ordering changes, partial invalid batches |
| Function scoring | inflated `100/100` or skeptical review theater |
| Documentation noise | excessive helper-level scoring that hides meaning |
| Handoff/reporting | missing score tables, risk disclosure, or coverage evidence |
| Comment-code mismatch | names or docs contradict actual behavior |
| Out-of-scope over-engineering | extra features beyond brief or spec |
| Loop termination off-by-one | fencepost arithmetic and index boundary errors |

### 2. Bug-Nature Mix

Do not stop at dimension tagging. Each suite should also tag bug nature using
the taxonomy in `eval-coverage-model.md`.

For function-quality work, the most important natures are usually:

- `omission`
- `boundary_error`
- `semantic_mismatch`
- `type_contract_error`
- `missing_test`
- `anti_pattern`
- `hidden_dependency`
- `state_leak`
- `invariant_violation`
- `cosmetic_fix`
- `severity_misclassification`

### 3. Seed-Structure Mix

Function-quality suites should not be mostly `single`.

Use all of these across a benchmark suite:

| Structure | Function-quality example |
|---|---|
| `single` | One obvious hidden `Date.now()` dependency |
| `combined` | N+1 I/O plus missing timeout in the same batch loop |
| `layered` | Type looseness hides a deeper aggregation bug |
| `distributed` | Caller, helper, and test together reveal the issue |
| `camouflaged` | Confident handoff claims score skepticism already passed |
| `interference` | One rule pushes cleanup while another pushes severity escalation |

If the suite lacks `combined`, `layered`, and `distributed` coverage, it is
still testing the easy version of the problem.

## Difficulty Calibration For This Domain

Use the generic calibration rules, with these domain-specific heuristics:

- **Easy**: one file, one issue, direct symptom
- **Medium**: caller + callee, or code + test, or one combined seed
- **Hard**: aggregate invariant, deceptive handoff, layered defect, or
  multi-file reasoning with plausible local correctness

Good Hard seeds in this domain usually involve:

- aggregate invariants
- false confidence from tests or score tables
- naming or comment camouflage
- distributed evidence across code, tests, and handoff artifacts

## Domain Complexity For This Domain

Beyond structural difficulty, every seed must also declare its domain complexity
tier: `textbook`, `production`, `staff`, `principal`, or `distinguished`. See
`eval-coverage-model.md` for the full taxonomy and classification rules.

For function-quality evals, the key insight is:

- `textbook` seeds test whether the agent recognizes known patterns — use only
  for positive controls
- `production` seeds test whether the agent reasons about runtime behavior that
  tests don't cover — the senior-level baseline
- `staff` seeds test whether the agent can see failures that emerge from the
  interaction of locally correct components under production conditions
- `principal` seeds test whether the agent can identify structural ceilings —
  the code works today but has a predictable breaking point at future scale or
  constraints
- `distinguished` seeds test whether the agent has deep domain expertise —
  failures that exploit subtle system properties most engineers don't know exist

### Seed Design Criteria By Complexity Tier

**Textbook seeds** (max 10% of suite) — plant defects that a linter or careful
reading would surface. Positive controls only. Do not waste suite capacity on
these.

**Production seeds** (max 10% of suite) — plant defects where:
- The code passes all local tests
- The failure manifests only under production conditions
- A senior engineer would catch it during a focused review

Examples:
- A retry loop that works in unit tests but thundering herds under concurrency
- A batch processor that passes 100-record tests but OOMs at production volume

**Staff seeds** (at least 35% of suite) — plant defects where:
- Every component is locally correct and passes review individually
- The failure arises from the *interaction* between components under specific
  conditions (timing, scale, concurrency, partial failure)
- A senior engineer would approve each piece; a Staff engineer would see the
  system-level risk

Examples:
- Two modules both validate-then-write to shared state; individually correct,
  together they race under concurrent requests
- A connection pool grows by 1 on each error-path invocation; invisible for
  hours, OOMs after 48h of production error rate
- Event ordering assumption holds in single-node tests but breaks under
  partition; downstream consumer silently processes stale state
- Cache invalidation race: write completes, invalidation fires, but a read
  initiated before the write repopulates the cache with stale data

**Principal seeds** (at least 25% of suite) — plant defects where:
- The system works correctly today under all tested conditions
- The failure is a structural ceiling that will break at a predictable future
  state (10x data, regulatory change, team scaling, new integration)
- Finding it requires modeling the system's growth trajectory

Examples:
- A data pipeline that silently loses precision through floating-point
  accumulation — all assertions pass but the 90-day aggregate drifts past
  acceptable thresholds
- An authorization model that works for the current org chart but creates a
  combinatorial explosion in evaluation time as delegation depth grows
- A schema design that's performant now but requires a full-table rewrite when
  a new compliance requirement adds a mandatory field to historical records
- A service mesh configuration that works at current RPS but will cascade-fail
  at 3x load because circuit breaker thresholds interact with retry budgets

**Distinguished seeds** (at least 20% of suite) — plant defects where:
- The failure exploits a subtle property of the underlying system
- Finding it requires specialized domain knowledge (distributed systems theory,
  numerical analysis, protocol specifications, cryptographic properties)
- Even a Staff engineer would need specific domain expertise to see it

Examples:
- A permission check that passes for all tested roles but has a graph traversal
  gap granting escalation through a 3-hop delegation chain that only exists
  when two specific role assignments co-occur
- A consensus protocol implementation that's correct under symmetric partition
  but violates linearizability under asymmetric message delay — provable from
  the spec but invisible without formal reasoning
- A compression-before-encryption pattern that leaks plaintext length through
  output size variation (CRIME/BREACH class)
- A monotonic ID generator that's unique per-node but produces duplicates
  during leader failover because the new leader's starting point depends on a
  replicated log entry that hasn't been applied yet

### Minimum Depth For Benchmark Suites

Function-quality benchmark suites must satisfy:

- **At least 80% of seeds must be staff, principal, or distinguished**
- No more than 10% textbook (positive controls only)
- No more than 10% production (senior baseline)
- Every seed at staff or above must cite its complexity category
- No more than **20%** of Hard seeds may be `textbook` or `production` — Hard
  structural difficulty without domain complexity is packaging, not substance

## Minimum Suite Shape

For Programmer, Code Review, and Refactor, use this as the default target:

| Tier | Minimum seed count | Structural expectation |
|---|---|---|
| Easy | 12 | Mostly `single`, plus at least one positive and one negative control |
| Medium | 12 | `combined` and `distributed` required |
| Hard | 12 | `layered`, `camouflaged`, or `interference` required |

That gives a 36-seed benchmark floor. A more stable target is 54 seeds:

- 18 Easy
- 18 Medium
- 18 Hard

This is the point where per-seed variance matters less than it does in tiny
6-seed tiers.

## Full Benchmark Runs vs Targeted Regression Runs

Use both, but do not confuse them:

1. **Full benchmark runs**
   Use these to establish or re-certify capability claims. They re-score every
   seed in the suite and must include controls.
2. **Targeted regression runs**
   Use these after a prompt/skill/guard change. Re-run only the seeds that were
   previously `MISSED` or `PARTIAL` for the target agent. Save at least 3 runs
   per unresolved seed and record the exact LLM/model in `run-manifest.tsv`.

Targeted regression runs answer:

- did the fix improve the specific misses?
- did the same seed remain unstable across multiple runs?

They do **not** answer:

- what is the agent's new full benchmark score?
- did false-positive behavior regress on previously clean controls?

Those questions still require a later full benchmark recertification pass.

## Project Shapes

Use multiple mini-project shapes so failures stay attributable:

1. **Rule engine / validator**
   Tests aggregate behavior, extension points, deterministic ordering, stable
   errors, and score calibration.
2. **Batch processor**
   Tests resource bounds, idempotency, retries, cancellation, per-item I/O, and
   observability.
3. **Adapter boundary**
   Tests typed errors, raw SDK leaks, privacy-safe logging, timeouts, and retry
   contracts.
4. **Stateful cache or scheduler**
   Tests concurrency safety, hidden state, determinism, and cleanup discipline.
5. **Security-sensitive formatter/query builder**
   Tests trust boundaries, unsafe interpolation, and privacy exposure.
6. **Transfer/accounting workflow**
   Tests invariants, rollback/compensation, partial failure, and boundary math.

### Required High-Tier Scenario Families

Staff+ seeds must exercise failure modes that emerge from production system
complexity, not just function-level bugs in simple shapes. Benchmark suites
must include seeds drawn from at least **5 of the following 8 families**:

| Family | What it forces the agent to reason about |
|---|---|
| **Multi-tenant authorization graph with delegated permissions** | Escalation paths through delegation chains, cross-tenant leakage via shared role inheritance, combinatorial evaluation cost as delegation depth grows |
| **Queue/retry/idempotency system under partial failure** | Thundering herd after broker restart, duplicate delivery during rebalance, poison pill blocking, idempotency key expiry window races |
| **Cache invalidation with stale repopulation race** | Read initiated before write completes repopulates cache with stale data after invalidation fires, TTL/version mismatches across layers |
| **Migration with dual-write/read-compatibility window** | Old code reading new schema, new code writing old schema, data loss during the rollover window, backfill races with live traffic |
| **Accounting/ledger workflow with precision and compensation** | Floating-point accumulation drift, compensation transaction ordering, partial-failure double-credit, reconciliation timing windows |
| **Event stream with ordering, replay, and dedupe assumptions** | Out-of-order delivery breaking consumer state machines, replay after checkpoint causing duplicate effects, dedupe window expiry |
| **Service boundary where typed contracts lie after serialization** | API returns string where interface says number, protobuf default values masking missing fields, enum evolution breaking deserialization |
| **Feature flags whose combinations bypass safety invariants** | Flag A enables new path, flag B disables old safety check, combination bypasses auth; stale flag cache during rollout creates inconsistent behavior windows |

**Rules:**

- These families are scenario-level requirements, not one-mini-project-per-family
  requirements. A single mini-project can exercise multiple families.
- The existing 6 project shapes (rule engine, batch processor, adapter, cache,
  security formatter, transfer workflow) remain valid foundations. High-tier
  scenario families layer on top of or extend those shapes with production
  failure modes.
- A seed that claims one of these families must demonstrate that the failure
  cannot be caught without understanding the family's characteristic interaction
  pattern. If it reduces to a single-component bug, it does not qualify.
- Suites that cover fewer than 5 families cannot claim benchmark status for
  staff+ depth.

## Agent-Specific Input Modes

### Programmer

Programmer receives raw brownfield code plus a brief. This is already an
isolation pattern, but it now must satisfy the same matrix and rerun rules as
other agents.

Key target pressure:

- hidden dependencies
- resource bounds
- aggregate invariants
- anti-pattern removal
- test design realism

### Code Review

Code Review receives pre-staged buggy code plus a fabricated Programmer handoff.

Required pressure:

- `camouflaged` seeds where the handoff sounds trustworthy
- `interference` seeds where one rule competes with another
- regression seeds for any previously promoted guard
- negative controls so review does not become "flag everything"

### Refactor

Refactor receives working code plus a review report.

Required pressure:

- `cosmetic_fix` traps
- `layered` behavior drift
- `distributed` dependency breakage
- missing test updates after structural changes

## Scoring

Use the generic scoring model:

- `CAUGHT = 1.0`
- `PARTIAL = 0.5`
- `MISSED = 0.0`
- `FALSE_POSITIVE = 0.0`

But report these domain-specific views too:

- per-dimension catch rate
- per-bug-nature catch rate
- per-structure catch rate
- per-tier catch rate
- aggregate invariant catch rate
- test-quality false-confidence catch rate

Do not headline a single combined percentage if those breakdowns are missing.

## Promotion Rules

Apply `failure-promotion-policy.md`, but add this interpretation:

- if a miss repeats across structures, prefer a framework or validator fix over
  a narrow guard
- if a guard fix improves one seed and destabilizes another, the missing piece
  is usually regression-pack coverage, not more prompt text
- if a suite cannot explain its blind spots in matrix terms, it is not ready to
  drive durable guard promotion

## Operational Rule

Any future summary claiming Programmer or Code Review capability from a
function-quality suite should say whether the suite is exploratory, pilot,
benchmark, or stable benchmark. If the label is omitted, treat the claim as
under-specified.
