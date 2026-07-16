# Eval Coverage Model

Version: 1.0.0
Last Updated: 2026-04-26

## Purpose

Make eval gaps visible before agents are scored.

Without a coverage model, seeded evals drift toward whatever bugs are easiest to
invent and score. That produces attractive percentages but weak trust.

This model defines four separate coverage axes:

1. **Agent dimension**: which skill or review dimension should catch the issue
2. **Bug nature**: what kind of defect or trap it is
3. **Seed structure**: how the defect is arranged in the artifacts
4. **Difficulty**: how much evidence synthesis or deception is required

The matrix is not a full Cartesian product. Some combinations are nonsense and
should be marked `pruned`. The point is to make pruning explicit instead of
invisible.

Suites may also track two optional cross-cutting coverage lenses:

5. **Architecture family**: which project shape or macro architecture the seed
   belongs to
6. **Conditional skill activation**: which optional skills should activate, and
   which ones should remain off

## Bug Nature Taxonomy

Use these values in `coverage-matrix.tsv` and `seed-catalog.tsv`.

| Bug nature | What it means | Example |
|---|---|---|
| `contradiction` | Code or artifact says the opposite of the spec | Admin override records the wrong actor |
| `omission` | Required behavior is missing | No rate limiting, no rollback, no timeout |
| `boundary_error` | Inclusive/exclusive, off-by-one, or threshold mistake | `>=` vs `>` on capacity |
| `semantic_mismatch` | Names, comments, or docs lie about behavior | Comment says rate limited, code is not |
| `severity_misclassification` | Issue is found but downplayed | Invariant break labeled Recommended |
| `cosmetic_fix` | Claimed fix does not change behavior structurally | Comments-only debt-band fix |
| `type_contract_error` | Return shape, type, or interface contract is unstable or wrong | Raw SDK error leaks across boundary |
| `missing_test` | A required scenario is not tested or is weakly asserted | No error-path test, fake cleanup |
| `anti_pattern` | Known harmful implementation pattern | Catch-all error handling, N+1 I/O |
| `hidden_dependency` | Behavior depends on implicit global state or environment | `Date.now()` inside decision logic |
| `dead_code` | Unused or unreachable code hides drift or inflates confidence | Legacy helper never used |
| `state_leak` | State bleeds across records, calls, or tests | Global fake timers without cleanup |
| `invariant_violation` | Multi-step behavior can break a promised invariant | Transfer loses quantity on partial failure |

If a suite introduces a new recurring defect class, add it here rather than
smuggling it into prose.

## Seed Structure Taxonomy

These values describe how the defect is arranged, not what the defect is.

| Structure | What it tests | Example |
|---|---|---|
| `single` | One isolated defect in one place | One obvious missing validation |
| `combined` | Multiple defects co-exist in one unit | N+1 plus missing idempotency in one function |
| `layered` | One defect masks another | Type mismatch hides deeper logic bug |
| `distributed` | Evidence is split across files or artifacts | Spec, caller, and callee must all be read |
| `camouflaged` | Narrative or naming misdirects the agent | Confident handoff claims fix is complete |
| `interference` | Two rules compete for attention or classification | One rule nudges Recommended while another should force Required |

If a suite only uses `single`, it is not exercising realistic review pressure.

## Difficulty Calibration

Difficulty is derived from evidence synthesis and deception load, not how
impressive the seeded bug sounds.

| Tier | Calibration rule |
|---|---|
| `Easy` | One artifact or one location; direct evidence; no serious deception required |
| `Medium` | Requires 2-3 locations, or one location plus one deceptive cue, or one combined seed |
| `Hard` | Requires cross-file synthesis, ambiguity judgment, layered masking, strong camouflage, or rule interference |

Promote a seed to `Hard` only when at least one of these is true:

- evidence is distributed across 3 or more locations
- the issue is layered or interference-based
- the happy path works and the failure only appears under context
- the handoff, naming, or surrounding comments actively mislead the agent

## Difficulty Distribution Policy

Easy seeds exist only as smoke-test positive controls — they verify the agent
is running, reading the right inputs, and producing output in the expected
shape. They do not measure capability.

