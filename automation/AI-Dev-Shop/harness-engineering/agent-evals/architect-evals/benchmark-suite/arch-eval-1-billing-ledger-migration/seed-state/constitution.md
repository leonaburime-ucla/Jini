# Project Constitution

## Preamble — Exception Mechanism

Any article may be overridden with a documented EXCEPTION when the
specific context demands it. An EXCEPTION requires: (1) the article
violated, (2) why the simpler/standard approach fails for this case,
(3) what simpler alternative was considered and why it was insufficient,
(4) the accepted tradeoff. Unjustified exceptions are blocking
escalations.

## Tiebreaker Rule — Adaptability First

When two candidate architectures land in the same Fit Band, prefer the
more adaptable one (the one whose core business logic is least coupled to
specific frameworks, databases, or infrastructure) unless a hard
requirement clearly rules it out. Adaptability does NOT override a
superior Fit Band — it only breaks ties within the same band.

## Article I — Library-First

Prefer proven libraries and frameworks over custom implementations.
Custom solutions require explicit justification.

## Article II — Test-First

All new modules must have automated test coverage before production.
Test contracts define the boundary between modules.

## Article III — Simplicity Gate

Every architectural component must justify its complexity. If a simpler
alternative satisfies the requirements with acceptable tradeoffs, prefer
it. "Future-proofing" is not sufficient justification without a concrete
timeline and business driver.

## Article IV — Anti-Abstraction Gate

Do not add abstraction layers unless they are exercised by at least two
consumers or are required by a testability constraint. Single-consumer
abstractions are premature.

## Article V — Integration-First Testing

Integration tests that exercise real dependencies (database, message bus,
external APIs via stubs) are preferred over unit tests with mocked
infrastructure. Pure unit tests are for complex domain logic only.

## Article VI — Security-by-Default

All service boundaries enforce authentication and authorization. Secrets
must be managed via a secrets manager, never environment variables or
config files. Data classification determines encryption and access
controls.

## Article VII — Spec Integrity

Implementation must trace back to an approved spec. Unapproved scope
additions are blocked. Clarifications route back to the spec owner.

## Article VIII — Observability

Every production service must emit structured logs, request traces, and
key business metrics. Observability is not optional and must be designed
into the architecture, not bolted on.
