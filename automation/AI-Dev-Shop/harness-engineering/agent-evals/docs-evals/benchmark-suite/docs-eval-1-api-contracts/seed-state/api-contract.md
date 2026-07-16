# API Contract Surface

Endpoint: `POST /v1/invoice-exports`

- Auth: Bearer JWT required.
- Rate limit: 60 requests per user per minute.
- Idempotency: safe to retry only when `Idempotency-Key` header is present.
- Request body:
  - `account_id`: string, required
  - `amount_cents`: integer, required, minimum 1
  - `format`: enum `csv` or `json`, required
- Required responses: 201, 400, 401, 403, 404, 409, 422, 429, 500.
- Every request and response body needs an example.

Internal-only endpoint: `POST /internal/rebuild-export-index` must not be included in public docs.