**Hard rules:**
- Easy seeds must be ≤ 5% of total suite size (rounded up)
- Easy seeds must be classified as `positive_control` — no Easy standard seeds
- If a positive control fails, it indicates a broken agent setup, not a skill gap
- Medium + Hard should comprise ≥ 95% of the suite
- Prefer Hard over Medium — Medium seeds that don't require genuine deception or
  cross-boundary reasoning should be promoted to Hard with added camouflage or
  interference, or downgraded to positive controls if they're truly trivial

**Rationale:** Easy standard seeds inflate catch rates and obscure real gaps. An
agent that scores 90% on a suite with 30% Easy seeds may actually be failing
half of the genuinely hard scenarios. Suites must measure what agents struggle
with, not confirm what they can trivially do.

## Matrix Rules

Every benchmark-grade suite should satisfy these minimum rules:

1. **Smoke-test baseline**: the suite includes 2-3 Easy positive controls that
   verify the agent is loaded and producing structured output. These are not
   capability measurements.
2. **Structure pressure**: each target dimension gets at least one non-`single`
   cell from `combined`, `layered`, `distributed`, `camouflaged`, or
   `interference`.
3. **Difficulty weight**: ≥ 95% of seeds are Medium or Hard. Hard seeds should
   outnumber Medium seeds in benchmark-grade suites.
4. **High-risk repetition**: high-risk natures such as `omission`,
   `boundary_error`, `hidden_dependency`, `state_leak`, and
   `invariant_violation` should not appear only once across the whole suite
   unless explicitly justified.
5. **Explicit pruning**: if a dimension-nature-structure combination does not
   make sense, mark it `pruned` with a rationale.

## Control Requirements

Benchmark-grade suites also require non-seed controls:

- **Positive controls**: obvious must-catch checks that prove the agent is not
  asleep or off-topic.
- **Negative controls**: realistic non-bugs that the agent should not flag.
- **Regression pack**: preserved seeds that previously caught a failure and must
  remain stable after framework updates.
- **Clean control**: at least one clean or mostly clean section so the agent is
  not rewarded for over-reporting.

## Per-Dimension Seed Density

Suite-level seed floors (36, 54) prevent tiny suites from posing as benchmarks,
but they do not prevent all seeds from clustering in one or two dimensions.

Rules:

- Each **target dimension** should have at least 5 seeds if the suite is pilot
  and at least 8 seeds if the suite claims benchmark status.
- If a dimension has fewer than 5 seeds, document why in the coverage matrix
  rationale column (e.g., the dimension only applies to a narrow project shape).
- Do not compensate for a thin dimension by adding more Easy seeds to an already
  saturated dimension.

The validator warns when any target dimension falls below these floors.

## Negative-Control Calibration

Requiring "at least one negative control" is structurally weak. A suite with 50
real seeds and 2 negative controls cannot meaningfully measure over-reporting
tendency.

Rules:

- Benchmark suites must include negative controls totaling at least **15%** of
  the standard seed count (rounded up). For a 36-seed benchmark, that means at
  least 6 negative controls.
- Negative controls should span multiple dimensions and difficulty tiers, not
  cluster in one easy bucket.
- If the false-positive rate computed from negative controls is unstable across
  runs, add more negative controls before adding more standard seeds.

The validator enforces the 15% floor for benchmark suites.

## Cross-Dimension Stability (Attention-Budget Metric)

Adding rules or seeds to one dimension can redistribute an LLM agent's attention
and destabilize previously stable seeds in other dimensions. This happened in
practice: promoting guards for CR-13/15/16 improved their catch rates but caused
CR-17 to regress from stable to 63%.

Regression seeds partially cover this, but they are not the same as an explicit
stability metric.

Rules:

1. **Baseline run set**: before applying a framework change, record the per-seed
   catch rate from the most recent benchmark runs. This is the baseline.
2. **Post-change run set**: after applying the change, record the same metric
   from the new benchmark runs.
3. **Stability delta**: for each seed, compute `post_catch_rate -
   baseline_catch_rate`. Any seed that drops by more than **0.3** (e.g., from
   1.0 to 0.67 or lower) is flagged as a **stability regression**.
4. **Cross-dimension check**: if the regressed seed is in a different dimension
   from the changed rules, flag it as an **attention-budget regression** — the
   change shifted attention away from another capability.

