# TestRunner Evals

Canonical seed design and initial benchmark suite for the TestRunner agent.

## Current Status

- Design date: 2026-05-10
- Source cowork run: `20260509T203057Z`
- Status: benchmark suite generated with flattened `seed-state/` eval projects; first targeted run retained.
- Canonical design doc: `testrunner-eval-design.md`
- Benchmark suite: `benchmark-suite/`

## Model Provenance

- Primary design: Codex, `gpt-5.5`
- Independent design and focused review: Claude Opus via saved local Claude command model
- Independent design and challenge: Gemini, `gemini-3.1-pro-preview`
- Exact peer IDs and raw responses are retained under `ADS-project-knowledge/.local-artifacts/cowork/runs/20260509T203057Z/offloads/`.

## Suite Shape

- Suite path: `harness-engineering/agent-evals/testrunner-evals/benchmark-suite`
- Seed count: 27
- Dimensions: 3
- Per dimension: 6 standard flaw seeds, 1 positive control, 1 regression, 1 negative control
- Implementation status: suite metadata plus flattened `seed-state/` projects created
- Retained run: `benchmark-suite/testrunner-eval-1-fresh-evidence/runs/run-001`

## Validation

Validate with:

```bash
python3 harness-engineering/validators/validate_eval_suite.py harness-engineering/agent-evals/testrunner-evals/benchmark-suite
```

Prepare one isolated run with:

```bash
python3 harness-engineering/quality/scripts/prepare_eval_run.py \
  harness-engineering/agent-evals/testrunner-evals/benchmark-suite \
  run-001 \
  --eval testrunner-eval-1-fresh-evidence
```
