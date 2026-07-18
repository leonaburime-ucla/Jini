/**
 * `DbProvider` — a swappable, minimal document-store port (collection +
 * record id, not a query language). Speculative port-design exploration
 * (see `source-map.md`) — no OD source; the capability
 * `docs/jini-port/recon/r5b-consumers-matrix.md` §3.3 names as the one Zana
 * (Supabase→db+auth+storage+realtime) and Tovu-Runner (ports+sqlite/memory)
 * both built explicitly.
 *
 * `createInMemoryDbProvider` is a minimal reference stub proving the port is
 * implementable. A real adapter (`@jini/sqlite`, Supabase Postgres) implements
 * the same interface — this is deliberately not that adapter (see the scope
 * note in `source-map.md`).
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

function matchesWhere(record: DbRecord, where: Readonly<Record<string, unknown>> | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, value]) => record[key] === value);
}

/** Creates the in-memory reference `DbProvider`. No persistence — state is lost on process exit. */
export function createInMemoryDbProvider(): DbProvider {
  const collections = new Map<string, Map<string, DbRecord>>();

  function collectionFor(name: string): Map<string, DbRecord> {
    let collection = collections.get(name);
    if (!collection) {
      collection = new Map();
      collections.set(name, collection);
    }
    return collection;
  }

  return {
    async insert(collectionName: string, record: DbRecord): Promise<DbRecord> {
      const collection = collectionFor(collectionName);
      if (collection.has(record.id)) {
        throw new Error(`record already exists: ${collectionName}/${record.id}`);
      }
      collection.set(record.id, record);
      return record;
    },

    async get(collectionName: string, id: string): Promise<DbRecord | null> {
      return collections.get(collectionName)?.get(id) ?? null;
    },

    async update(collectionName: string, id: string, patch: Readonly<Record<string, unknown>>): Promise<DbRecord | null> {
      const collection = collections.get(collectionName);
      const existing = collection?.get(id);
      if (!collection || !existing) return null;
      const updated: DbRecord = { ...existing, ...patch, id };
      collection.set(id, updated);
      return updated;
    },

    async delete(collectionName: string, id: string): Promise<void> {
      collections.get(collectionName)?.delete(id);
    },

    async query(collectionName: string, query: DbQuery = {}): Promise<DbRecord[]> {
      const collection = collections.get(collectionName);
      if (!collection) return [];
      return [...collection.values()].filter((record) => matchesWhere(record, query.where));
    },
  };
}
