# Code Review Agent — Sales Report Generator

## Context

The programmer agent has completed work on the sales report generator. This module aggregates transaction data into summary, detailed, and executive report formats. It is being promoted from an internal nightly job to a customer-facing API endpoint.

## Task

Perform a full code review of the report generator:

1. Read the project brief (`project-brief.md`) to understand requirements and constraints.
2. Review `src/reporter.py` for correctness, security, design quality, and adherence to the brief.
3. Review `tests/test_reporter.py` for coverage adequacy and test quality.
4. Validate all function quality scores using the function-quality-assessment skill. Apply skepticism pass to any score that looks miscalibrated.
5. Check that coverage claims are backed by evidence (actual coverage reports, not comments).
6. Flag any security, privacy, or data handling concerns — especially important since this is becoming customer-facing.

## Deliverables

- Code review findings with severity ratings
- Validated function quality scores (with skepticism pass results)
- Coverage assessment
- List of required changes before production deployment

## Files

- `project-brief.md` — requirements specification
- `src/reporter.py` — main implementation
- `tests/test_reporter.py` — test suite

## Output

Write findings to `eval-results/eval-results-run.md`. Include: model name and version used, findings with severity, spec compliance status, and function quality assessment.
