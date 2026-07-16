# Expected Output: Spec Agent / CSV Invoice Export

A strong result should look materially similar to the golden sample package:

- `framework/examples/golden-sample/feature.spec.md`
- `framework/examples/golden-sample/spec-manifest.md`

Minimum bar:

- versioned, hashable spec package output
- zero unresolved `[NEEDS CLARIFICATION]` markers
- acceptance criteria that are deterministic and testable
- explicit edge cases for empty results, export failures, and CSV content scope
- enough precision that Architect and TDD can continue without guessing