The scorer reports:

- number of stability regressions (any seed that dropped > 0.3)
- number of attention-budget regressions (stability regressions in a different
  dimension from the change)
- the specific seeds and dimensions involved

A suite with attention-budget regressions is not ready for benchmark
recertification until the regressions are resolved or explained.

To use this metric, pass a baseline run-results file to the scorer:

```bash
python3 harness-engineering/quality/scripts/score_eval_suite.py <suite-dir> \
  --baseline-results <path-to-previous-run-results.tsv>
```

## Statistical Rules

Coverage alone is not enough. Use these run rules:

1. Any suite used to justify a guard, prompt, or skills change needs at least 3
   saved runs after that change.
2. Report per-seed catch rate, not just one suite headline number.
3. Use false positive rate and severity accuracy alongside catch rate.
4. If results swing materially across runs, treat that as a stability problem in
   the eval system, not just an agent problem.
5. Use **targeted regression reruns** for previously unresolved seeds after a
   narrow change. Do not re-run already stable passes unless you are doing a
   full benchmark recertification.
6. A targeted regression pack is not a substitute for a benchmark suite. It is
   a fast follow-up instrument for misses and partials only.

## Status Labels

Use these labels when describing a suite:

| Label | Meaning |
|---|---|
| `exploratory` | Missing matrix coverage, controls, or saved multi-run data |
| `pilot` | Has seeds and some structure, but not enough coverage to claim stability |
| `benchmark` | Matrix complete, controls present, 3 saved runs, validator passes |
| `stable benchmark` | Benchmark plus repeated regression stability over later framework changes |

Do not describe exploratory or pilot suites as proof of stable capability.

## Domain Complexity Taxonomy

Bug nature and seed structure describe *what* the defect is and *how* it is
hidden. Domain complexity describes *how hard the underlying engineering problem
is* — independent of packaging.

A suite full of structurally Hard seeds can still be semantically trivial if
every planted defect represents a textbook issue wrapped in camouflage. Domain
complexity exists to prevent that failure mode.

### Complexity Tiers

| Tier | Bar | What it means |
|---|---|---|
| `textbook` | Junior/Mid | A known pattern violation that any competent developer should catch with local reasoning. Missing null check, unhandled error path, obvious SQL injection. Use sparingly — only for positive controls and baseline calibration. |
| `production` | Senior | A failure that requires understanding runtime behavior, system state, or operational context beyond what tests or linters surface. Works in dev, fails in prod. This is the **minimum default** for standard seeds. |
| `staff` | Staff | A failure arising from the interaction of multiple correct-looking components that manifests only under specific production conditions (scale, timing, partition, load shape). Genuinely dangerous, hard to solve, or hard to even see. Every individual piece passes review; the system-level risk is invisible without cross-boundary reasoning. |
| `principal` | Principal | A structural time bomb. The architecture works today but has a ceiling that will require a rewrite at a specific scale, compliance threshold, or operational condition. Finding it requires reasoning about the system's growth trajectory, not just its current behavior. The code is correct *now* — the failure is in what it becomes. |
| `distinguished` | Distinguished / Domain Expert | A failure that nobody is looking for. Exploits subtle properties of the underlying system — consensus protocol edge cases under asymmetric partition, precision loss that compounds invisibly over millions of operations, valid-looking authorization paths that grant escalation through graph traversal, or correctness proofs that don't hold under real-world clock skew. Requires deep domain expertise to even formulate the question. |

### High-Tier Seed Eligibility

A seed cannot count as `staff`, `principal`, or `distinguished` unless the
ledger proves **all** of the following:

1. **Local plausibility**: the artifact containing the defect looks correct or
   plausibly acceptable on its own — a competent reviewer would approve it
   without the cross-boundary context.
2. **Named concept requirement**: the failure requires a named engineering
   concept to catch (e.g., linearizability, read-your-writes, idempotency token
   lifecycle). If no concept name is needed, the seed is not staff+.
3. **Non-trivial discovery**: the bug is not discoverable by simple keyword
   search, grep, direct contradiction, or single-location inspection.
4. **Causal chain**: the expected answer requires reasoning through multiple
   steps of system behavior — not just issue spotting or pattern matching.
