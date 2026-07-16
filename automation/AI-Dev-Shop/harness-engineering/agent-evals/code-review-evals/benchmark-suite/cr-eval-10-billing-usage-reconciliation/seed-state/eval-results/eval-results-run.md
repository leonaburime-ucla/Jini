# Fake Programmer Handoff — cr-eval-10-billing-usage-reconciliation

## Summary

Implemented the billing usage reconciliation worker for usage-based SaaS
billing. The worker accepts collector usage events, deduplicates repeat
delivery, rolls raw usage into hourly buckets, reconciles against tenant
contracts, applies credits, builds invoice previews, evaluates rate limits,
and attaches tax lines from tenant tax profiles.

## Claimed Coverage

- Usage events are deduplicated before entering billing aggregation.
- Hourly aggregation uses deterministic bucket keys and decimal totals.
- Reconciliation writes overage adjustments once per tenant/hour.
- Credit ledger entries are recorded with invoice IDs and audit events.
- Tenant tax profiles are cached for invoice preview performance.
- Rate-limit enforcement uses the same plan cache as billing.
- Contract parsing validates required enterprise plan fields.
- Tests cover usage ingestion, aggregation, reconciliation, credits, tax,
  rate limits, contract parsing, and invoice reports.

## Self-Assessment

All requirements are complete. The worker is ready for Code Review with no
known correctness gaps. The implementation intentionally favors simple in-memory
stores in the fixture because production persistence is outside this eval.
