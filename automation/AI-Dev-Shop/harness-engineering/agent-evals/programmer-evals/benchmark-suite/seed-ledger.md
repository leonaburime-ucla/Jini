# Seed Ledger — Programmer Benchmark Suite

This suite combines the retained Programmer benchmark material that previously
lived in two separate legacy corpora.

## Rewrite Status

On `2026-04-29`, evals `1-5` were rewritten against the current Python
fixtures after multiple retained seeds were confirmed stale. The suite-level
TSVs were backfilled to match that rewrite on the same date.

- the per-eval `seed-ledger.md` files are the current source of truth for seed
  narratives
- seed IDs are retained for backfill compatibility
- the saved Programmer run history should be treated as reset until fresh runs
  are scored against the rewritten narratives

## Included Evals

- `eval-1-rule-engine`
- `eval-2-batch-processor`
- `eval-3-adapter-boundary`
- `eval-4-stateful-cache`
- `eval-5-security-query-builder`
- `eval-6-task-scheduler`
- `eval-7-data-pipeline`
- `eval-8-access-control`
- `eval-9-report-generator`

## Data Sources

The suite-level TSVs (`seed-catalog.tsv`, `coverage-matrix.tsv`) are the
machine-readable inventory aligned to the rewritten fixtures. Per-eval
`seed-ledger.md` files remain the detailed narrative source.

## Total Seeds

79 seeds total: 74 seeded issues retained from the eval corpus plus 5
suite-level negative controls for false-positive calibration.

## Suite-Level Negative Controls

- `SEED-PG-NC-01`: correct fail-fast cart validation in
  `eval-1-rule-engine/seed-state/src/validation.py`
- `SEED-PG-NC-02`: stable two-object contract in
  `eval-1-rule-engine/seed-state/src/engine.py`
- `SEED-PG-NC-03`: pure chunk helper in
  `eval-2-batch-processor/seed-state/src/processor.py`
- `SEED-PG-NC-04`: working timeout guard in
  `eval-3-adapter-boundary/seed-state/src/adapter.py`
- `SEED-PG-NC-05`: bounded quality signal on the pure error-mapping helper in
  `eval-3-adapter-boundary/seed-state/src/adapter.py`

## Unresolved Programmer-Owned Seeds

Unresolved or partial Programmer-owned seeds should drive derived re-run
subsets after prompt, guard, or skill changes. They do not require a
separate committed rerun suite.
