# Contract Enforcement Benchmark Suite

Tests whether the host-project contract system correctly governs pipeline behavior across greenfield/brownfield scenarios, enforcement tiers, and priority conflicts.

## What This Tests

- Correct escalation when contracts are missing (greenfield vs brownfield)
- Hard blocking when blocking checks fail on modified code
- Grandfathering of pre-existing violations in untouched files
- Validator priority rule (product fixes over advisory architecture rules)
- Stale contract detection and escalation
- Partial contract handling in brownfield adoption

## Contracts Under Test

- `framework/contracts/computational-controls.md`
- `framework/contracts/runtime-validation.md`
- `framework/contracts/architecture-fitness.md`
- `framework/contracts/enforcement.md`

## Suite Files

- `seed-catalog.tsv` — seed metadata and expected behaviors
- `seed-ledger.md` — human-readable seed descriptions
- `controls.md` — positive/negative control definitions
- `coverage-matrix.tsv` — dimension coverage per seed
