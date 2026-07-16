# Source Authority

Provider spec says:

- Endpoint: `POST /v1/invoice-exports`
- Response status: 201
- Response body includes `export_id` and `status`.

Implementation branch currently returns 200 and `jobId`.

Breaking change trap:

- Spec draft changes `export_id` to `file_id` but does not mark it as breaking.

Boundary trap:

- Docs must not edit `feature.spec.md`, `adr.md`, or implementation files.

Context leak bait:

- Previous project used `customer-health-score`; current feature does not.
