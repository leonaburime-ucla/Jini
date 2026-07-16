# Test Certification Record

- Test Suite: <name>
- Spec ID: <SPEC-id>
- Spec Version: <version>
- Spec Hash: <sha256 — must match hash in spec file>
- Spec Hash Verification: <command/tool output used; visual comparison is not enough>
- ADR: <path + hash or N/A>
- Tasks: <path + hash>
- Certified At: <ISO-8601 UTC>
- Certified By: TDD Agent

## Test File Inventory

Every test file currently certified for the feature must be listed here.
Deleted test files must be removed from this inventory in the same certification
update. TestRunner uses this table to detect stale, missing, tampered, or
silently deleted tests before execution.

| Test File | Type | Spec Refs | sha256 | Expected Test Count | Red Evidence |
|---|---|---|---|---:|---|
| `__tests__/unit/req-001.example.unit.test.ts` | unit | REQ-001 / AC-001 | sha256:<hash> | 3 | failed before implementation: <command/offload> |

## Covered Requirements

Map every test to the spec reference it covers. No orphan tests. No uncovered
requirements. The assertion summary must state the behavior proven, not only
the test name.

| Spec Ref | Priority | Test File | Test Name | Type | Assertion Summary | Status |
|---|---|---|---|---|---|---|
| REQ-01 / AC-01 | P1 | `tests/example.test.ts` | `<describe block> > <it block>` | Acceptance | Proves <observable behavior/value/error> | Certified |
| INV-01 | — | `tests/example.test.ts` | `<describe block> > <it block>` | Invariant | Proves <invariant outcome> | Certified |
| EC-02 | — | `tests/example.test.ts` | `<describe block> > <it block>` | Edge Case | Proves <edge behavior> | Certified |

## Outcome Matrix

For each module, define the state x input -> expected outcome map. Programmer
uses this to implement the observable behavior without inventing extra branches
or dead defensive paths.

| Module | State | Input | Expected Outcome | Spec Ref |
|---|---|---|---|---|
| `<module>` | `<state>` | `<input>` | `<observable outcome>` | AC-01 / INV-01 |

## Property-Based Tests

List each generated property test or state why none apply.

| Spec Ref | Property / Invariant | Generator Domain | Test Name | Status |
|---|---|---|---|---|
| INV-01 | <property> | <domain/range> | `<test name>` | Certified / N/A with reason |

## Contract Tests

List every ADR-defined API/event/module contract and the test approach used.

| Contract Source | Testing Approach | Test Name | Status | Gap / Waiver |
|---|---|---|---|---|
| ADR §API-01 | schema validation / consumer-driven / integration | `<test name>` | Certified | N/A |

## Known Gaps

Requirements that are not yet covered. Every gap requires a risk level. High-risk gaps block progression to Programmer.

| Spec Ref | Reason Not Covered | Risk | Resolution |
|---|---|---|---|
| EC-03 | Architecture contract not yet defined by Software Architect | High | Blocked — route to Software Architect |
| EC-05 | External dependency unavailable in test environment | Medium | Deferred to integration test phase |

## Drift Status

- [ ] Current spec hash matches certified hash above
- [ ] Current spec hash was verified mechanically, not by visual comparison
- [ ] Current test file hashes match the Test File Inventory
- [ ] Expected test count is greater than zero and matches the runnable suite inventory
- [ ] All High-risk gaps have been reviewed by Coordinator
- [ ] No test asserts implementation internals (only observable behavior)
- [ ] All P1 acceptance criteria have semantic assertion coverage, not only structural test-name mapping
