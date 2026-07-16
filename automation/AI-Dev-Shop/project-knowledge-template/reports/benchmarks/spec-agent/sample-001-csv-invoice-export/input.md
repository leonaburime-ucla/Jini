# Input: Spec Agent / CSV Invoice Export

Write a spec package for this feature:

- A user can export the currently visible invoice list as CSV.
- The export must respect current filters and sorting.
- The filename should be predictable and include the export date.
- Empty-state and error behavior must be specified.
- The result must be implementation-ready for downstream architecture and test design.

Use the repo's normal spec-package rules and compare quality against the golden sample artifacts in:

- `framework/examples/golden-sample/feature.spec.md`
- `framework/examples/golden-sample/spec-manifest.md`
