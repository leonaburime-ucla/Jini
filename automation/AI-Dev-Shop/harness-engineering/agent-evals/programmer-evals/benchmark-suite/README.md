# Programmer Benchmark Suite

This is the canonical benchmark suite root for Programmer evals.

## Scope

- includes evals `1-9`
- combines the former function-quality and checklist/trick-seed corpora into
  one retained benchmark suite
- holds the suite-scoped TSV files used for future validation and scoring
- evals `1-5` were rewritten against the current fixtures on `2026-04-29`
  after seed-to-fixture drift was confirmed in the older retained narratives

## Canonical Suite Files

The suite-level source of truth lives here:

- `coverage-matrix.tsv`
- `seed-catalog.tsv`
- `seed-ledger.md`
- `controls.md`
- `run-manifest.tsv`
- `run-results.tsv`

## Migration Status

- the eval directories have been normalized to `seed-state/` so
  `prepare_eval_run.py` can discover them
- the suite-level TSVs are aligned with the rewritten eval `1-5` narratives as
  of `2026-04-29`
- the per-eval `seed-ledger.md` files remain the detailed seed narrative source
- the saved Programmer run history was reset after the stale seed rewrite;
  rerun before treating this suite's scores as current benchmark signal
- a later `gpt-5.4-mini` targeted pass over the rewritten evals was useful only
  as an exploratory cheap check; rerun with the full top-level Programmer
  agent before saving new canonical benchmark results
