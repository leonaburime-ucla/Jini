# Initial Harness Rollout

- Date: 2026-03-22
- Status: Active
- Owner: Framework maintainers

## Goal

Add a first harness-engineering layer to AI Dev Shop without breaking the existing framework contract.

## Why This Exists

The repo already has strong process documentation, but much of the contract remains advisory. This rollout converts a small but meaningful slice of that contract into local, executable harness artifacts.

## Scope For This Slice

1. Add a root `harness-engineering/` folder as the local system of record for harness work.
2. Distill external harness guidance into local references.
3. Add executable validators for:
   - broken repo path references
   - stale or incomplete skills-registry entries
4. Add an advisory doc-garden audit.
5. Record an initial quality baseline and known debt.

## Out Of Scope For This Slice

- project-specific runtime validation loops
- CI wiring
- automatic PR creation for cleanup tasks
- benchmark sample generation
- architecture-level code dependency linting for downstream app repos

## Success Criteria

- Maintainers can run one command to check repo knowledge integrity.
- Harness guidance is discoverable locally without re-fetching web articles.
- Known harness gaps are tracked in one place.
- The rollout is additive and does not require a new repo fork.

## Next Phases

### Phase 2

- Wire validators into CI
- Add explicit Observer cadence and garbage-collection rules
- Seed benchmark fixtures for major agents

### Phase 3

- Add project-level runtime self-validation harness templates
- Add structured pipeline metrics aggregation
- Promote selected advisory audits into hard gates