5. **Production context**: the fixture includes production context that makes
   the failure realistic. At least one of: load, topology, tenancy, ordering,
   consistency, timing, compliance, or failure mode.

Seeds that fail any criterion are capped at `production` regardless of how
complex the surrounding packaging is.

For new benchmark claims, the `seed-ledger.md` must include the staff+ fields
defined in `agent-isolation-eval-framework.md` (see Required Seed-Ledger Fields
for Staff+ Seeds) as the structured evidence for these criteria.

### Anti-Toy Rule

The following defect classes are valid as positive controls but **cannot be
classified as staff+ regardless of structural difficulty or how many files they
are spread across**:

- Obvious SQL injection
- Missing auth checks (single missing guard, not multi-step authz graph)
- Direct contradictions between spec and code
- `waitForTimeout` / sleep-based synchronization
- Hardcoded secrets or credentials
- Nullable foreign keys without justification
- Unhandled null returns on simple paths
- Missing input validation on a single endpoint

Spreading a textbook defect across multiple files increases structural
difficulty but does not increase domain complexity. A `distributed` +
`textbook` seed is still textbook.

This rule does **not** ban complex multi-step variants of these categories. A
multi-tenant authorization graph with delegation chains is not "missing auth
checks." A second-order injection via serialization boundary is not "obvious SQL
injection." The bar is: if a junior engineer with grep could find it, it is a
toy regardless of packaging.

### Classification Rules

Mark a seed `distinguished` when:

- The failure exploits a subtle property of the underlying system that most
  engineers don't know exists
- Finding it requires deep domain expertise (distributed systems theory,
  cryptographic properties, numerical analysis, protocol specifications)
- Even a Staff+ engineer would need specialized knowledge to see it
- The failure may be formally provable but practically invisible

Mark a seed `principal` when:

- The system works correctly today under current load and constraints
- The failure is a structural ceiling — it will break at a predictable future
  state (scale, regulatory change, data volume, team growth)
- Finding it requires reasoning about the system's trajectory, not just its
  current snapshot
- A Staff engineer doing a thorough review might feel uneasy but couldn't
  articulate the specific failure without growth-modeling reasoning

Mark a seed `staff` when **all** of these are true:

- The code is locally correct — it passes tests, type checks, and linters
- A senior engineer doing a standard review would likely approve it
- The failure requires reasoning about emergent system behavior: concurrency,
  distributed state, scale thresholds, time-dependent interactions, or
  multi-component composition
- Finding it requires operational experience or cross-boundary reasoning, not
  just careful local reading

Mark a seed `production` when:

- Local correctness is not enough to prove safety
- The failure depends on runtime conditions (load, timing, data volume,
  environment) that differ between dev and prod
- A senior engineer with operational experience would catch it during a
  focused review
- It represents the **minimum acceptable difficulty** for standard eval seeds

Mark a seed `textbook` when:

- The defect is identifiable from local code reading
- Standard patterns, linting rules, or test coverage would surface it
- It tests competence, not expertise
- **Use only for positive controls and baseline calibration** — textbook seeds
  should not dominate any benchmark suite

### Emergent Complexity Categories

These are the categories of Staff+-level production failures that evals should
exercise. Each category represents a class of bug that LLMs commonly miss and
that indicates a skill gap when an agent fails to catch it.

