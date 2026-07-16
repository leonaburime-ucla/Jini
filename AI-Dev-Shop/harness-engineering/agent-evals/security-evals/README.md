# Security Evals

Canonical seed design for the Security agent eval suite.

## Current Status

- Design date: 2026-05-10
- Source cowork run: `20260510T234109Z`
- Status: seed design finalized; benchmark suite files have not been generated yet.
- Canonical design doc: `security-eval-design.md`

## Model Provenance

- Primary design: Codex, `gpt-5.5`
- Independent design and focused review: Claude Opus via saved local Claude command model
- Independent design and challenge: Gemini, `gemini-3.1-pro-preview`
- Raw cowork artifacts: `ADS-project-knowledge/.local-artifacts/cowork/runs/20260510T234109Z/`

## Planned Suite Shape

- Target suite: future `benchmark-suite` directory under this eval package
- Seed count: 27
- Dimensions: 3
- Per dimension: 6 standard flaw seeds, 1 positive control, 1 regression, 1 negative control
- Implementation status: design only; no fixture projects or TSV files yet

## Next Step

Generate the benchmark suite files from `security-eval-design.md`, then validate with:

```bash
python3 harness-engineering/validators/validate_eval_suite.py harness-engineering/agent-evals/security-evals/benchmark-suite
```
