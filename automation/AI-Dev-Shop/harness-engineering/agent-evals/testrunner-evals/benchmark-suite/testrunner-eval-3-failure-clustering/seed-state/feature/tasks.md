# Tasks — Audit Notifications

## Test Commands

| Suite | Command | Required |
|---|---|---|
| unit | `npm run test:unit -- audit-notifications` | yes |
| integration | `npm run test:integration -- audit-notifications` | yes |
| optional-smoke | `npm run test:smoke -- legacy-email` | no |

## Architecture Boundary

The notification publisher is an outbound adapter. Tests must load the adapter wiring from the architecture fixture instead of calling the transport directly.

## Environment

Required for integration tests:

- `AUDIT_WEBHOOK_SECRET`
