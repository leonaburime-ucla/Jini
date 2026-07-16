# ADR — Admin Ops Contracts

- ADR ID: `ADR-303`
- Status: Accepted

## Decision

Use a small admin API module, a dashboard React component, and an audit event publisher.

## API/Event Contract Summary

- API: `POST /admin/audit-exports`
- Event: `admin.audit_export.requested`
- Required fields: `adminId`, `startDate`, `endDate`, `requestId`
- Contract testing approach: consumer-driven contract tests with a shared fixture.
- Contract testing note: schema validation can also prove request shape.

The selected approach is consumer-driven contract testing. Schema validation is mentioned as a fallback only if the consumer fixture cannot be loaded.

## Snapshot Contract Decision

The dashboard accessibility snapshot is intentionally retained as a contract test because the admin support team depends on stable accessible role/name output in runbooks.
