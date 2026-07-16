# Feature Spec — Invoice Export

## Metadata

- Spec ID: `SPEC-INV-402`
- Spec Version: `2.0`
- Spec Hash: `sha256:402aaa8a06c3f4f7b8c7d23e59e392e6a5e2af8410a5d21201b4b4f44abf4020`
- Human Approved: `true`

## Requirements

`REQ-402-01`: Export invoices as CSV for a merchant-selected date range.

`REQ-402-02`: Reject unauthenticated export requests.

`REQ-402-03`: Emit an audit event for every export.

`REQ-402-04`: Preserve invoice totals exactly in cents.