| Category | What it tests | Example failure |
|---|---|---|
| `concurrency_composition` | Race conditions, deadlocks, and ordering bugs that emerge only when multiple valid execution paths interleave | Two goroutines both check-then-act on a shared map; works under test load, corrupts under production parallelism |
| `distributed_state_divergence` | State inconsistency across boundaries when assumptions about ordering, delivery, or consistency break | Cache invalidation message arrives before the write it invalidates; stale reads appear correct for hours |
| `scale_threshold_collapse` | Algorithms or data structures that work at test scale but hit performance cliffs at production volume | O(n²) dedup in a batch job — passes 1K-record tests, OOMs at 500K |
| `retry_amplification` | Retry and timeout behavior that creates cascading load or resource exhaustion under partial failure | Exponential backoff without jitter + shared retry queue = thundering herd after brief outage |
| `data_loss_window` | Writes, migrations, or transitions that have a window where data is silently lost or corrupted | Blue-green deploy with async queue drain — messages in flight during cutover are dropped |
| `security_escalation_chain` | Multi-step privilege escalation or trust boundary violation that no single check prevents | Service A trusts Service B's JWT claims; Service B trusts user-provided metadata; chain grants admin |
| `invariant_erosion` | Invariants that hold initially but degrade over time through legitimate operations | Account balance constraint holds per-transaction but compounds floating-point drift over millions of ops |
| `observability_blind_spot` | Failures that are invisible to monitoring because the symptom doesn't trigger alerts | Silent data corruption — all health checks pass, latency is normal, but 0.1% of records are wrong |
| `configuration_interaction` | Valid individual configurations that produce dangerous behavior in combination | Feature flag A enables new code path; flag B disables the old safety check; together they bypass auth |
| `temporal_coupling` | Correctness depends on timing assumptions that hold in test but not in production | Cache TTL is shorter than the async job that populates it; intermittent stale reads under load |
| `migration_hazard` | Schema, protocol, or API migrations that work in testing but lose data or break compatibility during the rollover window | Add NOT NULL column with backfill — new code writes; old code reads fail during the deploy window |
| `resource_exhaustion_leak` | Slow resource leaks that only manifest after sustained production runtime | Connection pool leak under error path — grows by 1 per failed request, OOMs after 48h |
| `consensus_violation` | Distributed consensus, leader election, or coordination protocol bugs under partition or asymmetric failure | Split-brain during network partition — both sides accept writes, data diverges silently |
| `type_system_escape` | Runtime type violations that the static type system cannot catch due to serialization boundaries, dynamic dispatch, or external input | API returns `{"count": "42"}` (string) — TypeScript interface says number, JSON.parse doesn't validate, downstream math silently produces NaN |

### Suite Depth Requirements

Benchmark suites must declare domain complexity per seed in `seed-catalog.tsv`
(new column: `domain_complexity`).

Depth composition is calculated over **depth-eligible seeds**: all seeds except
`negative_control`. Negative controls are still mandatory, and they may be
complex, but they measure false-positive discipline rather than the agent's
ability to catch seeded failures. They do not satisfy staff/principal/
distinguished catch-depth floors.

Capability difficulty tiers and advanced seed-structure gates are calculated
over the same non-`negative_control` seed set. A suite cannot satisfy Hard-tier
or advanced-structure coverage using only false-positive traps.

The v2 harness treats `domain_complexity`, `complexity_category`, and
`engineering_concepts` as required seed-catalog fields. Older catalogs must be
rewritten or regenerated before they can validate against the current benchmark
contract.

**Minimum depth composition for benchmark suites:**

| Complexity tier | Floor | Role in suite |
|---|---|---|
| `textbook` | **max 10%** | Positive controls only — proves the agent is awake, nothing more |
| `production` | **max 10%** | Senior-level baseline — the easiest "real" seeds in the suite |
| `staff` | **at least 35%** | Cross-boundary emergent failures — the bread and butter |
| `principal` | **at least 25%** | Architectural time bombs and growth-trajectory failures |
| `distinguished` | **at least 20%** | Deep domain expertise failures — the ceiling test |

**At least 80% of depth-eligible seeds must be staff, principal, or
distinguished.**

These floors mean a 54-seed benchmark suite with 11 negative controls and 43
depth-eligible seeds contains roughly:
- ~4 textbook positive controls
- ~4 production senior-baseline seeds
- ~15-16 staff
- ~11 principal
- ~9 distinguished
- plus the required negative controls, scored through false-positive metrics

Seeds at `staff` or above must cite which complexity category they exercise.

### Shallow-Hard Ban

A seed labeled `Hard` (structural difficulty) but `textbook` or `production`
(domain complexity) represents packaging difficulty without substance. These
seeds:

- **Cannot satisfy benchmark depth floors** — they do not count toward the
  required staff/principal/distinguished percentages.
- **Require explicit justification** in the seed ledger explaining why the
  structural difficulty is warranted despite low domain complexity.
- **Are capped at 20% of Hard seeds** — if more than 20% of a suite's Hard
  seeds are textbook or production, the suite is gaming structural difficulty
  without real depth.

The validator flags suites that exceed the 20% shallow-Hard threshold.

