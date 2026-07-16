# Known Flaky Tests

Human-approved exclusions only. This registry lets a known non-deterministic
test stop blocking pass-rate math while stabilization work is scheduled. The
test remains in the suite and TestRunner still reports every flaky result to
Coordinator.

| test_id | feature | flaky_since | failure_pattern | approved_by | approved_at | reason | stabilization_owner | stabilization_ticket | expires_at |
|---|---|---|---|---|---|---|---|---|---|
| `payment.e2e.test.ts > retries timeout once` | FEAT-042 | 2026-05-01 | network timing variance | jane@example.com | 2026-05-02T18:00:00Z | External sandbox instability | QA/E2E | PLAT-891 | 2026-08-01 |

## Approval Criteria

- `approved_by`, `approved_at`, `reason`, `stabilization_owner`,
  `stabilization_ticket`, and `expires_at` are required.
- `approved_at` must be an ISO-8601 timestamp.
- `expires_at` must be a date or ISO-8601 timestamp in the future.
- Expired, malformed, or ownerless entries do not count as approved exclusions.
- Coordinator owns edits to this registry. Specialist agents may propose entries
  but must not self-approve flaky exclusions.
