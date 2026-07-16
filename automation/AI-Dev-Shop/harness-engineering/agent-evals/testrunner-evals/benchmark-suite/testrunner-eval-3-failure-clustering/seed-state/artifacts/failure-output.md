# Failure Output

Exact failure output from the unit suite:

```text
FAIL tests/audit-notification.unit.test.ts
  Audit notification payload
    expected payload.changedAt to equal "2026-05-10T12:00:00.000Z"
    received "2026-05-10T12:00:01.000Z"

AssertionError: expected '2026-05-10T12:00:01.000Z' to be '2026-05-10T12:00:00.000Z'
```

The report must include this exact assertion output or a retained offload path.
