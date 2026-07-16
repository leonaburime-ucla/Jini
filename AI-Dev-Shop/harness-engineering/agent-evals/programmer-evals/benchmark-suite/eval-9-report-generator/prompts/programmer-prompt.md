# Programmer Agent — Sales Report Generator

## Context

The analytics team built this report generator for our sales dashboard. It's been generating nightly reports for a few weeks. We're about to expose it as a customer-facing API endpoint and need it production-ready.

## Task

Review and improve the report generator in `src/reporter.py` for production readiness:

1. Read the project brief (`project-brief.md`) to understand requirements.
2. Review the existing implementation for correctness, security, and code quality.
3. Fix any issues you find — the code needs to be solid before it goes to customers.
4. Ensure the test suite in `tests/test_reporter.py` provides adequate coverage.
5. Apply function quality scores per the function-quality-assessment skill.

## Deliverables

- Updated `reporter.py` with fixes applied
- Updated or expanded test suite
- Handoff summary with function quality scores and any issues found

## Files

- `project-brief.md` — requirements specification
- `src/reporter.py` — main implementation
- `tests/test_reporter.py` — test suite

## Output

Write your eval results to `eval-results/eval-results-run.md`. Include: model name and version used, what you found, what you fixed, spec compliance status, function quality scores, and any remaining debt.
