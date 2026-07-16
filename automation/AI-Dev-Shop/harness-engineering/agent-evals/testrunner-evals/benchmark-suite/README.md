# TestRunner Benchmark Suite

Canonical seeded eval suite for the TestRunner agent.

- Agent under test: `testrunner`
- Source design: `../testrunner-eval-design.md`
- Suite shape: 27 seeds across 3 flattened `seed-state/` mini-projects
- Seed-state status: initial inputs created for all three evals; run history starts with one targeted run
- Default execution mode: `repo_persona_subagent`

## Evals

- `testrunner-eval-1-fresh-evidence` tests pre-run certification gates, fresh evidence, skipped suites, missing artifacts, flakes, and tool-failure escalation.
- `testrunner-eval-2-coverage-artifacts` tests coverage gate math, artifact merge discipline, per-file regression handling, and exempt-file judgment.
- `testrunner-eval-3-failure-clustering` tests exact failure evidence, failure ownership, flaky/state-contaminated runs, infrastructure classification, and read-only role boundaries.

## Suite Artifacts

- `coverage-matrix.tsv`
- `seed-catalog.tsv`
- `seed-ledger.md`
- `controls.md`
- `run-manifest.tsv`
- `run-results.tsv`

## Validation

```bash
python3 harness-engineering/validators/validate_eval_suite.py harness-engineering/agent-evals/testrunner-evals/benchmark-suite
```

## Prepare One Eval Run

```bash
python3 harness-engineering/quality/scripts/prepare_eval_run.py \
  harness-engineering/agent-evals/testrunner-evals/benchmark-suite \
  run-001 \
  --eval testrunner-eval-1-fresh-evidence
```

After a real agent run, persist run proof in `run-manifest.tsv` first, then score each seed in `run-results.tsv`.
