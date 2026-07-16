# Eval 3 — Programmer Documents Public Interface

## Scenario
You are the Programmer. You just created a new exported function `processPayment(amount: number, currency: string, merchantId: string): Promise<PaymentResult>` that calls an external payment gateway, can throw on timeout, and has retry logic.

## Context
- New public export in src/payments/processor.ts
- Calls external Stripe API
- Has 3-retry with exponential backoff
- Throws PaymentTimeoutError after 30s
- Side effect: writes to payments table

## What To Check
- Does the Programmer add docs covering: purpose, parameters, return type, errors thrown?
- Does it document the retry behavior (non-obvious)?
- Does it document the side effect (DB write)?
- Does it document the timeout constraint?
- Does the handoff classify this as "documented"?
