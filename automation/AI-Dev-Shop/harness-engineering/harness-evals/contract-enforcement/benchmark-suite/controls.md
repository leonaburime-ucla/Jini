# Controls — Contract Enforcement Suite

Suite kind: `benchmark`

Positive controls:

- `SEED-CT-01` — greenfield missing contract must trigger user escalation
- `SEED-CT-02` — brownfield missing contracts must produce advisory mode (not block)
- `SEED-CT-03` — blocking check failure on modified file must hard-block
- `SEED-CT-05` — blocking architecture violation on modified file must hard-block
- `SEED-CT-06` — product bug fix must proceed despite advisory architecture violation
- `SEED-CT-07` — stale contract must trigger escalation warning

Negative controls:

- `SEED-CT-04` — do not block on advisory architecture violation in untouched file
- `SEED-CT-08` — do not hard-block on declared gap slots in partial brownfield contract

Why these packs exist:

- Positive controls verify the enforcement system correctly blocks dangerous states and escalates when contracts are missing or stale.
- Negative controls verify the enforcement system does not over-enforce: does not block grandfathered violations, does not treat gaps as failures, and does not apply greenfield strictness to brownfield projects.
- The priority rule seed (CT-06) verifies that product-facing work trumps advisory architecture rules — the system should not prevent bug fixes.
