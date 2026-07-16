# Controls — Programmer Benchmark Suite

Suite kind: `benchmark`

This suite is the canonical retained benchmark root for Programmer evals.

## Control Status

- per-eval seeded fixtures exist for all evals
- `coverage-matrix.tsv` and `seed-catalog.tsv` are aligned with the rewritten
  eval `1-5` narratives
- suite-level controls now include `5` positive controls, `5` negative
  controls, and a large retained regression pack
- per-eval `seed-ledger.md` files remain the detailed seed narrative source

## Current Rule

- use `seed-catalog.tsv` for structured seed lookups
- use `coverage-matrix.tsv` for dimension coverage analysis
- use the per-eval `seed-ledger.md` files for detailed seed narratives
- write future benchmark runs into this suite root, not into a separate suite

## Target Rule

This suite now carries the benchmark control definition directly in:

- `coverage-matrix.tsv`
- `seed-catalog.tsv`
- `seed-ledger.md`
- `run-results.tsv`

Do not grade or compare fresh Programmer runs against the pre-rewrite
`run-results.tsv` rows. The backfill is complete; fresh grading is blocked
only on new reruns because the old saved run rows were intentionally reset.
Do not treat a cheap `gpt-5.4-mini` targeted pass as canonical benchmark
evidence for the rewritten evals either; rerun with the full top-level
Programmer agent before saving the next benchmark-grade results.

## Execution Guard

One subagent per eval. See `../../README.md` Execution Guard for the full
rule. Do not batch multiple evals into a single subagent — each eval must
run in its own isolated context loaded with only that eval's brief, prompt,
and seed-state.
