# Controls — Git Strategy + Code-Documentation Suite

Suite kind: `benchmark`

Positive controls:

- `SEED-GD-01` — Coordinator must branch at TDD dispatch with correct naming
- `SEED-GD-02` — PR description must include spec hash, ADR, test cert, security
- `SEED-GD-03` — Programmer must document public interface with side effects and constraints
- `SEED-GD-05` — Code Review must flag missing side-effect docs as Required

Negative controls:

- `SEED-GD-04` — Programmer must NOT over-document obvious private one-liners
- `SEED-GD-06` — Code Review must NOT treat comment bloat as a blocker (Recommended only)
