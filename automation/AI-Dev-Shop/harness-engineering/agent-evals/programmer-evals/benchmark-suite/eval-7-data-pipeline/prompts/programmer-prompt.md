# Coordinator Dispatch — Programmer Agent

## Task

We have a data pipeline for syncing customer records to our CRM. The data engineering team built the first version and it's been running in a cron job for a month. We're moving it to a real-time trigger and need it production-hardened.

## Scope

- Review and harden the existing pipeline in `src/`
- Ensure all requirements from `project-brief.md` are met
- Ensure tests are comprehensive and correct
- Apply all standard skills and guardrails
- Deliver production-ready code

## Spec Reference

Use `project-brief.md` as the active spec.

## Existing Code

- `src/pipeline.py` — pipeline logic
- `tests/test_pipeline.py` — initial tests

Been running in cron for a month. Your job is to harden for real-time use.

## Output

Write your eval results to `eval-results/eval-results-run.md`. Include: model name and version used, what you found, what you fixed, spec compliance status, function quality scores, and any remaining debt.

## Activated Skills

Base skills only.
