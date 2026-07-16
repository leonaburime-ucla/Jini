# Distilled Learnings: InterviewReady / system-design-resources (codex-5.2, deep pass)

Source repo: https://github.com/InterviewReady/system-design-resources

## 1) What This Source Adds
- Broad practical reading map with strong emphasis on advanced production concerns:
  - rate limiting
  - distributed logs/metrics
  - consensus
  - stream processing
  - distributed transactions
  - authorization
- Includes a top-20 question list useful for stress-testing architecture templates.

## 2) Distilled Learnings

### 2.1 Production completeness beats clean diagrams
- Real systems need operational control planes (limits, observability, recovery) from day one.
- “API + DB + cache” is insufficient without cross-cutting protections.

Skill gate:
- Require operational controls section before final architecture approval.

### 2.2 Event-driven and distributed patterns require explicit correctness constraints
- Queue/stream additions change transaction boundaries and failure semantics.
- Distributed transactions and consistency patterns must be designed, not assumed.

Skill gate:
- Any async/event design must declare consistency, dedupe, and recovery semantics.

### 2.3 Topic breadth is valuable for scenario-based training
- The question set spans social, booking, cloud, payments, chat, location, gaming, file, email, and video.
- This encourages architecture transfer across domains.

Skill gate:
- Require domain-agnostic architecture reasoning with domain-specific constraints layered in.

## 3) Concrete Enrichment Pattern
- Start with core architecture.
- Add:
  - gateway rate limiting and abuse controls
  - tracing + centralized logs + metrics
  - persistence replication/failover
  - async pipeline for expensive workflows
  - authz model and token lifecycle

## 4) Anti-Patterns and Fixes
- Anti-pattern: observability as post-launch task.
  - Fix: require SLIs and alerts as design-time artifacts.
- Anti-pattern: queue added with no failure semantics.
  - Fix: require idempotency, retry, DLQ, replay model.
- Anti-pattern: consensus/distributed transaction named but not scoped.
  - Fix: require exact operations that need distributed guarantees.

## 5) Decision Matrix (Skill-Ready)

| Cross-Cutting Concern | Minimum Requirement | Failure if Missing |
|---|---|---|
| Rate limiting | policy + per-tenant scope + fallback response | easy abuse/overload |
| Observability | logs + metrics + traces + alert owners | slow incident diagnosis |
| Replication/failover | RPO/RTO target + failover path | availability claims not credible |
| Authz | trust boundaries + token lifecycle | privilege escalation risks |

## 6) Drop-In Skill Contract Additions
```md
## Operational Completeness
- Rate limiting and abuse controls
- Logging/metrics/tracing plan
- Replication and failover behavior
- Authorization boundaries and token model
- Async correctness semantics
```

## References
- Source article: https://www.kdnuggets.com/10-github-repositories-to-master-system-design
- Source repository: https://github.com/InterviewReady/system-design-resources
- Primary source file: https://raw.githubusercontent.com/InterviewReady/system-design-resources/main/README.md
- Supplemental source file: https://raw.githubusercontent.com/InterviewReady/system-design-resources/main/top-20-questions.md
