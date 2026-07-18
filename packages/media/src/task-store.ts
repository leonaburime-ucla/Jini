/**
 * `MediaTaskStore` — the async task-tracking port for request-now,
 * poll-later media generation. Generalized from Open Design's
 * `apps/daemon/src/media/tasks.ts`, which is a `better-sqlite3`-coupled,
 * synchronous CRUD module keyed on `projectId` (an OD domain noun) with a
 * hardcoded SQL schema. Per extraction-plan.md §2.6 ("ports are async-only
 * from day one") and the pattern already established by
 * `@jini/daemon`'s `EventLog` (see `packages/daemon/src/event-log.ts`), this
 * is a from-scratch storage-agnostic port + in-memory reference
 * implementation — not a lift — reproducing the same lifecycle semantics
 * (queued → running → done|failed|interrupted, boot-time reconciliation of
 * orphaned in-flight tasks, TTL-based terminal-task pruning) without a SQL
 * schema or an OD project reference. A durable adapter (a future
 * `@jini/sqlite` addition) implements the same interface — see
 * `source-map.md`.
 */

export type MediaTaskStatus = 'queued' | 'running' | 'done' | 'failed' | 'interrupted';

const VALID_STATUSES: ReadonlySet<MediaTaskStatus> = new Set([
  'queued',
  'running',
  'done',
  'failed',
  'interrupted',
]);
const TERMINAL_STATUSES: ReadonlySet<MediaTaskStatus> = new Set(['done', 'failed', 'interrupted']);

export interface MediaTaskError {
  readonly message: string;
  readonly status?: number;
  readonly code?: string;
}

