/**
 * `StorageProvider` — a swappable blob-storage port (file uploads, generated
 * assets). Speculative port-design exploration (see `source-map.md`) — no OD
 * source; the shape is the object-storage capability Zana's `app-chassis`
 * (`packages/storage`) and Tovu-Runner's ports layer both name explicitly.
 *
 * `createInMemoryStorageProvider` is a minimal reference stub proving the
 * port is implementable. A real adapter (S3, R2, Supabase Storage, local
 * disk) implements the same interface.
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

/** Creates the in-memory reference `StorageProvider`. No persistence — state is lost on process exit. */
export function createInMemoryStorageProvider(): StorageProvider {
  const objects = new Map<string, { data: Uint8Array; meta: StorageObjectMeta }>();

  return {
    async put(key: string, data: Uint8Array, options: StoragePutOptions = {}): Promise<StorageObjectMeta> {
      const meta: StorageObjectMeta = {
        key,
        size: data.byteLength,
        updatedAt: Date.now(),
        ...(options.contentType !== undefined ? { contentType: options.contentType } : {}),
      };
      objects.set(key, { data: data.slice(), meta });
      return meta;
    },

    async get(key: string): Promise<Uint8Array | null> {
      const entry = objects.get(key);
      return entry ? entry.data.slice() : null;
    },

    async delete(key: string): Promise<void> {
      objects.delete(key);
    },

    async list(prefix = ''): Promise<StorageObjectMeta[]> {
      return [...objects.values()]
        .map((entry) => entry.meta)
        .filter((meta) => meta.key.startsWith(prefix))
        .sort((a, b) => a.key.localeCompare(b.key));
    },
  };
}
