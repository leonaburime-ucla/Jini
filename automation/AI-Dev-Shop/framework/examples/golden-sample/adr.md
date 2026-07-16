# ADR: CSV Export for Invoice List

- Feature: FEAT-001
- Spec version: 1.1.0
- Spec hash: sha256:a3f8c2d1e4b7091f56ac83e29d047b5f1c6e82a4d9f3071b2c5e8d4a7f1b6c9
- ADR version: 1.0.0
- ADR hash: sha256:b9e2d4f7a1c8053e67bd94f2a105c8e3d7f2093a5b8e4162c9d7f3b0e2a5c8f
- Software Architect completed: 2026-02-22T02:00:00Z

---

## Constitution Check

Performed before any architectural decision.

| Article | Status | Notes |
|---------|--------|-------|
| I — Library-First | EXCEPTION | papaparse evaluated (see Research below). Rejected: adds 24 KB gzipped for functionality achievable in 12 lines of native code. Exception documented in Complexity Justification. |
| II — Test-First | COMPLIES | TDD Agent certifies before Programmer dispatch. No exceptions possible. |
| III — Simplicity Gate | COMPLIES | Architecture introduces one pure function and one UI event handler. Both traceable to spec requirements. |
| IV — Anti-Abstraction Gate | COMPLIES | CSV formatter is not shared — it is scoped to this feature. No premature abstraction. |
| V — Integration-First Testing | COMPLIES | Primary tests operate at the download trigger boundary, not implementation internals. |
| VI — Security-by-Default | COMPLIES | No server surface added. Security Agent review required before merge. |
| VII — Spec Integrity | COMPLIES | All decisions traceable to spec requirements. |
| VIII — Observability | COMPLIES | Export action emitted via existing analytics event bus per spec Agent Directive. |

---

## Research Summary

**Question:** Should CSV generation use a third-party library (papaparse, csv-stringify) or a native implementation?

| Candidate | Version | License | Maintenance | Size (gzipped) | RFC 4180 Compliant | Decision |
|-----------|---------|---------|-------------|---------------|-------------------|---------|
| papaparse | 5.4.1 | MIT | Active (2024) | 24 KB | Yes | ❌ Rejected |
| csv-stringify | 6.4.0 | MIT | Active (2024) | 18 KB | Yes | ❌ Rejected |
| Native implementation | N/A | N/A | N/A | ~0.3 KB | Yes (12 lines) | ✅ Selected |

**Rejection rationale for papaparse and csv-stringify:** Both libraries provide parsing and generation. This feature requires generation only. The generation logic for RFC 4180 is a well-understood, 12-line pure function. Adding 18–24 KB to the bundle for functionality that is smaller to write than to import is not justified under Article I's "suitable library" criterion — suitability includes size appropriateness.

---

## Architecture Decision

### Approach

Client-side CSV generation triggered by a button click. No server endpoints. No new dependencies.

### Components

**1. `formatCsv(columns, rows)` — pure function**

Accepts:
- `columns: { key: string; label: string }[]` — the visible columns in display order
- `rows: Record<string, unknown>[]` — the visible row data

Returns: a UTF-8 string in RFC 4180 format.

Logic:
- Header row: column labels joined by comma, each escaped if necessary
- Data rows: for each row, extract `columns[i].key` values, escape each field, join with comma
- Escaping rule: if a field value contains `,`, `"`, or `\n`, wrap in double quotes and escape internal `"` as `""`

This function is pure — no I/O, no side effects. Testable in isolation.

**2. `triggerDownload(content, filename)` — utility function**

Creates a `Blob` with `type: 'text/csv;charset=utf-8'`, generates an object URL, programmatically clicks an anchor element, then revokes the URL. Standard browser download pattern with no external dependencies.

**3. Export button** — added to the existing invoice list toolbar

On click:
1. Read `visibleColumns` and `visibleRows` from the invoice list component state
2. Compute filename from today's date (local timezone via `Intl.DateTimeFormat`) and filter state flag
3. Call `formatCsv(visibleColumns, visibleRows)`
4. Call `triggerDownload(csvString, filename)`
5. Emit analytics event `invoice_list.export_csv` with `{ row_count, filter_active }`

### Module Boundaries

```
src/
  features/
    invoice-list/
      components/
        InvoiceList.tsx          (existing — add Export button to toolbar)
      utils/
        formatCsv.ts             (new — pure function, no React dependency)
        triggerDownload.ts       (new — browser I/O only, no React dependency)
```

`formatCsv` and `triggerDownload` are scoped to `invoice-list/utils/`. They are not promoted to shared utilities — there is one consumer (AC-IV compliance).

### Data Flow

```
InvoiceList component state
  → visibleColumns (column config)
  → visibleRows (rendered rows only)
  → formatCsv() → CSV string
  → triggerDownload() → browser download
  → analytics event
```

The export reads from component state at the moment of click. It does not re-fetch from the API (per spec Agent Directive).

---

## Complexity Justification

| Decision | Simpler Alternative Considered | Why Rejected | Article |
|----------|-------------------------------|-------------|---------|
| Native CSV implementation | papaparse or csv-stringify | Libraries add 18–24 KB for generation-only use; native is 12 lines of well-understood logic | Article I exception |

---

## Parallel Delivery Plan

Two independent work streams after ADR approval:

- **Stream A:** `formatCsv.ts` pure function + unit tests (no UI dependency)
- **Stream B:** Export button UI wiring + integration tests (depends on Stream A completing first)

Stream A can begin immediately. Stream B is blocked on Stream A.

---

## Red-Team ADVISORY Notes

**ADV-01 (Pagination limitation):** Architecture does not add a row count indicator in this iteration. The export correctly operates on rendered state. The limitation is documented in the spec (EC-04). No architecture change warranted unless the human decides to address ADV-01 in a follow-on spec.

**ADV-02 (UTF-8 BOM):** Not added. The team's primary CSV consumers (internal reporting tools) are BOM-agnostic. If this changes, a one-line addition to `triggerDownload` is sufficient — no architecture rework needed.
