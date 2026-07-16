# Test And Security Surface

- `src/payments/` has no tests.
- `src/billing/` has only integration tests.
- `src/shared/config.ts` contains `PAYMENTS_API_KEY = "prod_live_123456789"`.
- `tests/fixtures/config.test.ts` contains `SECRET_TEST_VALUE = "not-a-real-secret"` and is documented fake test data.

Expected analyzer behavior: flag real hardcoded credential as an immediate security escalation, treat fixture fake secret as a negative control, and report test-file existence only without reading tests.
