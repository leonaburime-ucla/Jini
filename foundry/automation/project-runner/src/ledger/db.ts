import { createRequire } from 'node:module';
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';
import { LEDGER_SCHEMA_SQL } from './schema.js';

// Loaded via `require` rather than a static `import { DatabaseSync } from
// 'node:sqlite'`: `node:sqlite` is a real Node ~22.5+ built-in, but it is
// absent from `node:module`'s `builtinModules` list — some `node:`-prefixed
// modules are intentionally resolvable only via the prefixed specifier and
// never registered there. Vite/Vitest's builtin-module detection (used to
// transform test files) relies on that list, so a static import mis-resolves
// `node:sqlite` as a missing bare npm package named `sqlite`. `require`,
// resolved directly by Node at runtime, is never subject to that analysis.
const nodeRequire = createRequire(import.meta.url);
const { DatabaseSync } = nodeRequire('node:sqlite') as { DatabaseSync: typeof DatabaseSyncType };

/**
 * Opens (creating if necessary) the project-runner SQLite ledger and applies
 * the current schema.
 *
 * Uses Node's built-in `node:sqlite` (stable in Node ~24, this repo's pinned
 * engine) instead of an external native dependency — consistent with the
 * bootstrap mandate to keep project-runner minimal (extraction-plan.md §12
 * C6: "local SQLite runner ... do NOT block extraction on a distributed
 * scheduler").
 *
 * @param input.path - Filesystem path to the ledger database file, or
 *   `:memory:` for an ephemeral in-process database (used by tests).
 * @returns An open `DatabaseSync` handle with the ledger schema applied.
 * @throws {Error} Propagates any underlying `node:sqlite` error (e.g. an
 *   unwritable path) unchanged — this is an infrastructure boundary, not a
 *   domain error, so it is not wrapped in a typed project-runner error.
 * @example
 * const db = openLedgerDb({ path: ':memory:' });
 */
export function openLedgerDb({ path }: { path: string }): DatabaseSyncType {
  const db: DatabaseSyncType = new DatabaseSync(path);
  db.exec(LEDGER_SCHEMA_SQL);
  return db;
}
