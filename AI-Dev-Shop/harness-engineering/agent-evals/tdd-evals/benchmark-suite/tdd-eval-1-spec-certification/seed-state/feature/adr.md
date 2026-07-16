# ADR — Membership Billing Test Boundaries

- ADR ID: `ADR-301B`
- Status: Accepted
- Supersedes: `ADR-301A`
- Imported Contract Summary: `ADR-301A#api-event-contract-summary`

## Decision

Use a modular billing core with a thin API adapter. The `billing-core` module owns adjustment validation, idempotency, balance mutation, and manual-review policy.

## API/Event Contract Summary

- API: `POST /membership/:memberId/billing-adjustments`
- Success event: `membership.billing.adjustment.applied`
- Hold event: `membership.billing.adjustment.review_requested`
- Contract testing approach: schema validation for API requests and event payloads.

## Boundary Notes

The active ADR says policy logic belongs in `billing-core`. The imported superseded contract summary from `ADR-301A` described policy as an orchestration concern and should not be treated as active unless reconciled.
