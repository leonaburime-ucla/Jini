# Data Pipeline Transformer

Build a data pipeline that transforms, validates, and enriches customer records for a CRM sync in Python.

## Requirements

1. Accept an array of raw customer records with: name, email, phone, address, signupDate, plan.
2. Validate each record: name required, email must match pattern, phone must be digits-only after stripping formatting, signupDate must be valid ISO date.
3. Transform: normalize phone to E.164 format, lowercase email, parse signupDate to Date object.
4. Enrich: look up plan details from a plan service (injected) to add planName, monthlyPrice, features.
5. Filter out invalid records and return them separately with error reasons.
6. Return: { valid: EnrichedCustomer[], invalid: { record, errors }[], stats: { total, valid, invalid, enriched } }.
7. Process up to 10,000 records. Use batched enrichment (plan service supports batch lookup).

## Constraints

- Pure Python, no external dependencies except injected plan service
- Must include tests
- Validation and transformation must be pure functions
