# Coordinator Dispatch — Programmer Agent

## Task

We're building a search feature for our document management system. The backend team wrote a query builder that constructs parameterized SQL. It's been running in staging without issues, but we need it reviewed and production-hardened before launch.

## Scope

- Review and harden the existing query builder in `src/`
- Ensure all requirements from `project-brief.md` are met
- Ensure tests cover all filter combinations and edge cases
- Apply all standard skills and guardrails per your agent definition
- Deliver production-ready code with proper documentation

## Spec Reference

Use `project-brief.md` as the active spec. Each numbered requirement is an acceptance criterion.

## Existing Code

- `src/query_builder.py` — search query builder
- `tests/test_query_builder.py` — initial tests

The team says it's "been working fine in staging." Your job is to verify that claim and make it safe for production.

## Output

Write your eval results to `eval-results/eval-results-run.md`. Include: model name and version used, what you found, what you fixed, spec compliance status, function quality scores, and any remaining debt.

## Activated Skills

Base skills only.
