# Known Flaky Tests

Human-approved exclusions only. Coordinator owns edits to this registry.
Specialist agents may propose entries but must not self-approve flaky
exclusions.

| test_id | feature | flaky_since | failure_pattern | approved_by | approved_at | reason | stabilization_owner | stabilization_ticket | expires_at |
|---|---|---|---|---|---|---|---|---|---|

## Approval Criteria

- `approved_by`, `approved_at`, `reason`, `stabilization_owner`,
  `stabilization_ticket`, and `expires_at` are required.
- `approved_at` must be an ISO-8601 timestamp.
- `expires_at` must be a date or ISO-8601 timestamp in the future.
- Expired, malformed, or ownerless entries do not count as approved exclusions.
