---
name: adversarial-test-design
version: 1.0.0
last_updated: 2026-04-27
description: Use when designing tests or direct probes for rule, validation, batch, reducer, reconciliation, transfer, or other cross-record workflows so aggregate invariants, partial-failure paths, ordering assumptions, retries, and boundary collisions are challenged before handoff.
---

# Skill: Adversarial Test Design

Apply this skill when single-item happy-path tests can pass while the real risk
only appears across multiple records, repeated inputs, retries, ordering
changes, or partial failures.

This is a targeted companion to `testable-design-patterns`,
`function-quality-assessment`, and `test-design`. It is not a general test-plan
skill. Use it only when the workflow has meaningful aggregate or cross-item
risk.

## Ownership

- Programmer uses this skill during author-time pre-checks for aggregate-risk
  workflows.
- TDD Agent may use it when certifying aggregate invariants or adversarial edge
  cases.
- Code Review treats missing adversarial evidence as a real gap when aggregate
  risk is present.

## Design Gate

Before implementation or handoff, make these decisions explicit:

1. Name the invariant or failure mode.
2. Name the smallest adversarial case that could violate it.
3. Choose the strongest affordable signal: focused unit test, integration test,
   property test, or direct probe.
4. State the expected failure or protection clearly enough that another agent
   could assert it without guessing.

If you cannot name a meaningful adversarial case, say why the workflow is not
aggregate-sensitive instead of silently skipping this check.

## Common Adversarial Categories

Use at least one category that matches the workflow:

- duplicate or repeated keys
- sum, transfer, or conservation invariants
- ordering dependence or unstable sort assumptions
- partial-invalid batches or mixed-validity inputs
- retry duplication and idempotency failure
- exact-boundary behavior at min, max, cap, or threshold
- conflicting rules or precedence collisions
- partial failure with leaked intermediate state

## Selection Rules

- Use a focused example test when one concrete case demonstrates the risk
  clearly.
- Use a property test when the invariant should hold across many inputs or
  combinations. Read
  `<AI_DEV_SHOP_ROOT>/skills/test-design/references/property-based-testing.md`
  when this is the better fit.
- Use an integration test when the risk lives at a module, storage, or service
  boundary.
- Use a direct probe only when the best signal is not practical as a retained
  test in the current slice. Direct probes still need explicit expected results.

## Output Expectations

When this skill materially shapes the work, report:

- invariant or failure mode
- chosen adversarial case
- signal type: unit test, integration test, property test, or direct probe
- file or command where the evidence lives

