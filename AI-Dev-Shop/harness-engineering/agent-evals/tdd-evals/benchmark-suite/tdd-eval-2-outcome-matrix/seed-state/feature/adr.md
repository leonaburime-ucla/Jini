# ADR — Checkout Risk Boundaries

- ADR ID: `ADR-302`
- Status: Accepted

## Decision

Use a checkout-risk domain module with an API adapter and a small UI hold banner.

## Capacity And Runtime Constraints

- The risk service allows 60 requests per minute per merchant.
- Checkout must respond in p95 <= 250 ms when the risk service is available.
- When the risk service is unavailable, checkout must fail closed for unverified sessions and hold verified sessions for manual review.

## API/Event Contract Summary

- API contract: `POST /checkout/risk-score`
- Contract testing approach: schema validation for request/response fixtures.

## UI Scope

`RiskHoldBanner.tsx` is a customer-visible React component and must be tested when changed.