Shallow-Hard seeds may still exist (they exercise structural reasoning under
easy domain conditions), but they cannot substitute for genuine depth. A suite
that meets its Hard seed count but fails the depth floor because too many Hard
seeds are shallow is not benchmark-ready.

**For Architect and Code Review specifically**, the floors shift even higher
because these agents exist to catch the failures nobody else sees:

| Complexity tier | Floor for Architect/CR |
|---|---|
| `textbook` | **max 5%** (controls only) |
| `production` | **max 10%** |
| `staff` | **at least 30%** |
| `principal` | **at least 30%** |
| `distinguished` | **at least 25%** |

**At least 85% of Architect/CR depth-eligible seeds must be staff, principal, or
distinguished.**

Pilot suites may have fewer high-tier seeds, but they must explicitly
acknowledge the gap and cannot claim benchmark status until the floors are met.

### Minimum Seed Count

Benchmark suites must contain at least **54 seeds** to claim stable benchmark
status. Suites below 36 seeds are pilot-grade regardless of other qualities.

For agents that are responsible for catching system-level or architectural
failures (Architect, Code Review, Security), the target should be **72+ seeds**
to provide enough coverage across complexity categories at the higher tiers.

### Using Eval Results To Surface Skill Gaps

When an agent consistently misses seeds in a specific complexity category or
engineering concept domain:

1. That category/concept represents a **confirmed skill gap** — the agent lacks
   the domain knowledge or reasoning pattern to catch that class of failure
2. The gap should be escalated as a candidate for a new skill file, guard, or
   reference material
3. Track resolution across subsequent eval runs to confirm the skill addition
   actually improves catch rate

**The eval suite is a skill-gap scanner, not a scorecard.** The goal is not to
achieve a high pass rate — it is to systematically reveal what the agents cannot
reason about so you know exactly what to build next.

## Engineering Concept Probing

### Purpose

The complexity tiers (textbook through distinguished) describe *how hard* the
failure is. Engineering concept domains describe *what knowledge* is required
to catch it. Both must be tracked to produce actionable skill-gap diagnostics.

A suite that is hard but narrow (all seeds test concurrency) will tell you the
agent's concurrency ability but leave every other domain unmeasured. A suite
that probes broadly across engineering concepts will tell you *which domains*
the agent is blind in — which is what drives the skill-building roadmap.

### Engineering Concept Taxonomy

Every seed must declare which engineering concept(s) it requires the agent to
understand. Use these domain codes in `seed-catalog.tsv` (new column:
`engineering_concepts`, comma-separated).

#### Systems & Infrastructure

| Concept code | Domain | Example knowledge required |
|---|---|---|
| `distributed-consensus` | Distributed systems | CAP theorem, linearizability, leader election, split-brain |
| `distributed-state` | Distributed systems | Eventual consistency, CRDTs, vector clocks, causal ordering |
| `networking` | Network engineering | TCP behavior under loss, DNS caching, TLS handshake, MTU issues |
| `load-balancing` | Infrastructure | Consistent hashing, connection draining, health check races |
| `service-mesh` | Infrastructure | Circuit breakers, retry budgets, timeout cascades, sidecar failure |
| `message-queues` | Async systems | At-least-once delivery, ordering guarantees, dead letters, backpressure |
| `stream-processing` | Data systems | Watermarks, late arrivals, exactly-once semantics, checkpoint recovery |
| `container-orchestration` | Infrastructure | Pod scheduling, resource limits, liveness vs readiness, rolling deploy |

#### Data & Storage

| Concept code | Domain | Example knowledge required |
|---|---|---|
| `database-internals` | Storage | MVCC, WAL, vacuum, index bloat, lock escalation, connection pooling |
| `query-optimization` | Databases | Plan regression, statistics staleness, implicit casts preventing index use |
| `schema-evolution` | Databases | Online DDL, backfill strategies, dual-write periods, ghost tables |
| `replication` | Databases | Replication lag, read-your-writes, monotonic reads, failover data loss |
| `caching-systems` | Data | Cache stampede, invalidation races, cold-start thundering herd |
| `data-modeling` | Architecture | Normalization tradeoffs, aggregate boundaries, eventual consistency |
| `file-systems` | Storage | fsync guarantees, rename atomicity, inode exhaustion, NFS staleness |
| `serialization` | Data | Schema compatibility, protobuf wire format, JSON precision loss |

