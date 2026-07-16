# CI Enforcement

This file is the harness-local note for validator enforcement.

## Canonical Workflow

The current GitHub Actions workflow lives at `.github/framework/workflows/harness-validators.yml`.

It intentionally does one thing only:

- check out the repo
- install Python
- run `bash harness-engineering/validators/run-all.sh`

That keeps the CI contract thin and forces the repo-local script to remain the true entrypoint.

## Why This Exists

- local validator runs are useful, but drift returns if merge paths do not fail
- the workflow should enforce the same command maintainers run locally
- keeping one shell entrypoint avoids CI-only logic forks

## If `.github/` Changes Are Hard To Land

If an upstream repo blocks or slows `.github/` edits:

1. Keep the workflow file in your branch so maintainers can cherry-pick or copy it.
2. Run `bash harness-engineering/validators/run-all.sh` locally before pushing.
3. Treat the PR as not fully hardened until the workflow is merged.

The fallback is temporary. The harness target state is still merge-gated CI.
