# Isolation Rerun Log

## Normal Order

```text
PASS tests/audit-notification.unit.test.ts
PASS tests/audit-webhook.integration.test.ts
```

## Isolated Reverse Order

```text
FAIL tests/audit-webhook.integration.test.ts
Expected webhookSecret to equal "test-secret"
Received undefined
```

The suite passes only when a previous test leaks `process.env.AUDIT_WEBHOOK_SECRET`.
