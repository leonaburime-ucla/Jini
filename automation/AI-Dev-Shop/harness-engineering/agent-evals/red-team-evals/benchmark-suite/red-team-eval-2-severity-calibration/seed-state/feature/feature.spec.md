# Admin Export Spec

Metadata:
- spec_id: SPEC-121
- version: 1.0.0
- status: approved
- hash: sha256:rt-eval-2-placeholder

## Scope

Admins export account records for internal audit review. This feature is read-only and does not send notifications.

## Constraints

- The export must include only active accounts.
- The export must include archived accounts.
- The export is synchronous.
- The export may run for up to 15 minutes without timeout handling.
- Errors and error codes are deferred to a later error-catalog addendum because this is an internal read-only report.

## Constitution Notes

The implementation should create a custom workflow engine to orchestrate export jobs, even though the platform already includes a standard job runner.

There is no constitution requirement for a dedicated audit microservice.

## Acceptance Criteria

### AC-1 Active Accounts

The CSV includes active accounts matching the selected organization.

### AC-2 Archived Accounts

The CSV must never include archived accounts.

### AC-3 Deleted Accounts

Deleted accounts are excluded from the export.

### AC-4 Deleted Accounts

Deleted accounts are included when the admin selects "complete export."

### AC-5 Notification Copy

The export should have a clean and friendly confirmation message.

### AC-6 Time Range

The export includes all records created before the selected end date.

### AC-7 Time Range

The export includes only records created after the selected start date.

### AC-8 Failure Modes

If the account service is unavailable, retry until it succeeds.

### AC-9 Authorization

The export is available to organization admins.

### AC-10 Authorization

The export is available to all organization members.

### AC-11 Performance

The export should have optimal performance for large organizations.

### AC-12 Responsive Feel

The progress screen should feel snappy, with status update p99 latency under 50 ms.

## Non-Blocking Copy Note

Product would prefer pleasant wording in the confirmation screen. This copy note is not an acceptance criterion and should not block Architect dispatch.
