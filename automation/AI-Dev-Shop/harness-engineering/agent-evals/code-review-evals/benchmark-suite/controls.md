# Controls — Code Review Benchmark Suite

Suite kind: `benchmark`

This suite is the canonical root for Code Review evals. Current status is
`pilot / depth-roadmap`; it is not yet a stable benchmark.

## Control Status

- per-eval seeded fixtures exist for 11 evals (order/payment saga,
  notification failover/privacy, distributed inventory allocation, authz graph,
  retry/idempotency queue, cache migration rollout, stream watermark
  checkpoint, webhook signature rotation, search projection depth batch,
  billing usage reconciliation hard-mode, and regional failover control-plane
  hard-mode)
- `coverage-matrix.tsv` and `seed-catalog.tsv` are normalized to the current
  validator taxonomy (`91` seeds, `91` coverage cells)
- suite-level controls now include `1` positive control, `2` negative
  controls from the original suite, `12` staff+ negative controls from the
  authz graph, retry/idempotency, cache migration, stream watermark, webhook
  signature, and search projection batches, `4` hard-mode negative controls
  from the billing and regional failover extensions, and a retained regression
  pack
- per-eval `seed-ledger.md` files remain the detailed seed narrative source

## Hard-Mode Extension

`cr-eval-10` and `cr-eval-11` are Tier 2/3 hard-mode extensions. They keep the
same TSV schema and scoring model as the base suite, but their project briefs
use weaker operational language, their fixtures include more correct distractor
code, and their negative controls are placed near real defects. Treat their
first runs as calibration evidence; strong agents should not be expected to
score near-perfect until the hard-mode prompts and fixtures have been proven.

## Current Rule

- use `seed-catalog.tsv` for structured seed lookups
- use `coverage-matrix.tsv` for dimension coverage analysis
- use the per-eval `seed-ledger.md` files for detailed seed narratives
- write future benchmark runs into this suite root

## Target Rule

This suite now carries the benchmark control definition directly in:

- `coverage-matrix.tsv`
- `seed-catalog.tsv`
- `seed-ledger.md`
- `run-results.tsv`

## Execution Guard

One subagent per eval. See `../../README.md` Execution Guard for the full
rule. Do not batch multiple evals into a single subagent — each eval must
run in its own isolated context loaded with only that eval's brief, prompt,
and seed-state.
