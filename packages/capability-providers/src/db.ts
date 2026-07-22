/**
 * `DbProvider` — a swappable, minimal document-store port (collection +
 * record id, not a query language). Speculative port-design exploration
 * (see `source-map.md`) — no OD source; the capability
 * `docs/jini-port/recon/r5b-consumers-matrix.md` §3.3 names as the one Zana
 * (Supabase→db+auth+storage+realtime) and Tovu-Runner (ports+sqlite/memory)
 * both built explicitly.
 *
 * This file defines only the port's stable interface/type surface — safe to
 * import from the normal `@jini/capability-providers` entry point. The
 * in-memory reference implementation (`createInMemoryDbProvider`) is a
 * non-production stub and lives under `src/unsafe-reference/`, exported only
 * from the separate `@jini/capability-providers/unsafe-reference` entry
 * point — see that directory's `index.ts` header for the full warning.
 */

export interface DbRecord {
  readonly id: string;
  readonly [field: string]: unknown;
}

export interface DbQuery {
  /** Exact-match filter: every key/value pair must match on a candidate record. Omitted/empty means "all records". */
  readonly where?: Readonly<Record<string, unknown>>;
}

export interface DbProvider {
  /** Inserts a record into `collection`. Rejects if `record.id` already exists in that collection. */
  insert(collection: string, record: DbRecord): Promise<DbRecord>;
  /** Looks up a record by id, or `null` if unknown. */
  get(collection: string, id: string): Promise<DbRecord | null>;
  /** Shallow-merges `patch` into an existing record. Returns `null` if `id` is unknown (no upsert). */
  update(collection: string, id: string, patch: Readonly<Record<string, unknown>>): Promise<DbRecord | null>;
  /** Deletes a record by id. A no-op if it doesn't exist. */
  delete(collection: string, id: string): Promise<void>;
  /** Returns every record in `collection` matching `query.where` (all records when `query` is omitted). */
  query(collection: string, query?: DbQuery): Promise<DbRecord[]>;
}
