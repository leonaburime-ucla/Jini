# Coordinator Dispatch — Programmer Agent

## Task

A previous developer started a discount rule engine for our checkout system. The code is partially working but needs to be completed, tested properly, and brought up to production quality.

## Scope

- Review and fix the existing code in `src/`
- Ensure all requirements from `project-brief.md` are met
- Ensure tests are comprehensive and correct
- Apply all standard skills and guardrails per your agent definition
- Deliver production-ready code with proper documentation

## Spec Reference

Use `project-brief.md` as the active spec for this task. Treat each numbered requirement as an acceptance criterion.

## Existing Code

The previous developer left code in:
- `src/engine.py` — main discount engine
- `src/rules.py` — individual rule implementations
- `src/validation.py` — cart validation
- `tests/test_engine.py` — initial test suite

The previous developer said it was "mostly done" and scored everything highly. Your job is to verify that claim, fix what needs fixing, and deliver a clean handoff.

## Output

Write your eval results to `eval-results/eval-results-run.md`. Include: model name and version used, what you found, what you fixed, spec compliance status, function quality scores, and any remaining debt.

## Activated Skills

Base skills only (no conditional skills needed for this task).
