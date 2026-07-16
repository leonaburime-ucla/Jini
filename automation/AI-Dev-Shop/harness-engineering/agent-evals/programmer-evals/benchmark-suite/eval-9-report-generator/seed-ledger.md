ID: SEED-CL-19
Checklist Item: 19. Security and privacy
Source Skill: security-review, api-design
Category: Security/privacy
Seeded issue: The detailed report format includes a `debug` field on every transaction that contains the full customer object including email, phone, and customerNotes. This violates the brief requirement "Never include customer email addresses in the report output." The debug field is always present, not conditional on a debug flag.
Expected owner: Programmer
Expected severity: Critical
Expected signal: Programmer removes PII from report output
Evidence path: src/reporter.py — detailed format output

ID: SEED-CL-20
Checklist Item: 20. Extension point
Source Skill: coding-foundations, design-patterns
Category: Extension point
Seeded issue: Adding a new report format requires editing a switch statement in `generateReport`, adding a case in `formatOutput`, AND adding a type to the format validation check — 3 separate places that must stay in sync. The brief has 3 formats; adding a 4th requires editing 3 different functions.
Expected owner: Programmer
Expected severity: Medium
Expected signal: Programmer uses a format strategy map or registry
Evidence path: src/reporter.py — switch in 3 functions

ID: SEED-CL-21
Checklist Item: 21. Deletion or refactor signal
Source Skill: refactor-patterns, testable-design-patterns
Category: Deletion/refactor signal
Seeded issue: The main `generateReport` function is 150 lines, CC=8, scored 45/100 in a comment but with NO extraction proposal. The score annotation says "needs refactoring" but doesn't say what should be extracted, split, or moved. The function quality assessment skill requires that low scores include a refactor signal.
Expected owner: Code Review
Expected severity: Medium
Expected signal: Code Review flags missing extraction proposal
Evidence path: src/reporter.py — generateReport JSDoc

ID: SEED-CL-22
Checklist Item: 22. Adversarial aggregate behavior
Source Skill: testable-design-patterns, implementation-guardrails
Category: Adversarial aggregate
Seeded issue: The revenue aggregation doesn't handle duplicate transaction IDs — if the same transaction appears twice, it's counted twice. The `topCustomers` calculation doesn't merge spending across transactions (it takes the single highest transaction per customer instead of total). The `averageOrderValue` divides by total transactions including duplicates. Rounding is done only on the final total, not per-region, causing penny discrepancies when regions are summed.
Expected owner: Programmer
Expected severity: High
Expected signal: Programmer adds dedup and proper aggregation
Evidence path: src/reporter.py — aggregate calculations

ID: SEED-CL-23
Checklist Item: 23. Coverage evidence
Source Skill: testable-design-patterns, test-design
Category: Coverage evidence
Seeded issue: The handoff claims "95% coverage" but the test file has only 4 happy-path tests. There's no coverage command configured, no coverage report, and the claim is fabricated. The actual coverage would be ~30% because error paths, edge cases, and two of three format types are untested.
Expected owner: Code Review
Expected severity: Required
Expected signal: Code Review flags missing coverage evidence
Evidence path: tests/test_reporter.py — only 4 tests

ID: SEED-CL-24
Checklist Item: 24. Score calibration
Source Skill: function-quality-assessment, code-review
Category: Score calibration
Seeded issue: Every function is scored 100/100 despite the main function being 150 lines with CC=8 and Critical privacy violations. There is one function scored 45/100 (generateReport) but it has no skepticism pass and the low score includes no extraction proposal. The mix of 100s and one 45 with no explanation is incoherent score calibration.
Expected owner: Code Review
Expected severity: Required
Expected signal: Code Review flags incoherent scoring
Evidence path: All JSDoc scores

ID: SEED-CL-TRICK-07
Checklist Item: (trick) Premature abstraction
Source Skill: coding-foundations
Category: Over-engineering
Seeded issue: There's an AbstractReportFormatter class with a TemplateMethod pattern, a FormatterFactory, and a ReportPlugin interface — all for 3 simple format variations that could be a plain object map. The abstraction makes the code harder to read, test, and extend (the opposite of its intent). Adding a format requires implementing a class, registering in the factory, and satisfying the interface — more ceremony than editing a switch.
Expected owner: Programmer (should simplify) or Code Review (should flag)
Expected severity: Medium
Expected signal: Premature abstraction flagged, simplify to format map
Evidence path: src/reporter.py — AbstractReportFormatter, FormatterFactory

ID: SEED-CL-TRICK-08
Checklist Item: (trick) Boundary / floating point
Source Skill: implementation-guardrails
Category: Floating point trap
Seeded issue: The revenue calculation does `transactions.reduce((sum, t) => sum + t.amount, 0)` without intermediate rounding. With thousands of transactions, floating point drift accumulates. The test uses `toBe(300)` which passes for 3 transactions but would fail for 1000+ due to IEEE 754 drift. The brief says "rounded to 2 decimal places" but rounding only happens at the end, not during accumulation.
Expected owner: Programmer
Expected severity: Medium
Expected signal: Programmer applies per-step or accumulator rounding
Evidence path: src/reporter.py — reduce accumulation
