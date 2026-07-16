# Docs Benchmark Suite

Canonical seeded eval suite for the Docs agent.

- Agent under test: `docs`
- Source design: `../docs-eval-design.md`
- Suite shape: 30 seeds across 3 flattened `seed-state/` mini-projects
- Seed-state status: initial fixtures created for all three evals
- Run history: none yet; `run-manifest.tsv` and `run-results.tsv` are header-only
- Default execution mode: `repo_persona_subagent`

## Evals

- `docs-eval-1-api-contracts` tests OpenAPI generation from provider API contracts, endpoint completeness, schema fidelity, examples, operation IDs, compatibility events, and public/internal API restraint.
- `docs-eval-2-user-facing-docs` tests user-guide structure, Keep a Changelog discipline, migration guide requirements, release-note audience fit, and security/user-facing behavior updates.
- `docs-eval-3-authority-safety` tests source authority, spec-vs-implementation divergence escalation, sensitive-data safety, Coordinator reporting, boundary discipline, and context isolation.

## Suite Artifacts

- `coverage-matrix.tsv`
- `seed-catalog.tsv`
- `seed-ledger.md`
- `controls.md`
- `run-manifest.tsv`
- `run-results.tsv`

## Validation

```bash
python3 harness-engineering/validators/validate_eval_suite.py harness-engineering/agent-evals/docs-evals/benchmark-suite
```

## Prepare One Eval Run

```bash
python3 harness-engineering/quality/scripts/prepare_eval_run.py \
  harness-engineering/agent-evals/docs-evals/benchmark-suite \
  run-001 \
  --eval docs-eval-1-api-contracts
```

After a real agent run, persist run proof in `run-manifest.tsv` first, then score each seed in `run-results.tsv`.
