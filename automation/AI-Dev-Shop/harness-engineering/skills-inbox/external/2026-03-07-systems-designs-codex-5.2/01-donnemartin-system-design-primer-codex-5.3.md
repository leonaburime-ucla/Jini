# Distilled Learnings: donnemartin / system-design-primer (codex-5.2, deep pass)

Source repo: https://github.com/donnemartin/system-design-primer

This deep pass distills both the core primer topics and the linked solution docs, not just top-level README summaries.

## 1) The Strongest Reusable Pattern in This Repo
The primer repeatedly enforces a 4-step design loop that should become a hard skill contract:
1. Outline use cases, constraints, assumptions.
2. Create high-level design.
3. Design core components.
4. Scale the design by bottleneck.

Skill implication:
- Reject architecture outputs that skip step 1 or step 4.
- Require explicit “what bottleneck are we fixing?” before adding complexity.

## 2) What “Good” Looks Like (Concrete from Source Solutions)
The solution docs consistently include:
- scope trimming (in-scope + out-of-scope),
- numeric assumptions,
- back-of-envelope traffic/storage,
- data model sketch,
- API sketch,
- scaling and “additional talking points” sections.

Examples of numeric grounding used in-source:
- `twitter`: ~6,000 tweets/sec ingest, ~60,000 fanout writes/sec, ~100k reads/sec.
- `web_crawler`: ~2 PB/month content ingestion, ~40,000 search req/sec.
- `sales_rank`: ~40,000 reads/sec with hourly batch ranking updates.
- `mint`: write-heavy profile (10:1 writes:reads), asynchronous transaction extraction.

Skill implication:
- Every design answer must include at least one traffic estimate and one storage estimate.
- Every design answer must map one estimate to one architecture choice.

## 3) High-Value Design Moves Observed Across Multiple Solutions

### 3.1 Asynchrony for expensive side effects
Observed in `mint`, `twitter`, `web_crawler`, `sales_rank`:
- User-facing request path stays fast.
- Slow work is pushed to queues/workers (fanout, indexing, enrichment, notifications).

Concrete reuse rule:
- If an operation exceeds latency budget and can tolerate delay, route it through queue + worker with retry policy.

### 3.2 Split serving path from processing path
Observed pattern:
- Read-serving components are isolated from write/compute-heavy paths.
- Batch/offline pipelines (e.g., ranking) produce materialized outputs for fast reads.

Concrete reuse rule:
- For read-heavy systems, optimize query path separately from ingestion/aggregation path.

### 3.3 Data store plurality by workload
Observed pattern:
- SQL used for relational/integrity-sensitive entities.
- NoSQL/cache/object store used for high-write/high-read fanout, ephemeral state, or blobs.

Concrete reuse rule:
- Force per-entity storage rationale instead of one global DB choice.

## 4) Primer Core Concepts Worth Encoding Verbatim as Decision Gates

### 4.1 CAP and consistency selection
From primer:
- Partition tolerance is non-negotiable in distributed systems.
- Tradeoff is consistency vs availability under partition.

Skill gate:
- Each critical path must declare CP/AP bias and why.

### 4.2 Consistency pattern mapping
From primer:
- Weak consistency: best-effort visibility.
- Eventual consistency: async convergence.
- Strong consistency: read-after-write correctness.

Skill gate:
- For each user-visible operation, require selected consistency level and UX consequence.

### 4.3 Availability math
From primer:
- Three 9s vs four 9s changes monthly downtime budget materially.
- Component composition (in-series vs in-parallel) changes total availability drastically.

Skill gate:
- Require uptime target and at least one dependency availability composition check.

## 5) Caching: The Most Operationally Useful Section to Encode
The primer’s cache section is implementation-ready and should become policy:
- Cache-aside, write-through, write-behind, refresh-ahead are all valid with tradeoffs.
- Cache invalidation is the hardest part and must be explicit.
- Query-level caching has invalidation blast-radius issues.
- Object-level caching is often easier to reason about for invalidation and async workflows.

Concrete defaults to encode:
- Default to cache-aside for read-heavy endpoints.
- Add TTL + explicit invalidation trigger.
- Declare stale-read tolerance in product terms.
- Add warmup/cold-node strategy when autoscaling.

## 6) Asynchrony and Back Pressure: Non-Optional for Scale
Primer guidance:
- Queues reduce inline latency and smooth bursts.
- Back pressure is required when queue depth grows (e.g., return 503 + retry/backoff).
- Message brokers have different guarantees and operational costs.

Skill-level enforcement:
- Any queued workflow must specify:
  - retry policy,
  - dedupe/idempotency strategy,
  - poison-message handling (DLQ),
  - back pressure behavior when overloaded.

## 7) Deep Extraction from System Examples (What to Reuse)

