# Tasks — Membership Billing

## Scope

- Implement request validation in `billing-api`.
- Implement idempotency and balance mutation in `billing-core`.
- Implement manual-review routing in `review-orchestrator`.
- Emit billing events through `billing-events`.

## Parallelization

| Module | Owner | Responsibility |
|---|---|---|
| `billing-api` | Programmer A | Request parsing and API response mapping |
| `billing-core` | Programmer B | Balance mutation and idempotency |
| `review-orchestrator` | Programmer C | Manual-review policy and routing |
| `billing-events` | Programmer D | Event schema and dispatch |

## TDD Scope

Write tests for the active task scope only. Do not pull behavior from superseded ADRs.
