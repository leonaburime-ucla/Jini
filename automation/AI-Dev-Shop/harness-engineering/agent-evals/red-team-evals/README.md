# Red-Team Evals

Canonical seed design for the Red-Team agent eval suite.

## Current Status

- Design date: 2026-05-10
- Source cowork run: `20260509T203057Z`
- V2 depth update: 2026-05-11
- V2 cowork run: `20260511T055108Z`
- Status: v1 benchmark suite generated; v2 depth design finalized and pending benchmark regeneration.
- Canonical design doc: `red-team-eval-design.md`
- V1 benchmark suite: `benchmark-suite/`

## Model Provenance

- Primary design: Codex, `gpt-5.5`
- Independent design and focused review: Claude Opus via saved local Claude command model
- Independent design and challenge: Gemini, `gemini-3.1-pro-preview`
- Exact peer IDs and raw responses are retained under `ADS-project-knowledge/.local-artifacts/cowork/runs/20260509T203057Z/offloads/`.
- V2 depth primary design: Codex, `gpt-5.5`
- V2 depth independent design and challenge: Claude, `us.anthropic.claude-opus-4-6-v1[1m]`
- V2 depth independent design and challenge: Gemini, `gemini-3.1-pro-preview`
- V2 raw cowork artifacts are retained under `ADS-project-knowledge/.local-artifacts/cowork/runs/20260511T055108Z/`.

## Planned Suite Shape

- Suite path: `harness-engineering/agent-evals/red-team-evals/benchmark-suite`
- Seed count: 30
- Dimensions: 3
- Total mix: 18 standard flaw seeds, 3 positive controls, 3 regression seeds, 6 negative controls
- V2 implementation status: design only; v1 suite metadata and three flattened `seed-state/` fixture projects exist, but must be regenerated before claiming v2 coverage.
- V2 depth note: traps now require compositional, cross-artifact, domain-specific, debatable-boundary, and explanation-quality scoring coverage.

## Next Step

Regenerate the benchmark suite from `red-team-eval-design.md`, including companion artifacts and the v2 partial-credit scoring rubric. Then validate and run an isolated Red-Team eval:

```bash
python3 harness-engineering/validators/validate_eval_suite.py harness-engineering/agent-evals/red-team-evals/benchmark-suite
```

Prepare one isolated run with:

```bash
python3 harness-engineering/quality/scripts/prepare_eval_run.py \
  harness-engineering/agent-evals/red-team-evals/benchmark-suite \
  run-001 \
  --eval red-team-eval-1-spec-probes
```
