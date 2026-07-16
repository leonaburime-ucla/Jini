# Programmer Agent — Eval 8: Access Control Evaluator

## Context

The auth team built this permission evaluator for our document management system. It's been running behind a feature flag for the past two weeks with no reported issues. We're about to remove the flag and make it the default access control path for all users.

Your job is to review the implementation at `src/evaluator.py` and make sure it's production-ready. The spec is in `project-brief.md`.

## Deliverables

1. Read the spec and the existing implementation.
2. Identify any bugs, performance issues, missing requirements, or production-readiness gaps.
3. Fix everything you find. Make the code solid enough to be the default access control path.
4. Ensure the test suite covers the important behaviors and edge cases.

Focus on correctness first, then robustness. This code will be making authorization decisions for every document operation in the system.

## Output

Write your eval results to `eval-results/eval-results-run.md`. Include: model name and version used, what you found, what you fixed, spec compliance status, function quality scores, and any remaining debt.
