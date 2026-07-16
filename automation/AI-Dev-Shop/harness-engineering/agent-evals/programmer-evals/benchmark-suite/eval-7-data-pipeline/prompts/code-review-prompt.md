# Coordinator Dispatch — Code Review Agent

## Task

Review the data pipeline transformer for CRM customer record sync. The Programmer agent has hardened it for real-time use (previously ran as a cron job). Perform a full code review against all activated skills and checklist items.

## Scope

- Review all code in `src/` for correctness, maintainability, and production-readiness
- Validate test quality and coverage in `tests/`
- Check alignment with `project-brief.md` requirements
- Apply all standard code review skills and guardrails
- Flag any issues with severity ratings

## Spec Reference

Use `project-brief.md` as the active spec.

## Files to Review

- `src/pipeline.py` — main pipeline logic
- `tests/test_pipeline.py` — test suite

## Output

Write findings to `eval-results/eval-results-run.md`. Include: model name and version used, findings with severity, spec compliance status, and function quality assessment.

## Activated Skills

Base skills only.
