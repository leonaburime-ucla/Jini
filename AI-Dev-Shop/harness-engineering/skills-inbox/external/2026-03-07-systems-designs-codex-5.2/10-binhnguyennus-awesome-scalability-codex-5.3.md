# Distilled Learnings: binhnguyennus / awesome-scalability (codex-5.2, deep pass)

Source repo: https://github.com/binhnguyennus/awesome-scalability

## 1) What This Source Adds
- A large curated map focused on practical scale outcomes:
  - principles
  - scalability
  - availability
  - stability
  - performance
  - intelligence
  - architecture/interview/org dimensions
- Valuable because it ties technical architecture to operational and organizational capability.

## 2) Distilled Learnings

### 2.1 Diagnose problem class before prescribing solution
- The source frames “system slow” as either scalability or performance and treats them differently.
- This avoids common over-engineering mistakes.

Skill gate:
- Require initial problem classifier:
  - performance bottleneck
  - scalability bottleneck
  - availability/stability bottleneck.

### 2.2 Reliability is layered and cumulative
- Availability targets, resilience design, incident response, and operational rigor must align.
- You cannot buy reliability with one technology choice.

Skill gate:
- Require reliability plan with prevention + detection + recovery.

### 2.3 Architecture and organization co-evolve
- The source includes organization patterns because team shape constrains architecture evolution.
- Architecture shifts without ownership maturity usually fail.

Skill gate:
- Require ownership/readiness check for major complexity increases.

## 3) Concrete Architecture Guardrails
- High-throughput APIs:
  - set layer-specific latency budgets (edge/app/db).
  - add load shedding and graceful degradation.
- Global content systems:
  - use CDN + regional failover + cache hierarchy.
  - define stale-content and origin-failure behavior.
- Data/ML-intensive systems:
  - separate online serving path from heavy offline processing.
  - define capacity and retry budgets explicitly.

## 4) Anti-Patterns and Fixes
- Anti-pattern: scaling infra before identifying real bottleneck.
  - Fix: require profiling evidence before architecture escalation.
- Anti-pattern: treating performance as optional.
  - Fix: SLI/SLO for latency and throughput required at design time.
- Anti-pattern: introducing distributed complexity without ops maturity.
  - Fix: include team capability and runbook readiness checks.
- Anti-pattern: “high availability” claim without failure drills.
  - Fix: require failover test cadence and measured recovery targets.

## 5) Decision Matrix (Skill-Ready)

| Problem Class | Primary Response | Required Validation |
|---|---|---|
| Performance (single-node slow) | optimize code/data path | benchmark before/after |
| Scalability (degrades under load) | distribute load + partition + cache | load test at target concurrency |
| Availability/stability | redundancy + isolation + recovery controls | RPO/RTO and failover drill evidence |

## 6) Drop-In Skill Contract Additions
```md
## Scale and Reliability Contract
- Problem class diagnosis
- Bottleneck evidence
- Proposed mitigation by layer
- Degradation and failover behavior
- SLO targets and validation plan
- Ownership/runbook readiness
```

## 7) Merge Guidance
- Use this source to harden operational realism in the final skill.
- Pair with `01` for architecture method and with `07` for observability/security completeness.

## References
- Source article: https://www.kdnuggets.com/10-github-repositories-to-master-system-design
- Source repository: https://github.com/binhnguyennus/awesome-scalability
- Primary source file: https://raw.githubusercontent.com/binhnguyennus/awesome-scalability/master/README.md
