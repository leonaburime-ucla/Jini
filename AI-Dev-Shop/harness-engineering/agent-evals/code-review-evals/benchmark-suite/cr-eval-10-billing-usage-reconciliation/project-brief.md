# Billing Usage Reconciliation — Project Brief

## Overview

Review a billing reconciliation worker for a usage-based SaaS platform. The
system records tenant usage events from three regional collectors, rolls them
into hourly buckets, reconciles them against enterprise contracts, applies
credits, and builds invoice previews for customer support before nightly
finalization.

## Operational Context

- Scale: 420 tenants, 35 enterprise tenants, peak 90K usage events/minute
- Collectors: three active collectors per region, at-least-once delivery
- Billing: monthly invoices, nightly reconciliation, support previews during
  the month
- Contracts: committed spend, mid-cycle plan changes, overage rates, tenant
  tax profiles, and prepaid credits
- Incident history: customers dispute invoices when source usage, plan epoch,
  credits, and tax treatment cannot be reconstructed
- Enforcement: rate-limit notices and hard stops should reflect current usage,
  not just completed billing batches

## Requirements

1. Usage events from collectors are accepted at-least-once. Legitimate events
   must not be dropped, and repeated delivery must not bill twice.
2. Contract changes are effective at the plan epoch recorded by the contract
   service. Invoice previews should explain which plan epoch was used.
3. Credits and adjustments are financial ledger entries. Support can preview
   them, but finalization and reconciliation must preserve an auditable trail.
4. Tenant tax treatment can differ by tenant, product, and region.
5. Enterprise invoices should reconcile to the cent across high-volume tenants.
6. Rate-limit enforcement uses the same contract limits as billing and should
   reflect burst usage in production traffic.

## Spec Hash

`spec-billing-usage-reconciliation-hardmode-v1-5dd6a9`
