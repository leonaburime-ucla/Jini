# Feature Spec — Checkout Risk

## Metadata

- Spec ID: `SPEC-CRISK-302`
- Spec Version: `2.1`
- Spec Hash: `sha256:bb0bd3c8f50b92f1f19a8bf4c4d2a3f0a71292941c057f0fb376cc8e51298d21`
- Human Approved: `true`

## Requirements

`REQ-302-01`: Risk scoring accepts carts with 1 to 50 line items.

`REQ-302-02`: An empty cart must be rejected with `422 EMPTY_CART`.

`REQ-302-03`: A cart with 51 line items must be rejected with `422 TOO_MANY_ITEMS`.

`REQ-302-04`: A zero-amount payment must be held for manual review, not rejected.

`REQ-302-05`: A risk score at or above 80 must hold checkout and show the customer a clear hold message.

`REQ-302-06`: A risk score below 80 must allow checkout to continue.

`REQ-302-07`: A session without a verified user must be rejected before any risk-scoring request is made.

`REQ-302-08`: CSV export formatting is deferred to a later reporting feature and is not part of this TDD scope.

## Invariants

`INV-302-01`: Risk score output must be deterministic for the same cart, user, and device fingerprint.

`INV-302-02`: Manual holds must preserve the original cart total and not mutate the cart.

## Edge Cases

`EC-302-01`: Cart item count boundaries: 0, 1, 50, and 51.

`EC-302-02`: Risk score boundaries: 79, 80, and 81.

`EC-302-03`: Missing session, expired session, and unverified session.
