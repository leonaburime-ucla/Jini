# System Design Eval Suite Design

## Metadata

- Design date: 2026-05-30
- Status: canary (eval-1 created, pending first run)
- Agent under test: `system-design`
- Suite path: `harness-engineering/agent-evals/system-blueprint-evals/benchmark-suite`
- Replaces: original 30-seed system-blueprint-eval-design (template-compliance focused)

## Design Philosophy

The old suite tested template compliance — "did you fill in the right section." The rebuilt suite tests **architectural judgment under ambiguity**. Fixtures present realistic messy stakeholder input. Traps are embedded naturally in requirements, not labeled. The agent must infer contradictions, resist technology fashion, decompose at the right granularity, and escalate when structural unknowns make confident blueprinting unsafe.

Key principles from eval-design-playbook.md adapted for judgment evals:
- Never name the invariant in the brief
- Operational language only — describe what the system does, not what properties it must have
- Contradictions must be inferred from cross-document analysis, never stated directly
- Include red-herring requirements that sound scary but are trivially satisfied
- Each seed must be independently difficult (not hidden by fixture volume)
- Target 30-50% CAUGHT rate for frontier model on Hard/Distinguished seeds

## Suite Shape (target)

- Seeds: ~75 across 5 evals (15 per eval)
- Dimensions: 7
- Tiers: 15% Easy, 35% Medium, 35% Hard, 15% Distinguished
- Negative controls: 4 per eval, adjacent to real traps
- Scoring: CAUGHT / PARTIAL / MISSED / FALSE_POSITIVE / CORRECT_SKIP

## Dimensions

| # | Dimension | What it tests |
|---|---|---|
| 1 | Scope Discipline & Escalation | BLOCK on real ambiguity, refuse to SAFE DEFAULT structural boundaries |
| 2 | Functional Discovery Completeness | Surface non-obvious actors, lifecycles, exception flows |
| 3 | Decomposition Judgment | Right granularity, detect coupling, avoid premature distribution |
| 4 | Dependency Sequencing & P0 Design | FK ordering, thin P0, bottleneck surfacing |
| 5 | Technology Direction Under Constraints | Match tech to constraints, resist cargo-culting |
| 6 | NFR x Topology Coherence | Proposed topology serves stated quality attributes |
| 7 | Integration Boundary Reasoning | Correct ownership at system edges |

## Eval Projects

| # | Eval | Domain | Primary dimensions tested |
|---|---|---|---|
| 1 | sd-eval-1-team-collab-saas | Greenfield team collaboration SaaS | All 7 (canary) |
| 2 | sd-eval-2-legacy-modernization | Monolith-to-services migration | 1, 3, 4, 5 |
| 3 | sd-eval-3-ml-data-platform | ML pipeline + model serving | 5, 6, 7 |
| 4 | sd-eval-4-marketplace | Multi-party marketplace | 3, 4, 7 |
| 5 | sd-eval-5-regulated-domain | Healthcare/finance compliance | 1, 2, 6 |

## Fixture Shape Per Eval

- `project-brief.md` — short operational brief (no answer keys, no expected behavior)
- `seed-state/product-intent.md` — 2-3 pages of messy stakeholder input
- `seed-state/constraints.md` — technical/business constraints with buried conflicts
- `seed-state/team-context.md` — org structure creating Conway's Law tension

## Canary Status

- eval-1 fixture written and reviewed
- Awaiting first agent run for difficulty calibration
- If frontier model scores >70%, fixture needs hardening
- If frontier model scores <30%, some seeds may need rebalancing

## Process (from playbook)

1. Write one eval as canary (done: eval-1)
2. Run test agent against it, score, iterate
3. Audit with multiple models (2+ model families)
4. Once calibrated, replicate pattern for evals 2-5
5. Track per-dimension miss rates across models
6. Build skills targeting systematic misses
