# Feature Spec — Admin Ops

## Metadata

- Spec ID: `SPEC-AOPS-303`
- Spec Version: `3.0`
- Spec Hash: `sha256:0fa949bb947a4a727d0b6057d8320d77fed02e4f115d8309ecf9406efccb8912`
- Human Approved: `true`

## Requirements

`REQ-303-01`: Admins can view an operational dashboard showing pending review count, failed export count, and last audit event time.

`REQ-303-02`: Admin dashboard must show loading, empty, error, and populated states.

`REQ-303-03`: Admins can request an audit export for a bounded date range.

`REQ-303-04`: Date ranges must satisfy `start <= end` and may span at most 31 days.

`REQ-303-05`: Audit export request must publish `admin.audit_export.requested`.

`REQ-303-06`: The export API must reject unauthenticated users with `401`.

## Invariants

`INV-303-01`: Audit export date ranges must never exceed 31 days.

`INV-303-02`: Audit export events must contain `adminId`, `startDate`, `endDate`, and `requestId`.

## Edge Cases

`EC-303-01`: Date range boundaries: same day, 31 days, 32 days, reversed dates.

`EC-303-02`: Dashboard state variants: loading, empty, error, populated.
