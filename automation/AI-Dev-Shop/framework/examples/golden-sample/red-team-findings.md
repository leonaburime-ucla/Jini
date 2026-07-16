# Red-Team Findings: FEAT-001 CSV Export for Invoice List

- Spec version: 1.1.0
- Spec hash: sha256:a3f8c2d1e4b7091f56ac83e29d047b5f1c6e82a4d9f3071b2c5e8d4a7f1b6c9
- Red-Team completed: 2026-02-22T01:00:00Z
- Finding count: 0 BLOCKING · 2 ADVISORY · 0 CONSTITUTION_FLAG

---

## BLOCKING Findings

None.

---

## ADVISORY Findings

**ADV-01 — EC-04 Pagination Limitation Needs User-Visible Signal**

The spec documents the pagination limitation in EC-04 but does not require any user-visible indication that the export may be incomplete. A user with 10,000 invoices and lazy pagination will receive a CSV with 100 rows and no explanation.

Recommendation: Add a REQ or AC requiring the UI to show row count exported vs. total matching (e.g., "Exported 100 of 2,340 matching invoices"). This prevents support tickets and data integrity issues downstream.

Disposition: ADVISORY — the spec's current behavior is internally consistent. The human should decide whether to address this in this spec or defer to a follow-on.

---

**ADV-02 — No Explicit Encoding Declaration in CSV**

RFC 4180 does not mandate a BOM or charset declaration. INV-01 guarantees UTF-8 output, but some older Excel versions on Windows misinterpret UTF-8 CSV without a BOM, displaying garbled characters for non-ASCII content (e.g., customer names with accents).

Recommendation: Consider adding a UTF-8 BOM (`\uFEFF`) at the start of the exported file. This is a one-line change but affects the spec's invariant and should be an explicit decision.

Disposition: ADVISORY — no spec change required unless the team uses Windows Excel as a primary consumer of exports.

---

## CONSTITUTION_FLAG Findings

None.

---

## Routing Decision

0 BLOCKING findings. Spec is cleared for Software Architect dispatch.

ADVISORY findings ADV-01 and ADV-02 are included in Software Architect context for awareness. Neither requires spec revision before ADR.
