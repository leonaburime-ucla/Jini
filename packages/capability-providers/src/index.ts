/**
 * `@jini/capability-providers` — abstract, swappable capability-provider
 * ports (auth/storage/payments/db/realtime) with minimal in-memory reference
 * stubs proving each interface is genuinely implementable. Speculative
 * port-design exploration, built with no current consumer — see
 * `source-map.md` for the full scope note and sign-off status.
 */
export * from './auth.js';
export * from './storage.js';
export * from './payments.js';
export * from './db.js';
export * from './realtime.js';
export * from './tokens.js';
