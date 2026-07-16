# QA/E2E Evals

Canonical seed design for the QA/E2E agent eval suite.

## Current Status

- Design date: 2026-05-11
- Source cowork run: `20260511T052905Z`
- Status: seed design finalized; benchmark suite files have not been generated yet.
- Canonical design doc: `qa-e2e-eval-design.md`

## Model Provenance

- Primary design: Codex, `gpt-5.5`
- Independent design and challenge: Claude, `us.anthropic.claude-opus-4-6-v1[1m]`
- Independent design and challenge: Gemini, `gemini-3.1-pro-preview`
- Raw cowork artifacts: `ADS-project-knowledge/.local-artifacts/cowork/runs/20260511T052905Z/`

## Planned Suite Shape

- Future suite directory: `benchmark-suite/` inside this bucket
- Seed count: 27
- Dimensions: 3
- Per dimension: 6 standard flaw seeds, 1 positive control, 1 regression, 1 negative control
- Implementation status: design only; no fixture projects or TSV files yet

## Next Step

Generate the benchmark suite files from `qa-e2e-eval-design.md`, then validate the generated suite with `validate_eval_suite.py`.
