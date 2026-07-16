# Architect Evals

Canonical Architect suites:

- `benchmark-suite/`

Status:

- `benchmark-suite` is active (canary phase); tests architecture JUDGMENT
  (scorecard quality, axis activation, blocking rules, adaptability,
  confidence, tradeoffs, migration safety) — not system design ability.

Architect-specific notes:

- seeds target 8 judgment categories: axis activation discipline (FN + FP),
  score calibration (too high + too low), blocking rule enforcement,
  Adaptability First application, confidence calibration, tradeoff
  credibility, migration safety reasoning, conditional skill restraint
- fixture documents include pattern-candidates.md — the agent must evaluate
  ALL named candidates, not just pick one
- the eval task prompt requires the actual ADR template output: Pattern
  Evaluation table + Quality Attribute Scorecard + all structured sections
- gated scoring: missing a fatal invariant seed caps score at 60%
- planned expansion: 4 scenarios (billing brownfield, ticketing greenfield,
  integration hub, RAG assistant) × 10-12 seeds = 40-48 total
- legacy suite (scorecard-output-only + system-design eval) deleted
  2026-05-31 as incorrectly designed
