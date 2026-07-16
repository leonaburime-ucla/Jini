# CodeBase Analyzer Benchmark Suite

Canonical seeded eval suite for the CodeBase Analyzer agent.

- Agent under test: `codebase-analyzer`
- Source design: `../codebase-analyzer-eval-design.md`
- Suite shape: 30 seeds across 3 flattened `seed-state/` mini-projects
- Seed-state status: initial fixtures created for all three evals
- Run history: none yet; `run-manifest.tsv` and `run-results.tsv` are header-only
- Default execution mode: `repo_persona_subagent`

## Evals

- `codebase-analyzer-eval-1-sampling-evidence` tests sampling, token restraint, scope evidence, no-execution behavior, Sampling Notice completeness, and confidence calibration.
- `codebase-analyzer-eval-2-architecture-findings` tests entrypoint detection, dependency direction, circular dependency escalation, frontend/server boundary signals, test coverage signal, and security-surface flagging.
- `codebase-analyzer-eval-3-planning-escalation` tests migration caveats, zero-coverage remediation ordering, target-architecture fit, phase scope, hardcoded-secret escalation, and refusal to perform implementation work.

## Suite Artifacts

- `coverage-matrix.tsv`
- `seed-catalog.tsv`
- `seed-ledger.md`
- `controls.md`
- `run-manifest.tsv`
- `run-results.tsv`

## Validation

```bash
python3 harness-engineering/validators/validate_eval_suite.py harness-engineering/agent-evals/codebase-analyzer-evals/benchmark-suite
```

## Prepare One Eval Run

```bash
python3 harness-engineering/quality/scripts/prepare_eval_run.py \
  harness-engineering/agent-evals/codebase-analyzer-evals/benchmark-suite \
  run-001 \
  --eval codebase-analyzer-eval-1-sampling-evidence
```

After a real agent run, persist run proof in `run-manifest.tsv` first, then score each seed in `run-results.tsv`.
