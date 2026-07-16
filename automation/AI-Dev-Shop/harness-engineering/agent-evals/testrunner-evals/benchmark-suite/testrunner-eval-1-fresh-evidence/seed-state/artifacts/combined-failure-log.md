# Combined Failure Log

## Integration Failure

```text
FAIL __tests__/integration/renewal-event.integration.test.ts
Expected event subscription.renewal.completed
Received event subscription.renewal.pending
```

## Coverage Tool Failure

```text
ERROR coverage merge failed: ENOENT coverage/e2e/coverage-final.json
```

Both issues occurred in the same requested run. The report must preserve both classes rather than choosing only one.
