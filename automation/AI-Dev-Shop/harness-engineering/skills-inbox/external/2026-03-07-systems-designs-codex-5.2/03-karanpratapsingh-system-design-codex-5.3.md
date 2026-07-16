# Distilled Learnings: karanpratapsingh / system-design (codex-5.2, deep pass)

Source repo: https://github.com/karanpratapsingh/system-design

## 1) What This Source Adds
- Full-stack curriculum continuity: networking fundamentals -> databases/distributed systems -> architecture patterns -> interviews/case studies.
- Strong emphasis on operational implications of foundational choices (DNS, TCP/UDP, load balancing, caching, storage types).
- Useful bridge between theory (`CAP`, `PACELC`, `ACID/BASE`) and system patterns (`EDA`, `CQRS`, API gateway, service discovery).

## 2) Core Distilled Learnings

### 2.1 Foundation-first architecture is a productivity multiplier
- Networking and storage assumptions are first-order architecture constraints, not implementation details.
- Teams that skip fundamentals overfit to framework-level design patterns.

Skill gate:
- Require a short “foundation assumptions” block before service decomposition.

### 2.2 Data and consistency choices must be per-workflow
- `ACID/BASE` and `CAP/PACELC` should be attached to specific operations.
- Sharding, replication, and federation need query-path and rebalance rationale.

Skill gate:
- Every workflow must declare consistency level and replication expectation.

### 2.3 Pattern selection should track team/domain maturity
- Monoliths are often best early for cohesion and change velocity.
- Microservices are justified when domain boundaries and scaling asymmetry are clear.

Skill gate:
- Require explicit “why not microservices yet?” or “why not monolith now?” note.

## 3) Concrete Example Applications
- Chat architecture:
  - WebSocket session path + async queue for notifications/offline delivery.
  - storage split between hot session state and durable history/media.
- URL shortener:
  - deterministic/unique key generation + collision strategy.
  - cache-aside read path for hot short codes.
- Ride matching:
  - geospatial lookup + event stream updates.
  - latency SLO dominates database normalization purity.

## 4) Anti-Patterns and Fixes
- Anti-pattern: adopting distributed patterns before defining bounded contexts.
  - Fix: enforce domain map first, then select architecture.
- Anti-pattern: citing CAP/PACELC without user-facing impact.
  - Fix: require “what user sees under partition” statement.
- Anti-pattern: sharding without operational ownership.
  - Fix: require partition key + hot shard mitigation + rebalance plan.
- Anti-pattern: SLOs omitted until production.
  - Fix: SLI/SLO table required in architecture artifact.

## 5) Decision Matrix (Skill-Ready)

| Decision Area | Default | Escalate To | Mandatory Caveat |
|---|---|---|---|
| Service shape | modular monolith | microservices when domains and scaling diverge | domain boundaries documented |
| Data model | SQL for relational invariants | polyglot store for asymmetric workloads | consistency per workflow declared |
| Comms style | REST for external APIs | gRPC/events for internal/high-throughput paths | retry/idempotency semantics required |
| Reliability | replication + health checks | active-active/failover mesh | conflict/failover behavior documented |

## 6) Drop-In Skill Contract Additions
```md
## Foundation and Data Discipline
- Network/protocol assumptions
- Consistency model per workflow
- Partition/replication strategy
- Domain boundaries and service split rationale
- SLA/SLO/SLI mapping to user journeys
```

## 7) Merge Guidance
- Merge this source with `01` to enforce foundation-first architecture quality.
- Use it to prevent “pattern cargo culting” in final skill outputs.

## References
- Source article: https://www.kdnuggets.com/10-github-repositories-to-master-system-design
- Source repository: https://github.com/karanpratapsingh/system-design
- Primary source file: https://raw.githubusercontent.com/karanpratapsingh/system-design/master/README.md
- Diagram index: https://github.com/karanpratapsingh/system-design/tree/master/diagrams
