# Mock Contract Log

Implementation output from `src/auditPublisher.ts`:

```json
{"adminId":"admin-1","merchantId":"m-1","settingName":"billing","changedAt":"2026-05-10T12:00:00.000Z"}
```

Test mock expectation:

```json
{"admin_id":"admin-1","merchant_id":"m-1","setting":"billing","changed_at":"2026-05-10T12:00:00.000Z"}
```

The ADR and active spec use camelCase. The mock contract is stale and should route to TDD.
