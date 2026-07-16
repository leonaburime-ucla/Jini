# Spec Evals

Canonical seed design for the Spec agent eval suite.

## Current Status

- Design date: 2026-05-10
- Source cowork run: `20260510T234109Z`
- Revision cowork run: `20260511T001310Z`
- Status: benchmark suite generated for Speckit + OpenSpec; no saved runs yet.
- Canonical design doc: `spec-eval-design.md`
- Benchmark suite: `benchmark-suite/`

## Model Provenance

- Primary design: Codex, `gpt-5.5`
- Independent design and focused review: Claude Opus via saved local Claude command model
- Independent design and challenge: Gemini, `gemini-3.1-pro-preview`
- Raw cowork artifacts: `ADS-project-knowledge/.local-artifacts/cowork/runs/20260510T234109Z/`

## Planned Suite Shape

- Suite path: `harness-engineering/agent-evals/spec-evals/benchmark-suite`
- Seed count: 30
- Dimensions: 3
- Per dimension: 6 standard flaw seeds, 1 positive control, 1 regression, 2 negative controls
- Provider coverage: Speckit + OpenSpec only; BMAD and Kiro are excluded from this suite version.
- Implementation status: suite metadata and three flattened `seed-state/` fixture projects created; run TSVs are header-only until the first retained run.

## Next Step

Validate and run an isolated Spec eval:

```bash
python3 harness-engineering/validators/validate_eval_suite.py harness-engineering/agent-evals/spec-evals/benchmark-suite
```

Prepare one isolated run with:

```bash
python3 harness-engineering/quality/scripts/prepare_eval_run.py \
  harness-engineering/agent-evals/spec-evals/benchmark-suite \
  run-001 \
  --eval spec-eval-1-provider-resolution
```
