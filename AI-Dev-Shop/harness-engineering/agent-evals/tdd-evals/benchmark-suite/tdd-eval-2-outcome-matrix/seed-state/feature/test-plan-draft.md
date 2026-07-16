# Draft Test Plan — Checkout Risk

This draft came from an upstream planning assistant and must be reviewed by TDD before use.

## Draft Outcome Matrix

| Internal Branch | Condition | Expected Result |
|---|---|---|
| `if cart.items.length > 0` | non-empty cart | score risk |
| `if payment.amount === 0` | zero-amount payment | reject payment |
| `if riskScore >= 80` | high risk | hold checkout |

## Draft Coverage Gaps

| Gap | Risk |
|---|---|
| CSV export formatting | High |
| Missing session tests | TBD |
| Expired session tests | TBD |
| Risk banner empty-state copy | TBD |

## Draft Test Type Plan

- Cover deterministic risk scoring through one browser acceptance test.
- Cover zero-amount payment through one acceptance test.
- Cover cart size with one non-empty input example.
- Existing React component test renders the hold banner; no other component tests are planned.

## Explicitly Uncovered Acceptance Criteria

- `REQ-302-02`
- `REQ-302-03`
- `REQ-302-07`
