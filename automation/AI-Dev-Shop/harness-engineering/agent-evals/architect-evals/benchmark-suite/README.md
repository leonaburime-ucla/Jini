# Architect Eval Suite

Suite kind: `benchmark`

Status: `canary`

Purpose:

- test whether the Software Architect agent makes correct architecture
  JUDGMENT — pattern evaluation, scorecard quality, axis activation
  discipline, blocking rule enforcement, adaptability application,
  confidence calibration, and migration safety reasoning
- NOT testing system design ability — testing evaluation and decision quality
- the agent produces structured ADRs with Pattern Evaluation tables and
  Quality Attribute Scorecards; seeds test whether those are correct

## Design Principles

- Seeds test judgment behaviors from the agent's skills.md, not generic
  architecture knowledge
- Fixture documents are crafted to create scorecard traps: attractive
  nuisance patterns, subtle axis triggers, anti-monolith bias bait,
  confidence over/underclaiming opportunities
- The eval asks for the ACTUAL agent output format (Pattern Evaluation +
  Scorecard + ADR template sections)
- Scoring compares the agent's scorecard judgments against the oracle

## Coverage (Canary — 1 scenario)

- `33` seeds in 1 scenario (SEED-ARCH-13 removed in post-canary audit;
  older docs saying "34" are off by one)
- `2` positive controls / fatal invariants (gated at 60%)
- `5` negative controls (false-positive restraint)
- `2` regression controls (canary-tightened under-blocking traps)
- `24` standard seeds
- 3 agent dimensions (standard schema): Scorecard & Evidence Judgment,
  Blocking & Selection Judgment, Migration Safety Judgment — the original
  8 judgment categories (axis activation, score calibration, blocking
  rules, adaptability, confidence, tradeoff credibility, migration safety,
  conditional skills) are preserved in the per-eval seed-ledger narratives
- Depth: 26/28 depth-eligible seeds staff+ (92.9%) — staff 9, principal
  10, distinguished 7; passes the Architect/CR depth floors in
  `validate_eval_suite.py`

Schema note (2026-07-03): `seed-catalog.tsv` and `coverage-matrix.tsv`
were migrated to the standard eval schema (same columns as the Code
Review suite: `domain_complexity`, `complexity_category`,
`engineering_concepts`, etc.), and the suite-level `seed-ledger.md` now
carries the structured 9-field staff+ entries required by the validator.
The per-eval `arch-eval-1-billing-ledger-migration/seed-ledger.md`
remains the scoring oracle.

## Multi-Scenario Expansion Plan

Target: **6 scenarios × ~40 seeds each = ~240 total seeds**

| Scenario | Domain | Dominant Drivers | Status |
|----------|--------|-----------------|--------|
| arch-eval-1 | Billing ledger migration (brownfield) | compliance, data consistency, operability, migration safety | DONE (34 seeds, validated at 94%) |
| arch-eval-2 | Flash-sale ticketing (greenfield) | performance, scalability, data consistency, reliability | PLANNED |
| arch-eval-3 | B2B partner integration hub (brownfield) | integration complexity, modifiability, cognitive load, operability | PLANNED |
| arch-eval-4 | Enterprise RAG assistant (greenfield) | tenant isolation, security, compliance, cost, AI-specific | PLANNED |
| arch-eval-5 | Real-time collaboration platform (greenfield) | reliability, scalability, deployment independence, performance | PLANNED |
| arch-eval-6 | Fintech regulatory migration (brownfield) | compliance (heavy enough to override Simplicity Gate), migration safety, security | PLANNED |

Each scenario targets distinct judgment traps: different constraint
tensions, different over/under-blocking opportunities, different domains
where the "obvious" answer is wrong for specific reasons.

## Eval Map (Current)

- `arch-eval-1-billing-ledger-migration`
  - `SEED-ARCH-01` through `SEED-ARCH-10`

## How To Run

The executing LLM receives the seed-state documents, produces a full ADR,
then the coordinator scores each seed against the seed-ledger.

```bash
mkdir -p harness-engineering/agent-evals/architect-evals/benchmark-suite/arch-eval-1-billing-ledger-migration/runs/run-001
cp -r harness-engineering/agent-evals/architect-evals/benchmark-suite/arch-eval-1-billing-ledger-migration/seed-state \
  harness-engineering/agent-evals/architect-evals/benchmark-suite/arch-eval-1-billing-ledger-migration/runs/run-001/
```
