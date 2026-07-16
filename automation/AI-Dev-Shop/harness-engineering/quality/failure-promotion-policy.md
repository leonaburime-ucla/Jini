# Failure Promotion Policy

Repeated mistakes should stop living as tribal knowledge.

## Promotion Trigger

A failure class must be reviewed for harness promotion when either condition is true:

- the same failure class appears twice across separate runs
- one failure cluster burns 3 or more cycles in a single run

## Allowed Promotion Targets

Choose the smallest durable artifact that prevents the repeat:

- hard validator
- advisory audit rule
- benchmark fixture
- pre-completion checklist
- workflow or cadence rule
- skills update
- local reference note if the pattern is still being explored

## Decision Rule

Prefer the most mechanical option available:

1. validator or deterministic tripwire
2. benchmark or regression fixture
3. checklist or workflow rule
4. skills or reference update

If a failure can be detected mechanically, do not stop at prose.

## Owner Split

- Observer identifies recurrence and recommends the promotion target
- Coordinator records the decision and routes the follow-up work
- Human approves larger behavioral changes when they alter stage contracts

## Examples

- repeated stale path references -> validator expansion
- repeated weak spec handoffs -> benchmark plus checklist
- repeated premature "done" claims -> pre-completion checklist
- repeated file-edit thrash -> loop-detection rule or explicit retry tripwire
