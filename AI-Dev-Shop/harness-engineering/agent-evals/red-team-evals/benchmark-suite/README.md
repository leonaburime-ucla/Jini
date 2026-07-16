# Red-Team Benchmark Suite

Canonical seeded eval suite for the Red-Team agent.

- Agent under test: `red-team`
- Source design: `../red-team-eval-design.md`
- Suite shape: 30 seeds across 3 flattened `seed-state/` mini-projects
- Seed-state status: initial spec fixtures created for all three evals
- Run history: none yet; `run-manifest.tsv` and `run-results.tsv` are header-only
- Default execution mode: `repo_persona_subagent`

## Evals

- `red-team-eval-1-spec-probes` tests ambiguity, contradiction, missing failure modes, hidden dependencies, exploitability restraint, and false-positive control.
- `red-team-eval-2-severity-calibration` tests BLOCKING/ADVISORY/CONSTITUTION-FLAG classification, systemic escalation, and hallucinated blocker restraint.
- `red-team-eval-3-boundary-discipline` tests constitution pressure, report-only behavior, scope creep, context bleed, destructive-proof restraint, and false-positive control.

The suite includes three extra negative controls beyond the original 27-seed design so it clears the repo's 30+ pilot threshold and gives each dimension two false-positive checks.

## Suite Artifacts

- `coverage-matrix.tsv`
- `seed-catalog.tsv`
- `seed-ledger.md`
- `controls.md`
- `run-manifest.tsv`
- `run-results.tsv`

## Validation

```bash
python3 harness-engineering/validators/validate_eval_suite.py harness-engineering/agent-evals/red-team-evals/benchmark-suite
```

## Prepare One Eval Run

```bash
python3 harness-engineering/quality/scripts/prepare_eval_run.py \
  harness-engineering/agent-evals/red-team-evals/benchmark-suite \
  run-001 \
  --eval red-team-eval-1-spec-probes
```

After a real agent run, persist run proof in `run-manifest.tsv` first, then score each seed in `run-results.tsv`.
