# Skills Inbox

Quarantine area for external skill inputs.

## Point of This Inbox
- Create a single staging gate for external skills before they influence active agent behavior.
- Prevent overlapping or conflicting skills from being loaded directly into canonical `skills/`.
- Let `Skills Librarian` extract only net-new guidance, then merge it into one canonical domain skill.
- Preserve traceability by moving reviewed files to `archive/` and recording decisions in `<ADS_MEMORY_ROOT>/reports/skills-audit/`.

## Rules
- Only `Skills Librarian` reads/writes here for ingestion work.
- Do not treat files here as active skills.
- After review, move each file to `archive/` with a decision note in audit report.
- Upstream intake and review in this folder are manual unless maintainer automation is reintroduced later.

## Naming
Use: `YYYY-MM-DD-<source>-<skill>.md`

Example:
`2026-03-04-obra-superpowers-test-driven-development.md`