/** One tracked media-generation task. `ownerRef` is an opaque host-supplied scoping key (e.g. a run id) — never an OD `projectId`. */
export interface MediaTask {
  readonly id: string;
  readonly ownerRef: string;
  readonly status: MediaTaskStatus;
  readonly surface?: string;
  readonly model?: string;
  readonly progress: readonly string[];
  readonly file: unknown | null;
  readonly error: MediaTaskError | null;
  readonly startedAt: number;
  readonly endedAt: number | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface MediaTaskCreateInput {
  readonly id: string;
  readonly ownerRef: string;
  readonly status?: MediaTaskStatus;
  readonly surface?: string;
  readonly model?: string;
  readonly progress?: readonly string[];
  readonly file?: unknown | null;
  readonly error?: MediaTaskError | null;
  readonly startedAt?: number;
}

export interface MediaTaskPatch {
  readonly status?: MediaTaskStatus;
  readonly surface?: string | null;
  readonly model?: string | null;
  readonly progress?: readonly string[];
  readonly file?: unknown | null;
  readonly error?: MediaTaskError | null;
  readonly endedAt?: number | null;
}

export interface MediaTaskListOptions {
  /** Include terminal (done/failed/interrupted) tasks. Defaults to `false` (in-flight only). */
  readonly includeTerminal?: boolean;
}

export interface MediaTaskReconcileOptions {
  /** How long a terminal task is retained before `reconcileOnBoot` deletes it. */
  readonly terminalTtlMs: number;
  /** Injectable clock for deterministic tests; defaults to `Date.now()`. */
  readonly now?: number;
}

export interface MediaTaskReconcileResult {
  readonly interrupted: number;
  readonly deleted: number;
}

/**
 * A replayable, ownerRef-scoped store for async media-generation tasks.
 * `@jini/media` ships `createInMemoryMediaTaskStore` as the reference
 * implementation; a durable adapter implements the same interface.
 */
export interface MediaTaskStore {
  create(input: MediaTaskCreateInput): Promise<MediaTask>;
  get(id: string): Promise<MediaTask | null>;
  /** Applies `patch` to an existing task and returns the updated row, or `null` if `id` is unknown. */
  update(id: string, patch: MediaTaskPatch): Promise<MediaTask | null>;
  listByOwner(ownerRef: string, options?: MediaTaskListOptions): Promise<MediaTask[]>;
  delete(id: string): Promise<void>;
  /**
   * Boot-time reconciliation: marks every still-`queued`/`running` task
   * `'interrupted'` (a restart mid-flight has no way to resume it) and
   * deletes terminal tasks older than `terminalTtlMs`. Mirrors the origin's
   * `reconcileMediaTasksOnBoot`.
   */
  reconcileOnBoot(options: MediaTaskReconcileOptions): Promise<MediaTaskReconcileResult>;
}

const INTERRUPTED_ERROR: MediaTaskError = {
  message: 'media task interrupted by daemon restart',
  code: 'DAEMON_RESTART',
};

/** Creates the in-memory reference `MediaTaskStore`. No persistence — state is lost on process exit. */
export function createInMemoryMediaTaskStore(): MediaTaskStore {
  const tasks = new Map<string, MediaTask>();

  return {
    async create(input: MediaTaskCreateInput): Promise<MediaTask> {
      const status = input.status ?? 'queued';
      assertValidStatus(status);
      const now = Date.now();
      const startedAt = input.startedAt ?? now;
      const task: MediaTask = {
        id: input.id,
        ownerRef: input.ownerRef,
        status,
        progress: input.progress ?? [],
        file: input.file ?? null,
        error: input.error ?? null,
        startedAt,
        endedAt: null,
        createdAt: now,
        updatedAt: now,
        ...(input.surface !== undefined ? { surface: input.surface } : {}),
        ...(input.model !== undefined ? { model: input.model } : {}),
      };
      tasks.set(task.id, task);
      return task;
    },

    async get(id: string): Promise<MediaTask | null> {
      return tasks.get(id) ?? null;
    },

    async update(id: string, patch: MediaTaskPatch): Promise<MediaTask | null> {
      const existing = tasks.get(id);
      if (!existing) return null;
      const status = patch.status ?? existing.status;
      assertValidStatus(status);
      const surface = 'surface' in patch ? (patch.surface ?? undefined) : existing.surface;
      const model = 'model' in patch ? (patch.model ?? undefined) : existing.model;
      const next: MediaTask = {
        id: existing.id,
        ownerRef: existing.ownerRef,
        status,
        progress: patch.progress ?? existing.progress,
        file: 'file' in patch ? (patch.file ?? null) : existing.file,
        error: 'error' in patch ? (patch.error ?? null) : existing.error,
        startedAt: existing.startedAt,
        endedAt: 'endedAt' in patch ? (patch.endedAt ?? null) : existing.endedAt,
        createdAt: existing.createdAt,
        updatedAt: Date.now(),
        ...(surface !== undefined ? { surface } : {}),
        ...(model !== undefined ? { model } : {}),
      };
      tasks.set(id, next);
      return next;
    },

    async listByOwner(ownerRef: string, options: MediaTaskListOptions = {}): Promise<MediaTask[]> {
      const includeTerminal = options.includeTerminal === true;
      return [...tasks.values()]
        .filter((t) => t.ownerRef === ownerRef)
        .filter((t) => includeTerminal || !TERMINAL_STATUSES.has(t.status))
        .sort((a, b) => b.startedAt - a.startedAt);
    },

    async delete(id: string): Promise<void> {
      tasks.delete(id);
    },

    async reconcileOnBoot(options: MediaTaskReconcileOptions): Promise<MediaTaskReconcileResult> {
      const now = options.now ?? Date.now();
      const cutoff = now - options.terminalTtlMs;
      let interrupted = 0;
      let deleted = 0;
      for (const task of [...tasks.values()]) {
        if (task.status === 'queued' || task.status === 'running') {
          tasks.set(task.id, {
            ...task,
            status: 'interrupted',
            error: INTERRUPTED_ERROR,
            endedAt: task.endedAt ?? now,
            updatedAt: now,
          });
          interrupted += 1;
          continue;
        }
        if (TERMINAL_STATUSES.has(task.status) && (task.endedAt ?? task.updatedAt) < cutoff) {
          tasks.delete(task.id);
          deleted += 1;
        }
      }
      return { interrupted, deleted };
    },
  };
}

function assertValidStatus(status: MediaTaskStatus): void {
  if (!VALID_STATUSES.has(status)) {
    throw new RangeError(`Invalid media task status: "${status}"`);
  }
}
