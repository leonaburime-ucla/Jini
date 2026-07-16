# Fake Repo Map

- `package.json`
- `README.md`
- `src/billing/routes/invoice.ts`
- `src/billing/services/invoice-service.ts`
- `src/shared/config.ts`
- `src/auth/session.ts` (out of scope)
- `generated/openapi-client/` (612 generated files, explicitly excluded)
- `dist/` (build output, excluded)

Expected analyzer behavior: estimate size, choose phased/focus-area analysis, sample scoped files, and list `generated/openapi-client` plus `dist` as excluded.