#### Concurrency & Performance

| Concept code | Domain | Example knowledge required |
|---|---|---|
| `concurrency-primitives` | Systems | Mutex vs RWLock, compare-and-swap, memory ordering, false sharing |
| `async-execution` | Runtime | Event loop starvation, callback ordering, cancellation propagation |
| `memory-management` | Systems | GC pauses, allocation pressure, off-heap leaks, fragmentation |
| `cpu-architecture` | Performance | Cache lines, branch prediction, NUMA effects, vectorization |
| `io-patterns` | Performance | Readahead, page cache, direct I/O, write amplification |
| `gc-behavior` | Runtime | Stop-the-world pauses, promotion rates, tenuring, large-object space |
| `thread-safety` | Concurrency | Happens-before, publication safety, safe initialization, volatility |
| `backpressure` | Systems | Unbounded queues, flow control, token bucket, adaptive concurrency |

#### Security & Trust

| Concept code | Domain | Example knowledge required |
|---|---|---|
| `authn-protocols` | Security | OAuth flows, token lifecycle, refresh rotation, session fixation |
| `authz-models` | Security | RBAC vs ABAC, delegation chains, confused deputy, scope escalation |
| `cryptography` | Security | Key rotation, IV reuse, padding oracle, timing attacks, KDF choice |
| `supply-chain` | Security | Dependency confusion, typosquatting, lockfile integrity, SBOM gaps |
| `injection-classes` | Security | Second-order injection, SSRF via redirect, template injection |
| `trust-boundaries` | Security | Deserialization gadgets, JWT claim trust, internal service auth |
| `secrets-management` | Security | Rotation windows, envelope encryption, HSM boundaries, audit gaps |

#### Correctness & Logic

| Concept code | Domain | Example knowledge required |
|---|---|---|
| `numerical-computing` | Math | Floating-point accumulation, catastrophic cancellation, overflow |
| `state-machines` | Logic | Illegal transitions, event reordering, compensating actions |
| `invariant-preservation` | Logic | Multi-step invariants, partial failure compensation, saga patterns |
| `time-handling` | Logic | Timezone conversion, leap seconds, clock skew, monotonic vs wall |
| `encoding-boundaries` | Logic | Unicode normalization, surrogate pairs, locale-dependent sorting |
| `error-propagation` | Logic | Error context loss, retry-safe errors, idempotency token lifecycle |
| `ordering-guarantees` | Logic | Stable sort assumptions, map iteration order, message reordering |

#### Architecture & Design

| Concept code | Domain | Example knowledge required |
|---|---|---|
| `api-evolution` | Design | Versioning strategies, deprecation windows, backwards compatibility |
| `dependency-management` | Design | Diamond dependencies, version resolution, semver violations |
| `modularity` | Design | Coupling metrics, circular dependencies, package boundaries |
| `migration-strategy` | Architecture | Strangler fig, parallel run, feature flags, data dual-write |
| `multi-tenancy` | Architecture | Isolation levels, noisy neighbor, tenant-scoped resources |
| `event-sourcing` | Architecture | Projection rebuild, schema evolution, snapshot strategy |
| `observability-design` | Operations | Cardinality explosion, trace propagation, metric aggregation |
| `capacity-planning` | Operations | Load testing validity, headroom policy, scaling triggers |

#### Testing & Quality

| Concept code | Domain | Example knowledge required |
|---|---|---|
| `test-isolation` | Testing | Shared state in test fixtures, port conflicts, time-dependent tests |
| `property-testing` | Testing | Shrinking, generators, stateful testing, metamorphic relations |
| `chaos-engineering` | Testing | Failure injection, blast radius, steady state hypothesis |
| `contract-testing` | Testing | Consumer-driven contracts, provider verification, schema drift |
| `load-testing` | Testing | Coordinated omission, closed vs open workload, warmup periods |

### Concept Probing Rules

1. **Breadth first**: A benchmark suite should probe as many concept domains as
   is reasonable for the agent's role. Architect evals should touch at least
   **15 distinct concept codes**. Code Review should touch at least **20**.
   Programmer should touch at least **25**.

