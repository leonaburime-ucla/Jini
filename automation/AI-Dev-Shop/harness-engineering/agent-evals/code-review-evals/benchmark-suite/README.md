# Code Review Benchmark Suite

Canonical suite root for Code Review evals.

- Status: pilot / depth-roadmap. The suite is not yet a stable benchmark.
- 11 evals: order/payment saga (cr-eval-1), notification failover/privacy
  (cr-eval-2), distributed inventory allocation (cr-eval-3), authz graph
  depth batch (cr-eval-4), retry/idempotency queue depth batch (cr-eval-5),
  cache migration rollout depth batch (cr-eval-6),
  stream watermark checkpoint depth batch (cr-eval-7), webhook signature
  rotation depth batch (cr-eval-8), and search index replica projection depth
  batch (cr-eval-9), plus hard-mode billing usage reconciliation (cr-eval-10)
  and regional failover control plane (cr-eval-11).
- Tests Code Review agent in isolation using seeded code + fake Programmer handoff
- Each eval has a `seed-state/` with Python source, tests, and a fake handoff report
- The current hardening path is to add real fixture-backed staff/principal/
  distinguished seed batches while lowering bug density and increasing
  weak-spec/noise pressure. The current evidence-backed total is 91 seeds.
  Do not claim benchmark readiness from roadmap rows or planned seeds that do
  not have evidence-backed fixture files.

Suite-scoped TSVs and seed-ledgers are the source of truth.

- `coverage-matrix.tsv`
- `seed-catalog.tsv`
- `seed-ledger.md`
- `controls.md`
- `run-manifest.tsv`
- `run-results.tsv`
