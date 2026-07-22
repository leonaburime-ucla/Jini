/**
 * `StorageProvider` — a swappable blob-storage port (file uploads, generated
 * assets). Speculative port-design exploration (see `source-map.md`) — no OD
 * source; the shape is the object-storage capability Zana's `app-chassis`
 * (`packages/storage`) and Tovu-Runner's ports layer both name explicitly.
 *
 * This file defines only the port's stable interface/type surface — safe to
 * import from the normal `@jini/capability-providers` entry point. The
 * in-memory reference implementation (`createInMemoryStorageProvider`) is a
 * non-production stub and lives under `src/unsafe-reference/`, exported only
 * from the separate `@jini/capability-providers/unsafe-reference` entry
 * point — see that directory's `index.ts` header for the full warning.
 */

export interface StorageObjectMeta {
  readonly key: string;
  readonly size: number;
  readonly contentType?: string;
  readonly updatedAt: number;
}

export interface StoragePutOptions {
  readonly contentType?: string;
}

export interface StorageProvider {
  /** Writes `data` at `key`, overwriting any existing object. */
  put(key: string, data: Uint8Array, options?: StoragePutOptions): Promise<StorageObjectMeta>;
  /** Reads the object at `key`, or `null` if it doesn't exist. */
  get(key: string): Promise<Uint8Array | null>;
  /** Deletes the object at `key`. A no-op if it doesn't exist. */
  delete(key: string): Promise<void>;
  /** Lists objects whose key starts with `prefix` (all objects when `prefix` is omitted), sorted by key. */
  list(prefix?: string): Promise<StorageObjectMeta[]>;
}