2. **One seed per concept minimum**: Every probed concept must have at least one
   seed that *requires* that concept to catch the failure. If the seed can be
   caught without the concept knowledge, it does not count as probing that
   concept.

3. **Concept-level catch rates are the primary diagnostic output**: Report
   per-concept catch rates in every eval summary. Concepts with < 50% catch
   rate across runs are **confirmed skill gaps**.

4. **Gap reporting, not automatic skill creation**: Confirmed skill gaps are
   documented in the run report with enough context for a human to decide what
   to do. The report should include: concept code, complexity tier, missed
   seed IDs, what knowledge would have been required, and whether a relevant
   skill already exists. **Do not automatically create skills, guards, or
   instructions from eval results.** The human decides what to build and when.

5. **Eval-driven development (optional workflow)**: When you choose to address
   a gap, you can write seeds for the concept first, verify the agent fails,
   build the skill, then re-run to confirm improvement. This is a useful
   workflow but it is human-initiated — not something the system does on its
   own.

### Relationship Between Concepts and Complexity Tiers

Concept codes and complexity tiers are orthogonal:

- A `caching-systems` seed at `production` tier might test a simple cache
  stampede under load
- A `caching-systems` seed at `distinguished` tier might test a cache
  invalidation protocol that violates linearizability under a specific
  interleaving of write and invalidation messages

The concept says *what knowledge*. The tier says *how deep*. Both dimensions
must be tracked. A suite that covers 30 concepts but all at `production` tier
will find shallow gaps. A suite that covers 5 concepts at `distinguished` will
  find deep gaps in narrow areas. You need both.

### Concept × Complexity Matrix Reporting

Every benchmark suite must report a **concept × complexity matrix** — not just
aggregate seed counts or single-dimension breakdowns.

**Required reporting artifact:**

The `coordinator-eval-summary.md` must include a matrix with:
- Rows: engineering concept codes probed by the suite
- Columns: complexity tiers (`textbook`, `production`, `staff`, `principal`,
  `distinguished`)
- Cells: seed count and catch rate for that concept at that tier

**Why this matters:**

Seed counts alone hide clustering. A suite with 30 "hard" seeds that all test
`caching-systems` at `staff` tier has not proven breadth. The matrix makes it
impossible to hide 30 seeds that all test the same easy pattern by spreading
them across structural difficulty tiers.

**Rules:**

1. The matrix must be generated from `seed-catalog.tsv` cross-referenced with
   `run-results.tsv` — not assembled from memory.
2. Empty cells are acceptable when explicitly pruned. Unexplained empty cells
   in probed concepts are coverage gaps.
3. Any concept that appears only at `textbook` or `production` tier is not
   being seriously tested — flag it in the summary.
4. Any complexity tier that covers fewer than 3 distinct concepts is
   suspiciously narrow — flag it in the summary.
5. The scorer should emit the matrix automatically when both `engineering_concepts`
   and `domain_complexity` columns are present in `seed-catalog.tsv`.

**Benchmark certification gate:**

A suite cannot achieve `benchmark` or `stable benchmark` status if its concept ×
complexity matrix reveals that more than 50% of staff+ seeds share the same
engineering concept. Depth requires breadth across concepts, not just vertical
difficulty in one domain.

## Practical Targeting

You do not need to fill every imaginable cell. You do need to know which cells
you intentionally left empty and why.

The right question is not "did we reach 100%?" The right question is "what
engineering concepts and complexity tiers are untested, and which confirmed
gaps don't yet have a skill to address them?"

## Optional Extension Columns

When a suite needs to prove breadth across architecture families or skill
surfaces, extend the suite TSVs with:

- `coverage-matrix.tsv`
  - `architecture_family`
- `seed-catalog.tsv`
  - `architecture_family`
  - `expected_conditional_skills`
  - `expected_non_activations`

Use normalized comma-separated skill slugs such as:

- `hexagonal-architecture`
- `observability-implementation`
- `performance-engineering`
- `change-management`
- `api-design`
- `rag-ai-integration`
- `llm-operations`
- `data-engineering`

These fields are optional at the shared-framework level so older suites remain
valid, but once a suite adopts them they should be treated as part of that
suite's canonical schema and reported in the scorer output.