### 7.1 `pastebin`: ID generation + storage split
Reusable insights:
- Keep shortlink metadata and blob content separate.
- Use deterministic URL-safe encoding strategy (e.g., Base62) and collision handling policy.
- Expiration handling should be background cleanup path, not user read path.

### 7.2 `twitter`: fanout architecture reality
Reusable insights:
- “Post” latency and “fanout completion” latency are different objectives.
- Heavy follower fanout requires write-optimized path and async notification/indexing.
- Home timeline and user timeline have distinct storage/read patterns.

### 7.3 `web_crawler`: duplicate/cycle control
Reusable insights:
- Crawl frontier ranking + duplicate signatures are central to cost control.
- Crawl freshness policy must be explicit (not “crawl everything all the time”).
- Queueing index/snippet generation decouples crawl throughput from search serving.

### 7.4 `sales_rank`: batch aggregation pattern
Reusable insights:
- Log-first ingestion + periodic aggregation is practical for top-k ranking.
- Materialized ranking tables give predictable read latency.
- Update cadence (hourly vs near-realtime) is a product tradeoff, not only technical.

### 7.5 `social_graph`: distributed BFS constraints
Reusable insights:
- Graph traversal over sharded data causes lookup chatter; locality matters.
- Lookup service can become a hotspot and needs scaling strategy.
- Simpler graph algorithms can break under distribution costs.

### 7.6 `scaling_aws`: iterative bottleneck method
Reusable insights:
- Start simple, measure, then scale in steps.
- Vertical scaling is fastest early move; horizontal scaling is long-term move.
- Security/networking and static asset separation appear early, not “later.”

## 8) A Better Decision Matrix (Skill-Ready)

| Decision Area | Default | Escalate When | Mandatory Caveat |
|---|---|---|---|
| Primary store | SQL | strict integrity + known relational joins | include partition/replica strategy for growth |
| High-throughput event/feed path | NoSQL/cache | write/read amplification dominates | consistency model must be explicit |
| Blob/media storage | Object store | payloads are large/unstructured | separate metadata from blob path |
| Queue introduction | async slow side effects | inline path breaches latency budget | idempotency + DLQ required |
| Cache strategy | cache-aside | read-heavy with hot keys | invalidation + TTL + stale policy required |
| Scale step | vertical first | cost/limits become bottleneck | must show measurement evidence |

## 9) Anti-Patterns and Remediations (Grounded in Primer)
- Anti-pattern: adding distributed systems primitives before identifying bottleneck.
  - Remediation: enforce “measured bottleneck -> chosen pattern” mapping.
- Anti-pattern: selecting SQL/NoSQL by trend.
  - Remediation: require access-pattern and consistency rationale per entity.
- Anti-pattern: caching without invalidation ownership.
  - Remediation: require invalidation trigger owner and freshness SLO.
- Anti-pattern: queueing without back pressure.
  - Remediation: require overload behavior and client retry semantics.
- Anti-pattern: availability claims without composition math.
  - Remediation: require target 9s + component dependency model.

## 10) Drop-In Skill Contract (Template Seed)
Use this as the minimum section contract for a systems-design skill output:

```md
## A. Scope and Constraints
- In-scope / out-of-scope
- Traffic and storage assumptions
- Read/write ratio and latency targets

## B. High-Level Design
- Components and critical request/data paths
- Why these components (tradeoff statement)

## C. Core Component Deep Dives
- Data model and storage choice per entity
- API and contract boundaries
- Cache and async strategy

## D. Consistency, Availability, and Failure
- CP/AP bias by workflow
- Consistency level by operation
- Failover/degradation/recovery strategy
- Back pressure behavior

## E. Scale Plan
- Current bottleneck
- Next architecture move
- Trigger metrics for next migration

## F. Observability and Operations
- SLIs/SLOs
- Alerts and ownership
- Runbook links or steps
```

## 11) Quality Bar for the Next 9 Files
- Include at least 5 source-grounded concrete examples.
- Include at least 1 decision matrix.
- Include at least 5 anti-pattern/remediation pairs.
- Include one drop-in skill contract snippet.
- Include references to top-level and linked pages used.

## References
- Source article: https://www.kdnuggets.com/10-github-repositories-to-master-system-design
- Source repository: https://github.com/donnemartin/system-design-primer
- Primary source file: https://raw.githubusercontent.com/donnemartin/system-design-primer/master/README.md
- Solution doc: https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/pastebin/README.md
- Solution doc: https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/twitter/README.md
- Solution doc: https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/web_crawler/README.md
- Solution doc: https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/sales_rank/README.md
- Solution doc: https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/mint/README.md
- Solution doc: https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/social_graph/README.md
- Solution doc: https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/scaling_aws/README.md
