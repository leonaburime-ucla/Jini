# Spec: CSV Export for Invoice List

- Spec ID: SPEC-001
- Feature: FEAT-001
- Version: 1.1.0
- Last Edited: 2026-02-22T00:00:00Z
- Content Hash: sha256:a3f8c2d1e4b7091f56ac83e29d047b5f1c6e82a4d9f3071b2c5e8d4a7f1b6c9
- Owner: human

## Problem

Finance team users need to extract invoice data for external reporting and reconciliation. The current invoice list has no export capability, requiring manual copy-paste that introduces errors and takes significant time for large datasets.

## Scope

**In scope:**
- Export button on the invoice list page
- Export of all currently visible rows (respecting active filters and sort order)
- CSV format with headers matching displayed column labels
- Filename that encodes the export date and filter state
- Client-side CSV generation (no new server endpoints)

**Out of scope:**
- PDF or Excel export formats
- Scheduled or automated exports
- Export of invoice line items (only the invoice summary row)
- Exporting more rows than currently visible (no pagination bypass)
- Email delivery of exports

## Requirements

- REQ-01: The user can trigger a CSV download of all currently visible invoice rows from the invoice list page.
- REQ-02: The exported CSV file is named to reflect the export date and whether filters are active.
- REQ-03: The CSV column headers match the column labels currently displayed in the invoice list, in display order.
- REQ-04: Field values containing commas, double quotes, or newlines are correctly escaped per RFC 4180.
- REQ-05: Exporting an empty invoice list (zero rows after filtering) produces a valid CSV with headers only and no data rows.

## Acceptance Criteria

Priority: **P1** = must-have, **P2** = should-have, **P3** = nice-to-have.

- AC-01 (REQ-01) [P1]: Given an invoice list with 1 or more visible rows, when the user clicks the "Export CSV" button, then a file download begins within 2 seconds and the downloaded file contains exactly the visible rows.
- AC-02 (REQ-01) [P1]: Given the user has applied a date filter showing 10 of 50 invoices, when they export, then the CSV contains exactly 10 data rows.
- AC-03 (REQ-02) [P1]: Given no filters are active, when the user exports, the filename is `invoices-YYYY-MM-DD-all.csv` where the date is today's date in the user's local timezone.
- AC-04 (REQ-02) [P2]: Given one or more filters are active, when the user exports, the filename is `invoices-YYYY-MM-DD-filtered.csv`.
- AC-05 (REQ-03) [P1]: The CSV header row contains the column labels in the same left-to-right order as displayed in the invoice list.
- AC-06 (REQ-04) [P1]: Given an invoice with a customer name containing a comma (e.g., `Acme, Inc.`), when exported, the field is wrapped in double quotes in the CSV: `"Acme, Inc."`.
- AC-07 (REQ-04) [P1]: Given an invoice with a notes field containing a double quote character, when exported, the double quote is escaped as two double quotes per RFC 4180: `""`.
- AC-08 (REQ-05) [P1]: Given all invoices are filtered out (zero visible rows), when the user clicks "Export CSV", then a CSV file is downloaded containing only the header row and no data rows.

## Invariants

- INV-01: The exported CSV is valid UTF-8 regardless of the character content of any field.
- INV-02: The row count in the exported CSV (excluding the header) equals the number of rows visible in the UI at the time of export.
- INV-03: The export does not modify any application state — it is a pure read operation.

## Edge Cases

- EC-01: What happens when a field value contains a newline? The value must be wrapped in double quotes; the newline is preserved inside the quotes per RFC 4180.
- EC-02: What happens when a column header itself contains a comma? Wrap it in double quotes in the header row.
- EC-03: What happens when the user exports while a background data refresh is in progress? Export operates on the currently rendered DOM/data snapshot, not the in-flight request. No waiting, no partial data.
- EC-04: What happens when the invoice list has 10,000+ rows? Export is client-side and synchronous — it operates on whatever rows are currently rendered. If pagination loads rows lazily, only loaded rows export. Document this limitation.

## Dependencies

- Invoice list component (existing) — provides the visible row data and column configuration
- Browser native `Blob` and `URL.createObjectURL` APIs — for triggering the download without a server round-trip
- Date formatting — existing project date utility or native `Intl.DateTimeFormat`

## Open Questions

None. All questions resolved before Software Architect dispatch.

## Constitution Compliance

| Article | Status | Notes |
|---------|--------|-------|
| I — Library-First | EXCEPTION | See ADR: papaparse evaluated and rejected for client-side CSV; native implementation is 12 lines |
| II — Test-First | COMPLIES | TDD Agent certifies tests before Programmer dispatch |
| III — Simplicity Gate | COMPLIES | No abstractions beyond what the spec requires |
| IV — Anti-Abstraction Gate | COMPLIES | CSV formatter is a single function, not a shared abstraction |
| V — Integration-First Testing | COMPLIES | AC-01, AC-02, AC-06 tested at integration boundary (rendered list → downloaded file) |
| VI — Security-by-Default | COMPLIES | No new server surface; Security Agent reviews before ship |
| VII — Spec Integrity | COMPLIES | Hash present; all agents reference this version |
| VIII — Observability | COMPLIES | Export action logged via existing analytics event bus |

## Agent Directives

✅ Always:
- Verify INV-02 (row count matches visible count) in test setup — this is the most likely regression vector
- Use the existing date utility for date formatting; do not introduce a new dependency for this

⚠️ Ask before:
- Adding any server-side endpoint — the spec explicitly requires client-side generation

🚫 Never:
- Read invoice data directly from the API during export — operate on already-rendered state only
- Modify the invoice list component's data fetching or filtering logic
