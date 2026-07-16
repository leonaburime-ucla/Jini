# Function Quality Scoring Rubric

Assign `@overallScore` from 0 to 100 for each assessed function.

## Score Bands

- `100`: clear, focused, typed, deterministic, scalable for expected input, easy
  to test, easy to extend, and no known findings remain after the score
  skepticism pass.
- `90-99`: strong implementation with small naming, documentation, testability,
  or extension concerns.
- `80-89`: usable but fragile enough that future work or tests may slow down.
  Requires one local fix cycle before handoff.
- `< 80`: risky implementation. Blocks handoff until fixed or escalated.

## Severity Levels

- `Critical`: likely correctness, data loss, security, privacy, or outage risk.
- `High`: likely production bug, scale failure, hard-to-test behavior, or
  serious maintenance trap.
- `Medium`: maintainability, extensibility, or moderate test fragility risk.
- `Low`: naming, documentation, or small cleanup issue.

## Blocking Rules

- Any `Critical` finding blocks regardless of score.
- Score `< 80` blocks.
- Score `80-89` requires one local fix cycle. If still `80-89`, it can proceed
  only with documented tech debt, smallest compliant refactor, and Coordinator
  notification.
- Score `90-99` passes with findings.
- Score `100` passes cleanly.

## Calibration Rules

- Do not assign `100` when any known finding remains.
- Do not use score inflation to avoid a blocking route.
- Do not assign every assessed unit `100/100` in a non-trivial change without a
  documented score skepticism pass. Re-check requirements, edge cases, scale,
  hidden dependencies, error paths, and test coverage before keeping a perfect
  score set.
- A passing test suite is not enough evidence for `100/100` when coverage,
  adversarial cases, or cross-record behavior are missing.
- If a low score comes from a function owning too much, name the extraction that
  would improve it.
- If Code Review's score differs from Programmer's score by more than 10 points,
  Code Review must flag the discrepancy in the Function Quality Assessment
  section.
