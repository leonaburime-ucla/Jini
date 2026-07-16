# Architecture Sample

- `src/server.ts` starts the HTTP API.
- `src/worker.ts` starts a queue worker.
- `src/routes/invoice.ts` calculates totals and tax directly inside an Express handler.
- `src/domain/invoice.ts` imports `../infra/db`.
- `src/a.ts -> src/b.ts -> src/c.ts -> src/d.ts -> src/a.ts` forms a circular dependency across four modules.
- `src/components/BillingPanel.tsx` calls `supabase.from('invoices')` directly.
