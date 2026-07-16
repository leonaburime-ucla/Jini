# Input: Programmer Agent / CSV Invoice Export

Implement the current slice for the CSV invoice export feature using the repo's normal Programmer handoff contract.

Use these source artifacts as the ground truth:

- `framework/examples/golden-sample/feature.spec.md`
- `framework/examples/golden-sample/adr.md`
- `framework/examples/golden-sample/tasks.md`
- `framework/examples/golden-sample/test-certification.md`

Assume the active failure cluster is:

- CSV rows export correctly except embedded double quotes are not escaped per RFC 4180
- the filename format dropped the export date on one path

Minimum bar:

- implement only the current slice
- stay inside ADR boundaries
- provide an `Architecture Audit`
- provide a `Pre-Completion Checklist`
- do not delete or weaken tests to manufacture green
