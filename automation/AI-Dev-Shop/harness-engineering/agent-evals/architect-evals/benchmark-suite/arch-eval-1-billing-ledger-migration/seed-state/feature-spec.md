# Feature Spec: Billing Ledger Migration

## Overview

Migrate the billing subsystem from ORM-coupled invoice logic in the
monolith to a standalone ledger service that can handle new billing models
(usage-based, prepaid credits, multi-currency) without monolith deploys.

## Business Context

RapidScale is a B2B infrastructure-as-a-service platform. ~2,400
enterprise customers with annual contracts. Current billing lives inside
a Django monolith serving the full product — provisioning, billing,
support portal, admin.

Finance flagged three urgent problems last quarter:

1. Refund disputes take 5+ days to resolve because the billing code
   shares transaction boundaries with provisioning workflows — you
   can't replay or audit billing state independently.
2. Adding usage-based pricing for the new compute product required 3
   months of monolith changes across 14 files because the pricing
   logic is scattered across Django views, model signals, and Celery
   tasks.
3. A partial deploy last March left 47 invoices in an inconsistent
   state — some line items were finalized while others weren't — because
   the invoice creation spans multiple HTTP requests with no saga or
   compensation.

## Functional Requirements

- FR-1: Invoice creation, modification, and finalization must be atomic —
  no partial invoices. During migration, both systems may issue credits
  unless the architecture explicitly prevents it.
- FR-2: Every billing state change must be reconstructable. Given an
  invoice ID, produce the complete change history showing who/what changed
  each field and when.
- FR-3: Support staff can recompute any historical invoice using archived
  input data (usage records, contract terms, credits applied).
- FR-4: Usage-based charges ingest events from the metering service. Events
  arrive continuously; the billing ledger must aggregate them per billing
  period without losing events during deploys or restarts.
- FR-5: Multi-currency support — customers choose their billing currency at
  contract signing. Exchange rates are locked at invoice finalization.
- FR-6: Credit management — prepaid credits, promotional credits, and
  overage credits must be tracked as first-class ledger entries with
  expiration dates and priority rules.
- FR-7: Invoice corrections, credit disputes, and refund workflows may
  span 30-90 days from initiation to resolution. The system must track
  workflow state durably across this period.

## Non-Functional Requirements

- NFR-1: Invoice finalization throughput — batch-finalize all 2,400
  customer invoices within a 4-hour maintenance window on the 1st of each
  month.
- NFR-2: Usage event ingestion — sustain 12,000 events/second during
  month-end reporting bursts without dropping events.
- NFR-3: Billing API response time — admin and customer-facing queries
  return within 400ms p95.
- NFR-4: Availability — billing reads must be 99.9%. Billing writes can
  tolerate planned maintenance (up to 2 hours/month on weekends).
- NFR-5: Dispute resolution queries — support staff can retrieve full
  invoice audit trail within 3 seconds.

## Constraints

- The monolith continues to serve provisioning, support portal, and admin.
  Only billing is being extracted.
- The new ledger service must expose events that the monolith can consume
  to update its billing display screens (eventual consistency acceptable
  for display-only).
- Existing invoice numbers and customer-facing billing URLs must remain
  stable (no breaking changes to external references).
- The migration must not disrupt live billing. Invoices generated during
  the transition must be correct regardless of which system produces them.
- SOC 2 Type II audit is ongoing. The billing data flow changes must be
  documented for the auditor and must maintain the existing control
  effectiveness.
- Finance requires that all invoice mutations are traceable to an
  authorized actor (human or system identity). Silent overwrites are
  forbidden.

## Roadmap (Next 6 Months)

- Q4 2026: Onboard first healthcare customer (MedVault). Their contract
  requires HIPAA BAA. Billing data for healthcare customers must be stored
  in a HIPAA-eligible environment with audit logging that meets HHS
  requirements. This is the company's first regulated-industry customer.
- Q1 2027: International expansion (UK). Requires multi-currency invoicing
  with GBP and EUR, which is already in scope for this migration.

## Out of Scope

- Payment gateway integration (stays in monolith for now).
- Customer-facing self-service billing portal changes.
- Tax calculation engine (unchanged, called as an external service).

## Team Context

Referenced in `team-and-operations.md`.

## Spec Hash

`spec-billing-ledger-v2-8f4a21`
