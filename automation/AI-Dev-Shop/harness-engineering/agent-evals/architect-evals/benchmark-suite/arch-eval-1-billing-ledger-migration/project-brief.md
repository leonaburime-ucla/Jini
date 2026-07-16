# Billing Ledger Migration — Eval Task

## Goal

You are Software Architect Agent v2.0.0. Read the provided documents and
produce a full Architecture Decision Record (ADR) using the standard ADR
template.

## Where To Read

- `seed-state/feature-spec.md`
- `seed-state/system-blueprint.md`
- `seed-state/team-and-operations.md`
- `seed-state/constitution.md`
- `seed-state/constraints-and-nfrs.md`
- `seed-state/pattern-candidates.md`

## Required Output

Produce a structured ADR with ALL of these sections:

1. **Constitution Check** — article-by-article compliance for each candidate
2. **System Drivers** — classify dominant quality attributes
3. **Pattern Evaluation Table** — evaluate ALL 5 candidates (A-E) with
   Fit Band, Adaptability, Evidence Basis, Pros, Cons, Key Tradeoffs, Verdict
4. **Quality Attribute Scorecard** — for the selected candidate:
   - Score all 8 core axes (modifiability, modularity, scalability,
     reliability, security, operability, cost, testability)
   - Activate optional axes ONLY when triggered by the fixture documents
     (cite activation source for each)
   - Each axis: score 1-5, confidence, strengths, weaknesses, rationale,
     assumptions, review_trigger, delta_vs_runner_up
   - Mitigation required for any score <= 2 (owner, enforcement, deadline)
5. **Blocking Rules Audit** — explicitly check:
   - No critical axis scored 1 without mitigation
   - <50% core axes at "assumed" confidence
   - All hard-required optional axes present
6. **Overall Strengths / Overall Weaknesses**
7. **Tradeoff Tension** — name the main sacrifice accepted
8. **Why This Won** — reference dominant drivers and runner-up delta
9. **Runner-Up Comparison**
10. **Migration Safety** — dual-write, reconciliation, rollback, cutover
11. **Re-evaluation Triggers** — concrete structural triggers
12. **Default Heuristic Alignment** — follows or departs from modular
    monolith default, with justification

## Rules

- Apply Adaptability First ONLY within the same Fit Band
- Do not use weighted sums or arithmetic winner logic
- Do not produce an all-5s scorecard — every architecture has weaknesses
- If confidence evidence is available in the documents, do not mark "assumed"
- Report which conditional skills you would load and which you would NOT

Do not assume this is an eval. Treat it as real architecture work.
