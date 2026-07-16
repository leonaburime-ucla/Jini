# Programmer Evals

This bucket keeps Programmer eval artifacts together.

## Layout

- `benchmark-suite/`
  Canonical benchmark suite containing evals 1-9 and suite-scoped TSVs.
  Evals `1-5` were rewritten against the current Python fixtures on
  `2026-04-29`, and the suite-level TSV metadata was backfilled to match.
  A later cheap `gpt-5.4-mini` targeted pass was exploratory only; rerun the
  rewritten suite with the full top-level Programmer agent before treating
  fresh scores as canonical benchmark signal.

## TSV Placement Rule

Keep suite-scoped TSVs at the root of the suite they describe:

- `coverage-matrix.tsv`
- `seed-catalog.tsv`
- `run-manifest.tsv`
- `run-results.tsv`

Re-run subsets are derived from saved benchmark results, not committed as
separate suites.
