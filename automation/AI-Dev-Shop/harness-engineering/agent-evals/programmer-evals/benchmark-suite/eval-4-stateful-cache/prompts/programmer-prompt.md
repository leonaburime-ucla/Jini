# Coordinator Dispatch — Programmer Agent

## Task

We need a rate limiter for our API gateway. The platform team started the implementation using a sliding window approach. They got the basic algorithm working but haven't had time to make it production-grade.

## Scope

- Review and improve the existing rate limiter in `src/`
- Ensure all requirements from `project-brief.md` are met
- Ensure tests are reliable and deterministic
- Apply all standard skills and guardrails per your agent definition
- Deliver production-ready code with proper documentation

## Spec Reference

Use `project-brief.md` as the active spec. Each numbered requirement is an acceptance criterion.

## Existing Code

- `src/rate_limiter.py` — rate limiter implementation
- `tests/test_rate_limiter.py` — initial tests

The basic sliding window logic works. Your job is to verify it meets all requirements and make it production-ready.

## Output

Write your eval results to `eval-results/eval-results-run.md`. Include: model name and version used, what you found, what you fixed, spec compliance status, function quality scores, and any remaining debt.

## Activated Skills

Base skills only.
