# Constraints & Non-Functional Requirements

## Compliance

- SOC 2 Type II: billing data flows are in audit scope. All state
  mutations require actor identity and timestamp. The auditor reviews
  change traceability annually.
- No PCI data in this service — payment tokens remain in the monolith.
- Data classification: invoice data is "Internal Confidential." Stored
  encrypted at rest (AES-256), transmitted over TLS 1.2+.
- Retention: finalized invoices and their audit trails must be retained
  for 5 years. Raw usage events must be retained for 3 years (cold
  storage acceptable after 90 days; hot retrieval required within 90 days
  for dispute resolution).
- Tenant isolation: this is a single-operator platform. Customer data
  separation is a SECURITY concern (no cross-customer data leakage) but
  NOT an architectural multi-tenancy concern (no per-customer
  infrastructure, no per-customer deployment, no per-customer schema).
  The HIPAA healthcare customer (Q4 2026) requires environment-level
  data isolation for PHI — this is a COMPLIANCE concern separate from
  general tenant isolation.
- Known audit-trigger limitation: PostgreSQL triggers do not fire on
  COPY/bulk-insert operations and can be disabled by superusers. The
  current monolith's audit triggers have been bypassed twice during
  emergency data patches (documented in incident reports).

## Performance

| Metric | Target |
|--------|--------|
| Usage event ingestion | 12,000 events/sec sustained (month-end peak) |
| Invoice finalization batch | Complete within 4 hours for 2,400 customers |
| Billing API p95 | 400ms for admin/customer queries |
| Dispute audit trail | Full history within 3 seconds |
| Credit operations | Applied within same transaction as invoice line |

## Availability

- Billing reads: 99.9%
- Billing writes: 99.5% (planned maintenance acceptable on weekends)
- Usage event ingestion: must not lose events during deploys or restarts
  (buffering acceptable, loss is not)

## Data

- Source of truth for invoice state must be exactly one system at any
  point during migration (no split-brain writes).
- All billing amounts stored as integer cents (no floating point).
- Multi-currency amounts stored with original currency + exchange rate
  at finalization.

## Organizational

- VP Engineering approved strangler-fig approach. Big-bang rewrite is
  not approved.
- The metering service team is a separate team. They will publish events
  to a shared bus but will not modify their service for this migration
  beyond schema documentation.
- The platform engineer is shared across 3 teams at 33% allocation each.

## Technology

- AWS us-east-1 only. No multi-region requirement.
- PostgreSQL is the approved RDBMS. Other databases require VP approval
  (4-6 week procurement).
- Message bus: SQS is already used. Kafka is available via the metering
  service cluster (3-broker, 7-day retention). Either is acceptable
  without additional approval.
- No Kubernetes. Runtime is ECS Fargate.
- Managed Temporal Cloud is available without VP approval (already in
  platform team's service catalog) but the billing team has not operated
  it in production.
- The fixture does not specify whether usage events contain Protected
  Health Information (PHI) for the Q4 2026 HIPAA customer. This is
  unresolved.

## Hard Constraint (VP-Level)

- The CFO has mandated: "No billing event may be processed more than once.
  Duplicate charges are an existential reputational risk. I want exactly-
  once processing guarantees, not 'at-least-once with dedup.'"
- Simultaneously, the CTO requires: "Zero event loss under any failure
  scenario, including mid-deploy crashes and network partitions. We cannot
  afford to miss a single billable event."
- These requirements are non-negotiable and both executives have sign-off
  authority on the architecture.
