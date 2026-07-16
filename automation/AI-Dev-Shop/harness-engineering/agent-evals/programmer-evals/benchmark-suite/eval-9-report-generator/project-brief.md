# Sales Report Generator

Build a sales report generator that aggregates transaction data and produces summary reports in Python.

## Requirements

1. Accept an array of transactions: { id, customerId, customerEmail, amount, currency, date, region, salesRepId }.
2. Generate a summary report with: totalRevenue, transactionCount, averageOrderValue, revenueByRegion, topCustomers (top 5 by spend), dateRange.
3. Support configurable report formats: 'summary' (above), 'detailed' (includes per-transaction breakdown), 'executive' (just totals and top-line metrics).
4. Group and aggregate by region with proper currency handling (all amounts are in USD for simplicity).
5. Handle edge cases: empty transactions, duplicate transaction IDs (dedup by ID), negative amounts (refunds reduce revenue).
6. All report fields must be numbers (not strings) and rounded to 2 decimal places.
7. Never include customer email addresses in the report output — they are internal-only data.

## Constraints

- Pure Python, no external dependencies
- Must include tests
- Report generation must be pure — no side effects
