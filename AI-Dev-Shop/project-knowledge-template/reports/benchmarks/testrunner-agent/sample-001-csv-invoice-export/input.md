# Input: TestRunner Agent / CSV Invoice Export

Evaluate the CSV invoice export feature after Programmer claims the current slice is complete.

Use these artifacts as context:

- `framework/examples/golden-sample/feature.spec.md`
- `framework/examples/golden-sample/test-certification.md`
- `framework/examples/golden-sample/tasks.md`

Assume the implementation touched:

- CSV escaping logic
- filename generation
- export controller wiring

Minimum bar:

- produce suite-by-suite pass/fail evidence
- include coverage status and gap routing
- cluster failures by likely owner if anything is red
- recommend the next route clearly
