# Architect Evals — TODO

## Current State

- Canary eval complete: `arch-eval-1-billing-ledger-migration` (33 seeds —
  SEED-ARCH-13 was removed in the post-canary audit; earlier "34" claims are
  off by one)
- Agent (Claude Opus subagent) scored 94% — strong performance, 4 partials on
  subtle T3/T4 seeds. NOTE: no per-seed run record was retained for that run;
  future runs must persist run-manifest.tsv / run-results.tsv rows.
- Seed-ledger audited by Gemini 3.1 Pro and GPT-5.5, corrections applied
- Fixture docs grounded with all necessary signals for the 33 seeds
- 2026-07-03: suite migrated to the standard eval schema — seed-catalog.tsv
  backfilled with all 33 seeds + depth columns (domain_complexity,
  complexity_category, engineering_concepts), coverage-matrix.tsv rebuilt,
  suite-level seed-ledger.md added with structured staff+ entries.
  `validate_eval_suite.py` passes (pilot label; needs 3+ benchmark_full runs
  and 36+ seeds for benchmark label).
- 2026-07-03: **first retained runs** — 3-arm Opus 4.8 skills ablation
  (bare / format / full). Self-scores 78.8 / 90.9 / 95.5%; blind Opus judge
  80.3 / 92.4 / 93.9% (94.9% grader agreement). Brief lift +12.1 pts, skills
  lift beyond brief only +1.5–4.5 pts. `run-manifest.tsv` (3 rows) +
  `run-results.tsv` (99 rows) persisted; ADR run dirs are gitignored.
  Full writeup: `ABLATION-2026-07-03-opus48-3arm.md`.
  Discriminating seeds (missed even by full arm): SEED-ARCH-17, -31, -34 →
  skill-gap candidates.

## Next: Multi-Scenario Expansion

Target: **6 scenarios × ~40 seeds each = ~240 total seeds**

| # | Scenario | Domain | Dominant Drivers | Status |
|---|----------|--------|-----------------|--------|
| 1 | Billing ledger migration | Brownfield B2B fintech | Compliance, data integrity, operability, migration safety | DONE (34 seeds) — needs ~6 more to reach 40 |
| 2 | Flash-sale ticketing | Greenfield consumer | Performance, scalability, data consistency ("no double-sell"), reliability | NOT STARTED |
| 3 | B2B partner integration hub | Brownfield enterprise | Integration complexity, modifiability, cognitive load, operability | NOT STARTED |
| 4 | Enterprise RAG assistant | Greenfield AI/ML | Tenant isolation, security, compliance, cost, AI-specific conditional skills | NOT STARTED |
| 5 | Real-time collaboration platform | Greenfield consumer | Reliability, scalability, deployment independence, performance | NOT STARTED |
| 6 | Fintech regulatory migration | Brownfield regulated | Compliance so heavy Simplicity Gate should be overridden, migration safety, security | NOT STARTED |

## Seed Design Requirements

Per scenario, seeds must cover these categories:

| Category | Description | Seeds/scenario |
|----------|-------------|---------------|
| A: Axis activation | FN (must activate) + FP (must NOT activate) | 3-4 |
| B: Score calibration | Too high + too low | 6-8 |
| C: Blocking / over/under-blocking | Reject when fatal + approve-with-conditions when borderline | 6-8 |
| D: Adaptability / selection | Same-band tiebreaker + different-band override | 2-3 |
| E: Confidence calibration | Use evidence, don't overclaim | 2-3 |
| F: Tradeoff credibility | No all-5s, genuine sacrifice | 2-3 |
| G: Migration safety | (brownfield only) Path reasoning, not target-only | 6-8 |
| H: Conditional skill / constitution | Correct skill loading, justified exceptions | 3-4 |

## Difficulty Distribution Per Scenario

| Tier | Seeds | Expected Score (strong agent) | Purpose |
|------|-------|-------------------------------|---------|
| T1 | 2-3 | 90-100% | Baseline — confirms agent isn't broken |
| T2 | 8-10 | 85-100% | Solid judgment — rule application with cross-doc synthesis |
| T3 | 15-18 | 50-75% | Genuine ambiguity — two defensible answers, weighting determines winner |
| T4 | 10-12 | 30-60% | Wicked problems — refuse-to-decide, over-blocking traps, contradictions to reframe |

## Hard Seed Types (T3/T4) — Must Include Across Suite

- Genuine ambiguity: 2 candidates both defensible, answer depends on value weighting
- Refuse-to-decide: constraints impossible / need more research / need stakeholder alignment
- Over-blocking traps: agent should approve with conditions, not reject
- Under-blocking traps: agent should catch a subtle fatal flaw that looks OK
- Constitution exceptions: Simplicity Gate should be overridden with justification
- Misleading evidence: metrics/tests prove the wrong thing
- Contradicting stakeholder mandates: escalate + reframe, don't pretend satisfiable
- Bounded pattern application: partial adoption is valid, all-or-nothing is wrong

## Process Reminders

- Mandatory: read agent's `skills.md` FIRST before designing any seeds
- Mandatory: identify agent's actual output format and decision types
- Canary first: write 1 scenario, run it, validate scoring, THEN expand
- Audit with multiple models before finalizing
- Penalize over-blocking equally with under-blocking
- Include seeds where correct answer is "approve with conditions"
- Never include seeds where correct answer is obvious from prompt wording

## What NOT To Do

- Don't test system design ability (agent evaluates patterns, doesn't design systems)
- Don't make seeds easy by explicitly stating rules in the task prompt
- Don't repeat the same judgment behavior across multiple seeds
- Don't use the 40-65% target as universal — use tiered targets
- Don't commit run directories (scratch, belongs in ADS-project-knowledge)
