# Quality

Quality doctrine, evaluator loops, scorecards, and test-quality references.

Committed seeded eval suites live in `../agent-evals/`. This directory keeps the shared framework and tooling.

## Files

- `evaluation-loops.md` - independent evaluator / judge loops and retained evaluator artifacts
- `eval-coverage-model.md` - shared coverage matrix model for seeded evals: bug nature taxonomy, seed structure taxonomy, difficulty calibration, and control requirements
- `failure-promotion-policy.md` - when recurring failures must become durable harness improvements
- `load-bearing-harness-audit.md` - when to re-test and simplify older harness assumptions
- `model-upgrade-program.md` - formal program for evaluating new models/hosts: triggers, baselines, benchmark packs, ablation modes, retained report fields
- `quality-score.md` - current repo-level harness quality snapshot
- `function-quality-seeded-evals.md` - seeded eval protocol for testing Programmer, Code Review, and Refactor against function-quality traps
- `agent-isolation-eval-framework.md` - repeatable harness for testing any agent in isolation with seeded defects, hidden ledgers, and post-hoc scoring; includes agent-specific eval designs for Spec, Security, Refactor, Architect, TDD, and Red Team agents
- `templates/` - TSV starter templates for new eval suites (`coverage-matrix`, `seed-catalog`, `run-manifest`, and `run-results`)
- `scripts/prepare_eval_run.py` - creates fresh `runs/<run-id>/` working copies from immutable `seed-state/` fixtures, and warns when the selected scope should be user-confirmed before dispatch
- `scripts/record_run_manifest.py` - appends or updates `run-manifest.tsv` rows while computing artifact and transcript SHA-256 hashes
- `scripts/score_eval_suite.py` - computes all required suite-level metrics from `seed-catalog.tsv` + artifact-backed `run-results.tsv`: per-seed catch rate, per-dimension/bug-nature/structure/difficulty breakdowns, false-positive rate, severity accuracy, cross-dimension stability (attention-budget regression detection), negative-control calibration, dimension density, and computed status label
- `spec-definition-of-done.md`
- `agent-performance-scorecard.md`
- `test-first-design-policy.md` — design-stage checklist for making code naturally testable before implementation starts
- `testability-antipatterns.md` — catalog of coding anti-patterns that reduce testability, with required human reporting rule
- `react-component-testing-policy.md` - mandatory component-test expectations when React surfaces are present
- `debug-playbook.md` - debugging workflow support for quality and testability work

## Drift Sensors

Recurring codebase-health signals that feed into Observer maintenance passes. See `harness-engineering/sensors/README.md` for the full catalog.

Phase 1 sensors:
- `../sensors/dead-code.md` — unused exports, unreachable code, orphaned files
- `../sensors/dependency-drift.md` — outdated deps, vulnerabilities, license issues
- `../sensors/coverage-quality.md` — test coverage trends and critical-path gaps
