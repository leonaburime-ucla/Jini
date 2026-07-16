# System Design Benchmark Suite

Suite kind: `benchmark`

Status: `canary` (eval-1 only; remaining evals pending validation)

Agent under test: `system-design`

## Purpose

Test whether the System Design agent exercises genuine architectural judgment under ambiguity — not template compliance. Fixtures present realistic messy stakeholder input with traps buried in requirements, constraints, team topology, and cross-document contradictions. The agent must infer contradictions, escalate structural unknowns, resist technology fashion, and decompose at the right granularity.

## Coverage Dimensions

| # | Dimension | What it tests |
|---|---|---|
| 1 | Scope Discipline & Escalation | BLOCK on real ambiguity, refuse to SAFE DEFAULT structural boundaries, escalate vs guess |
| 2 | Functional Discovery Completeness | Surface non-obvious actors, lifecycle states, exception flows — not just happy path |
| 3 | Decomposition Judgment | Cut boundaries at the right level, detect coupling, avoid premature microservices |
| 4 | Dependency Sequencing & P0 Design | FK ordering, thin P0, circular dependency detection, bottleneck surfacing |
| 5 | Technology Direction Under Constraints | Match tech to constraints, detect conflicts, resist cargo-culting |
| 6 | NFR x Topology Coherence | Proposed topology actually serves stated quality attributes |
| 7 | Integration Boundary Reasoning | Correct ownership at system edges, hidden cross-domain dependencies |

## Tier Distribution (target)

- Easy: 15% (calibration anchors)
- Medium: 35%
- Hard: 35%
- Distinguished: 15%

## Difficulty Calibration

- Tier 3/4 target: 30-50% CAUGHT rate for frontier model on first run
- If a frontier model scores >70%, the fixture is not hard enough
- Each seed must be independently difficult (not hidden by volume alone)
- Brief's operational language must be load-bearing for finding traps

## Eval Map

- `sd-eval-1-team-collab-saas` — Greenfield team collaboration SaaS (canary)
  - 15 seeds: 2 Easy, 5 Medium, 6 Hard, 2 Distinguished
  - 4 negative controls
  - Traps: technology fashion, NFR/topology incoherence, decomposition duplication, escalation discipline, Conway's Law mismatch, dependency sequencing

Planned (pending canary validation):
- `sd-eval-2-legacy-modernization` — monolith-to-services migration
- `sd-eval-3-ml-data-platform` — ML pipeline + model serving
- `sd-eval-4-marketplace` — multi-party marketplace
- `sd-eval-5-regulated-domain` — healthcare/finance compliance

## Scoring Model

| Result | Meaning |
|---|---|
| CAUGHT | Agent correctly identified the planted trap and took the right action (escalated, blocked, decomposed differently, surfaced tradeoff) |
| PARTIAL | Agent noticed something adjacent but drew wrong conclusion or took wrong action |
| MISSED | Agent sailed past the trap and produced a blueprint containing the structural flaw |
| FALSE_POSITIVE | Agent flagged something as BLOCKING/problematic that is well-defined and safe |
| CORRECT_SKIP | (Negative controls) Agent correctly did NOT flag the planted bait as a problem |

## Fixture Shape

Each eval provides:
- `project-brief.md` — short operational brief (no answer keys)
- `seed-state/product-intent.md` — messy stakeholder input (2-3 pages)
- `seed-state/constraints.md` — technical/business constraints with buried conflicts
- `seed-state/team-context.md` — org structure creating Conway's Law tension

The agent sees project-brief + seed-state. It does NOT see seed-design.md, seed-ledger.md, seed-catalog.tsv, controls.md, or coverage-matrix.tsv.

## How To Prepare A Run

```bash
python3 harness-engineering/quality/scripts/prepare_eval_run.py \
  harness-engineering/agent-evals/system-blueprint-evals/benchmark-suite \
  run-001 \
  --eval sd-eval-1-team-collab-saas
```

After agent run, persist run proof in `run-manifest.tsv`, then score each seed in `run-results.tsv`.
