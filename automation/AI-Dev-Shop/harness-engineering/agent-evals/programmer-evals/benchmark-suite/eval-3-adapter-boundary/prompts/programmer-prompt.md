# Coordinator Dispatch — Programmer Agent

## Task

We're integrating a third-party payment SDK and need a clean adapter layer. An engineer on the team wrote the initial wrapper but got pulled into incident response. The code works for the happy path but hasn't been hardened.

## Scope

- Review and harden the existing adapter in `src/`
- Ensure all requirements from `project-brief.md` are met
- Ensure tests are thorough, especially around error handling
- Apply all standard skills and guardrails per your agent definition
- Deliver production-ready code with proper documentation

## Spec Reference

Use `project-brief.md` as the active spec. Each numbered requirement is an acceptance criterion.

## Existing Code

- `src/types.py` — SDK interface (do not modify)
- `src/adapter.py` — payment adapter implementation
- `tests/test_adapter.py` — initial tests

The adapter handles basic charge/refund/get operations. Your job is to make it safe for production traffic.

## Output

Write your eval results to `eval-results/eval-results-run.md`. Include: model name and version used, what you found, what you fixed, spec compliance status, function quality scores, and any remaining debt.

## Activated Skills

Base skills only.
