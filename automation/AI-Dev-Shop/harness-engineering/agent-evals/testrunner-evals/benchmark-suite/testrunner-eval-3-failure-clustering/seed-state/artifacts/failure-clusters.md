# Failure Clusters

## Spec/TDD Ownership Signal

```text
FAIL tests/audit-contract.unit.test.ts
Expected payload.billingPlan to equal "pro"
Received undefined
```

The active spec version `1.7` removed `billingPlan`. The test appears stale or tied to an older AC.

## Architecture Ownership Signal

```text
FAIL tests/audit-publisher.integration.test.ts
Error: No provider registered for OutboundNotificationPort
```

The failure occurs before business logic executes and points to missing architecture/integration wiring.
