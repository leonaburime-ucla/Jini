# Payment Gateway Adapter

Build a payment gateway adapter in Python that wraps an external payment SDK.

## Requirements

1. Wrap the external `PaymentSDK` interface with a clean internal adapter.
2. Support: chargeCard(amount, currency, cardToken), refund(transactionId, amount), getTransaction(transactionId).
3. Map all SDK errors to typed internal errors with stable codes: INVALID_CARD, INSUFFICIENT_FUNDS, NETWORK_ERROR, TIMEOUT, UNKNOWN.
4. Add timeout protection: if the SDK call takes longer than 5 seconds, abort and return TIMEOUT error.
5. Log every external call with: operation, duration, success/failure, transaction ID (if available). Never log card tokens or full card numbers.
6. Return typed result objects with discriminated union: { status: 'success', data } | { status: 'error', code, message }.

## Constraints

- Pure Python
- Must include tests
- SDK interface is provided — do not modify it
