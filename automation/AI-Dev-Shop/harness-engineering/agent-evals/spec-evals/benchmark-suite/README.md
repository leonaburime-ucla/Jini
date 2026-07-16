# Spec Benchmark Suite

Canonical seeded eval suite for the Spec agent.

- Agent under test: `spec`
- Source design: `../spec-eval-design.md`
- Suite shape: 30 seeds across 3 flattened `seed-state/` mini-projects
- Provider coverage: Speckit + OpenSpec
- Excluded providers: BMAD and Kiro
- Seed-state status: initial provider fixtures created for all three evals
- Run history: none yet; `run-manifest.tsv` and `run-results.tsv` are header-only
- Default execution mode: `repo_persona_subagent`

## Evals

- `spec-eval-1-provider-resolution` tests active-provider resolution, cross-provider artifact restraint, provider metadata, switch checkpoints, validator selection, and future-provider-safe behavior.
- `spec-eval-2-speckit-readiness` tests Speckit strict package completeness, conditional contract files, traceability, clarification, spec-dod, hash/version, and validator gates.
- `spec-eval-3-openspec-readiness` tests OpenSpec change folders, proposal completeness, delta specs, scenarios, baseline specs, design/tasks readiness, placeholder cleanup, and OpenSpec clarification behavior.

## Suite Artifacts

- `coverage-matrix.tsv`
- `seed-catalog.tsv`
- `seed-ledger.md`
- `controls.md`
- `run-manifest.tsv`
- `run-results.tsv`

## Validation

```bash
python3 harness-engineering/validators/validate_eval_suite.py harness-engineering/agent-evals/spec-evals/benchmark-suite
```

## Prepare One Eval Run

```bash
python3 harness-engineering/quality/scripts/prepare_eval_run.py \
  harness-engineering/agent-evals/spec-evals/benchmark-suite \
  run-001 \
  --eval spec-eval-1-provider-resolution
```

After a real agent run, persist run proof in `run-manifest.tsv` first, then score each seed in `run-results.tsv`.
