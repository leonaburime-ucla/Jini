# System Blueprint: Billing Ledger Migration

## Infrastructure Notes

- Applications connect directly to RDS PostgreSQL via psycopg2 driver
  connection pools (default max 20 connections per ECS task). No external
  connection pooler (PgBouncer, RDS Proxy) is currently provisioned.
- Temporal Cloud is in the platform team's service catalog (managed, no
  Kafka dependency — uses its own Postgres-backed persistence). The billing
  team has not used it.
- Financial ledger rollback note: in accounting systems, destructive state
  rollback (DELETE/UPDATE to prior state) violates audit trail integrity.
  The standard is compensating journal entries that preserve history.

## Customer Segmentation

- ~2,400 active customers range from $500/month startups to $180K/month
  enterprise accounts.
- Top 50 customers generate 72% of revenue.
- Customer billing models: 60% flat subscription, 30% usage-based, 10%
  hybrid (subscription + usage overage).

## Current State

```
┌─────────────────────────────────────────────────┐
│                Django Monolith                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐│
│  │Provision │ │ Billing  │ │ Support Portal   ││
│  │  Module  │ │  Module  │ │     Module       ││
│  └────┬─────┘ └────┬─────┘ └────────┬─────────┘│
│       │             │                │           │
│  ┌────┴─────────────┴────────────────┴─────┐    │
│  │         Shared PostgreSQL (RDS)          │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
         │                    │
    ┌────┴────┐         ┌────┴────┐
    │ Metering│         │   Tax   │
    │ Service │         │ Service │
    └─────────┘         └─────────┘
```

The billing module is 14,000 lines of Django code: models, views, Celery
tasks, management commands, and admin panels. It shares the same database,
the same Django ORM session, and the same deployment unit as provisioning.

## Domain Ownership

| Domain | Current Owner | Target Owner |
|--------|--------------|--------------|
| Invoice lifecycle | Billing module (monolith) | New ledger service |
| Usage metering | Metering service (standalone) | Unchanged |
| Payment processing | Billing module (monolith) | Stays in monolith |
| Credit management | Billing module (monolith) | New ledger service |
| Tax calculation | Tax service (standalone) | Unchanged |
| Provisioning | Provisioning module (monolith) | Unchanged |
| Admin display | Support portal (monolith) | Reads from new service via events |

## Integration Points

- **Metering → Billing**: Currently a direct Django import. Target: the
  metering service publishes usage events to a message bus; the ledger
  service subscribes.
- **Billing → Monolith display**: Currently shared DB reads. Target: the
  ledger service publishes domain events; the monolith subscribes for
  display-only updates.
- **Billing → Tax**: REST API call to tax service during invoice
  finalization. Unchanged.
- **Billing → Payment**: Currently tightly coupled via shared ORM models.
  Stays in monolith for now — the ledger marks invoices as "ready for
  collection" and the monolith handles the rest.

## Sequencing Constraints

1. The ledger service must be operational and shadow-writing before any
   reads are migrated.
2. Invoice finalization must work on exactly one system at a time — no
   split-brain where both systems can finalize.
3. The monolith billing tables must remain readable (not writable) for at
   least 3 months after cutover for reconciliation.

## Evidence Available

- Django ORM test suite: 340 passing tests covering invoice creation,
  credit application, and refund workflows. These represent the current
  contract and regression surface. Note: these tests validate the CURRENT
  behavior including the shared-transaction-boundary design that caused
  the March incident — the test suite passes because it tests the broken
  design correctly.
- Production incident postmortems (2 in last 12 months): partial-invoice
  bug (March) and credit-expiration race condition (October).
- Metering service load profile: 12K events/sec peak, stable for 8 months.
- Invoice finalization batch: currently takes 2.5 hours for 2,400 customers.
  Postgres CPU hits 85% during the run.
- Internal platform team reliability: The shared Kafka cluster (used by
  metering) had 3 unplanned outages in the last 6 months (longest: 4
  hours). The platform team's SLA for Kafka is "best effort, no
  contractual guarantee." The metering team's workaround is a local
  file-based buffer that replays on recovery.
