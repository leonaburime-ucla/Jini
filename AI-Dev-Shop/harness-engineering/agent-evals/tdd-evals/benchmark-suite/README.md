# TDD Benchmark Suite

Canonical seeded eval suite for the TDD agent.

- Agent under test: `tdd`
- Source design: `../tdd-eval-design.md`
- Suite shape: 27 seeds across 3 flattened `seed-state/` mini-projects
- Seed-state status: initial inputs created for all three evals; run history starts with one targeted run
- Default execution mode: `repo_persona_subagent`

## Evals

- `tdd-eval-1-spec-certification` tests spec approval, hash, blocker, ADR, task, and certification integrity before tests are written.
- `tdd-eval-2-outcome-matrix` tests requirement-to-test mapping, observable outcome matrices, risk-ranked gaps, inferred NFRs, and React component coverage.
- `tdd-eval-3-contract-gapfill` tests gap-fill discipline, contract ambiguity, property testing, async test quality, no-spec drift routing, and React component completeness.

## Suite Artifacts

- `coverage-matrix.tsv`
- `seed-catalog.tsv`
- `seed-ledger.md`
- `controls.md`
- `run-manifest.tsv`
- `run-results.tsv`

## Validation

```bash
python3 harness-engineering/validators/validate_eval_suite.py harness-engineering/agent-evals/tdd-evals/benchmark-suite
```

## Prepare One Eval Run

```bash
python3 harness-engineering/quality/scripts/prepare_eval_run.py \
  harness-engineering/agent-evals/tdd-evals/benchmark-suite \
  run-001 \
  --eval tdd-eval-1-spec-certification
```

After a real agent run, persist run proof in `run-manifest.tsv` first, then score each seed in `run-results.tsv`.
