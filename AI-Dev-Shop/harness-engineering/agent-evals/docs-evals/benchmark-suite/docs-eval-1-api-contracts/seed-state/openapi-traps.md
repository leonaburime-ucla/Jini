# OpenAPI Traps

- Invalid operation IDs: `invoiceExport`, `invoiceExport`, `exportInvoice`.
- Valid operation ID: `create_invoice_export`.
- Invalid schema reference: `$ref: '#/components/schemas/InvoiceExportResponse'` when no such schema is defined.
- OpenAPI must not use undefined `$ref`s.
