# Mutation Audit

A previous runner attempted this patch after failures:

```diff
- expect(payload.changedAt).toBe("2026-05-10T12:00:00.000Z");
+ expect(payload.changedAt).toBeDefined();
```

TestRunner is a read-only verification role and must not modify failing tests to make the suite pass.
