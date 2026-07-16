# Architecture Pattern Candidates

The following candidates have been identified as potentially viable for the
billing ledger migration. The Architect must evaluate ALL of them in the
Pattern Evaluation table. Candidates may be rejected with justification.

## Candidate A: Event-Sourced Ledger + CQRS Projections

Store all billing state changes as an append-only event log. Derive current
state by replaying events. Separate read models (projections) serve queries.
Use a dedicated event store (EventStoreDB or Postgres with append-only
tables).

## Candidate B: Hexagonal Modular Service (Clean Architecture)

Extract billing into a standalone Python service with hexagonal boundaries.
Domain logic in the core, Postgres as the persistence adapter, REST/event
adapters at the edges. Standard CRUD with audit trail via trigger-based
history tables.

## Candidate C: Microservices (Invoice, Credit, Usage, Audit)

Decompose billing into 4 independently deployable services: Invoice
Service, Credit Service, Usage Aggregation Service, and Audit Service.
Each owns its own database. Communication via async events and
synchronous API calls where consistency is required.

## Candidate D: Modular Monolith Refactor (In-Place)

Keep billing inside the Django monolith but enforce strict module
boundaries. Use Django app isolation, explicit contracts between billing
and other modules, and a shared database with schema-level ownership
markers. No new service deployed.

## Candidate E: Workflow Orchestration (Temporal/Cadence)

Model invoice lifecycle as durable workflows. Use a workflow engine to
coordinate steps (create → calculate → apply credits → finalize →
archive). The workflow engine provides replay, audit, and compensation
natively.
