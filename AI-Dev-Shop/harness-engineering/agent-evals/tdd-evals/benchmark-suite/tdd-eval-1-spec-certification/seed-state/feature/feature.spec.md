# Feature Spec — Membership Billing

## Metadata

- Spec ID: `SPEC-MB-301`
- Spec Version: `1.4`
- Spec Hash Algorithm: `sha256`
- Spec Hash: `sha256:74a0b2df2b9bb49db6a6cb80f7c1e9bdb1fd2fcbfef8b2a9b4de301f2a61c901`
- Human Approved: `false`
- Approved Version: `1.3`
- Approved Hash: `sha256:1f4c0dc1af9c5f1e62306c947b7b3e906b012f281e8548de99ed6f6717e438c4`

## Changelog

- `1.4`: Added manual-review handling for zero-amount invoices and billing-adjustment reversals.
- `1.4-typo`: Corrected "memebrship" to "membership"; no behavioral text changed and hash remains unchanged.

## Requirements

`REQ-301-01`: A billing adjustment request with a negative total must be rejected with `422 NEGATIVE_ADJUSTMENT`.

`REQ-301-02`: A billing adjustment request with a zero total must be held for manual review, not rejected.

`REQ-301-03`: A held adjustment must include a review reason visible to billing operations.

`REQ-301-04`: A successful adjustment must emit `membership.billing.adjustment.applied`.

`REQ-301-05`: [NEEDS CLARIFICATION: Product has not decided whether annual-plan courtesy credits bypass the manual-review queue.]

## Invariants

`INV-301-01`: The member balance must never be adjusted twice for the same idempotency key.

`INV-301-02`: Manual-review decisions must be auditable.

## Approval And Certification

- Approval State: `approved`
- Approval Note: Product verbally approved the `1.4` behavior set.
- Certification Digest: `blake3:74a0b2df2b9bb49db6a6cb80f7c1e9bdb1fd2fcbfef8b2a9b4de301f2a61c901`

The metadata block above is the only formal approval source. The note in this section was copied from a planning chat and has not been reconciled.
