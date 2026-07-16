# Controls - System Design Benchmark Suite

The suite uses explicit controls to separate real misses from false-positive tendency and regression drift.

## Positive Controls

- `SD1-SEED-01`: Core functional discovery. Agent must identify actors and resource lifecycles from scattered stakeholder input. Calibration — any competent system design pass should find these.

## Negative Controls

- `SD1-SEED-02`: Enterprise requirements (SSO, SCIM, audit, guest controls) that look like scope creep but are explicitly required by named lighthouse pilots. Agent must NOT defer them.
- `SD1-SEED-06`: Mobile offline described narrowly (draft preservation, catch-up reads) — not full offline-first. Agent must NOT escalate as impossible CRDT requirement.
- `SD1-SEED-12`: Horizontal P0 foundation that looks like over-engineering but is justified by beta failure modes and 6-team parallelism. Agent must NOT reject it merely because vertical slices are the default.
- `SD1-SEED-14`: Realtime as pure infrastructure (not a product domain). Team explicitly declines product semantics ownership. Agent must NOT propose realtime as a domain service.

## Red-Herring Bait (embedded in fixture, not scored as separate seeds)

- Availability section in constraints.md describes standard SLA requirements trivially met by managed Postgres + blue/green deploys. Agent should NOT propose complex HA architecture for these.

## Scoring Notes

- Negative controls are scored only as `CORRECT_SKIP` or `FALSE_POSITIVE`.
- Standard/positive controls are scored as `CAUGHT`, `PARTIAL`, or `MISSED`.
- Distinguished seeds (SD1-SEED-14, SD1-SEED-15) test judgment that requires synthesizing information across all three seed-state documents.
- Severity traps: SD1-SEED-08 and SD1-SEED-09 are Critical because technology and topology mistakes propagate to every downstream spec. SD1-SEED-15 is Critical because encoding unsafe defaults for a trust/compliance boundary has legal consequences.
- The agent under test must not see this file, `seed-design.md`, `seed-catalog.tsv`, `seed-ledger.md`, or `coverage-matrix.tsv`.
