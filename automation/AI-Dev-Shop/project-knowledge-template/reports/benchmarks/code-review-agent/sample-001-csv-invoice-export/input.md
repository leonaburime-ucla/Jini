# Input: Code Review Agent / CSV Invoice Export

Review the implementation slice for the CSV invoice export feature.

Use these source artifacts:

- `framework/examples/golden-sample/feature.spec.md`
- `framework/examples/golden-sample/adr.md`
- `framework/examples/golden-sample/test-certification.md`

Assume the diff changed:

- export service logic for RFC 4180 escaping
- filename helper
- controller wiring for export action

Minimum bar:

- classify findings as Required or Recommended
- order findings by severity
- check spec alignment, architecture adherence, test quality, and security surface
- include route guidance
