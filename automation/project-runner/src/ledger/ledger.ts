import type { DatabaseSync } from 'node:sqlite';
import type {
  JobAttempt,
  JobAttemptOutcome,
  Lease,
  WorkItem,
  WorkItemState,
} from '../domain/types.js';
import { TERMINAL_WORK_ITEM_STATES } from '../domain/types.js';
import {
  InvalidWorkItemTransitionError,
  LeaseNotHeldError,
  WorkItemNotFoundError,
} from '../errors.js';

/** Injectable clock, per coding-foundations rule 1 (no hidden globals for time). */
type NowFn = () => Date;
const DEFAULT_NOW: NowFn = () => new Date();

/** Upper bound on candidates scanned per {@link ProjectRunnerLedger.leaseNextWorkItem} call. */
const MAX_LEASE_SCAN_CANDIDATES = 500;

/** Raw SQLite row shape for `work_items`, before mapping to the domain {@link WorkItem}. */
interface WorkItemRow {
  id: string;
  dag_id: string;
  plan_hash: string;
  milestone: number;
  task_type: string;
  title: string;
  depends_on: string;
  requires_approval: number;
  state: string;
  retry_count: number;
  max_retries: number;
  approved_at: string | null;
  approved_by: string | null;
  next_attempt_earliest_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapWorkItemRow(row: WorkItemRow): WorkItem {
  return {
    id: row.id,
    dagId: row.dag_id,
    planHash: row.plan_hash,
    milestone: row.milestone,
    taskType: row.task_type as WorkItem['taskType'],
    title: row.title,
    dependsOn: JSON.parse(row.depends_on) as string[],
    requiresApproval: row.requires_approval === 1,
    state: row.state as WorkItemState,
    retryCount: row.retry_count,
    maxRetries: row.max_retries,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    nextAttemptEarliestAt: row.next_attempt_earliest_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface JobAttemptRow {
  id: string;
  work_item_id: string;
  lease_id: string;
  worker_id: string;
  attempt_number: number;
  sandbox_path: string;
  started_at: string;
  ended_at: string | null;
  outcome: string | null;
  summary: string | null;
  error: string | null;
}

function mapJobAttemptRow(row: JobAttemptRow): JobAttempt {
  return {
    id: row.id,
    workItemId: row.work_item_id,
    leaseId: row.lease_id,
    workerId: row.worker_id,
    attemptNumber: row.attempt_number,
    sandboxPath: row.sandbox_path,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    outcome: row.outcome as JobAttemptOutcome | null,
    summary: row.summary,
    error: row.error,
  };
}

interface LeaseRow {
  id: string;
  work_item_id: string;
  worker_id: string;
  acquired_at: string;
  expires_at: string;
  released_at: string | null;
}

function mapLeaseRow(row: LeaseRow): Lease {
  return {
    id: row.id,
    workItemId: row.work_item_id,
    workerId: row.worker_id,
    acquiredAt: row.acquired_at,
    expiresAt: row.expires_at,
    releasedAt: row.released_at,
  };
}

/**
 * The project-runner ledger: owns the executable truth for the WorkItem state
 * machine (extraction-plan.md §12 C6). All state transitions happen through
 * this class so the audit trail (`state_transitions`) is complete.
 *
 * This is a single-process, single-connection wrapper — `node:sqlite`'s
 * `DatabaseSync` runs statements synchronously on the JS main thread, so
 * reads-then-writes within one method cannot interleave with another call
 * from the same process. Multi-process concurrent workers are explicitly out
 * of scope for this bootstrap (README: "one worker").
 */
export class ProjectRunnerLedger {
  private readonly db: DatabaseSync;

  constructor({ db }: { db: DatabaseSync }) {
    this.db = db;
  }

  /**
   * Records (or re-affirms) which plan hash a DAG was generated from. Used by
   * drift detection to warn when `docs/jini-port/extraction-plan.md` §8
   * changes after a DAG has already been seeded.
   *
   * @throws Nothing — safe to call repeatedly with the same values.
   */
  recordDagMeta(
    { dagId, planHash }: { dagId: string; planHash: string },
    { now = DEFAULT_NOW }: { now?: NowFn } = {},
  ): void {
    this.db
      .prepare('INSERT OR IGNORE INTO dag_meta (dag_id, plan_hash, created_at) VALUES (?, ?, ?)')
      .run(dagId, planHash, now().toISOString());
  }

  /** Returns the plan hash a DAG was seeded from, or `null` if the DAG is unknown. */
  getDagPlanHash({ dagId }: { dagId: string }): string | null {
    const row = this.db
      .prepare('SELECT plan_hash FROM dag_meta WHERE dag_id = ?')
      .get(dagId) as { plan_hash: string } | undefined;
    return row?.plan_hash ?? null;
  }

  /**
   * Idempotently inserts WorkItems (existing ids are left untouched) — safe to
   * re-run `seed` after work has already progressed.
   *
   * @returns Count of rows actually inserted vs. already present.
   */
  seedWorkItems({ items }: { items: readonly WorkItem[] }): {
    insertedCount: number;
    skippedCount: number;
  } {
    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO work_items (
        id, dag_id, plan_hash, milestone, task_type, title, depends_on,
        requires_approval, state, retry_count, max_retries,
        approved_at, approved_by, next_attempt_earliest_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    let insertedCount = 0;
    for (const item of items) {
      const result = insert.run(
        item.id,
        item.dagId,
        item.planHash,
        item.milestone,
        item.taskType,
        item.title,
        JSON.stringify(item.dependsOn),
        item.requiresApproval ? 1 : 0,
        item.state,
        item.retryCount,
        item.maxRetries,
        item.approvedAt,
        item.approvedBy,
        item.nextAttemptEarliestAt,
        item.createdAt,
        item.updatedAt,
      );
      if (result.changes > 0) insertedCount += 1;
    }
    return { insertedCount, skippedCount: items.length - insertedCount };
  }

  /** @throws {WorkItemNotFoundError} If no WorkItem with this id exists. */
  getWorkItem({ id }: { id: string }): WorkItem {
    const row = this.db.prepare('SELECT * FROM work_items WHERE id = ?').get(id) as unknown as WorkItemRow | undefined;
    if (!row) throw new WorkItemNotFoundError(id);
    return mapWorkItemRow(row);
  }

  /** Lists WorkItems, optionally filtered by DAG and/or state. Ordered by creation order. */
  listWorkItems({ dagId, state }: { dagId?: string; state?: WorkItemState } = {}): WorkItem[] {
    const clauses: string[] = [];
    const params: string[] = [];
    if (dagId !== undefined) {
      clauses.push('dag_id = ?');
      params.push(dagId);
    }
    if (state !== undefined) {
      clauses.push('state = ?');
      params.push(state);
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.db
      .prepare(`SELECT * FROM work_items ${where} ORDER BY created_at ASC`)
      .all(...params) as unknown as WorkItemRow[];
    return rows.map(mapWorkItemRow);
  }

  /**
   * True only if every id in `dependsOn` currently has state `succeeded`.
   * An empty `dependsOn` list is trivially satisfied.
   */
  private areDependenciesSatisfied({ dependsOn }: { dependsOn: readonly string[] }): boolean {
    if (dependsOn.length === 0) return true;
    const placeholders = dependsOn.map(() => '?').join(', ');
    const row = this.db
      .prepare(
        `SELECT COUNT(*) as unmet FROM work_items WHERE id IN (${placeholders}) AND state != 'succeeded'`,
      )
      .get(...dependsOn) as { unmet: number };
    return row.unmet === 0;
  }

  /** Writes the state and an audit row. Caller is responsible for validating the transition. */
  private applyTransition(
    { id, toState, reason }: { id: string; toState: WorkItemState; reason: string },
    { now = DEFAULT_NOW }: { now?: NowFn } = {},
  ): void {
    const current = this.getWorkItem({ id });
    const nowIso = now().toISOString();
    this.db
      .prepare('UPDATE work_items SET state = ?, updated_at = ? WHERE id = ?')
      .run(toState, nowIso, id);
    this.db
      .prepare(
        'INSERT INTO state_transitions (work_item_id, from_state, to_state, reason, at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(id, current.state, toState, reason, nowIso);
  }

  /**
   * Moves any `queued` WorkItem that requires approval and has all
   * dependencies satisfied into `waiting_for_human`, so approval-gated work
   * never sits invisibly in `queued` waiting to be noticed.
   *
   * @returns Ids promoted in this call.
   */
  promoteReadyApprovalGates(): { promotedIds: string[] } {
    const candidates = this.listWorkItems({ state: 'queued' }).filter(
      (item) => item.requiresApproval && item.approvedAt === null,
    );
    const promotedIds: string[] = [];
    for (const item of candidates) {
      if (!this.areDependenciesSatisfied({ dependsOn: item.dependsOn })) continue;
      this.applyTransition({
        id: item.id,
        toState: 'waiting_for_human',
        reason: 'dependencies satisfied; requires manual approval before proceeding',
      });
      promotedIds.push(item.id);
    }
    return { promotedIds };
  }

  /**
   * Grants approval for a WorkItem parked at `waiting_for_human` and returns
   * it to `queued` so a worker can lease it. This is the only path back from
   * `waiting_for_human` — approval is never automatic.
   *
   * @throws {InvalidWorkItemTransitionError} If the item is not currently `waiting_for_human`.
   */
  approveWorkItem(
    { id, approvedBy }: { id: string; approvedBy: string },
    { now = DEFAULT_NOW }: { now?: NowFn } = {},
  ): WorkItem {
    const item = this.getWorkItem({ id });
    if (item.state !== 'waiting_for_human') {
      throw new InvalidWorkItemTransitionError(id, item.state, 'approve');
    }
    const nowIso = now().toISOString();
    this.db
      .prepare('UPDATE work_items SET approved_at = ?, approved_by = ? WHERE id = ?')
      .run(nowIso, approvedBy, id);
    this.applyTransition({ id, toState: 'queued', reason: `approved by ${approvedBy}` });
    return this.getWorkItem({ id });
  }

  /**
   * Claims the oldest eligible `queued` WorkItem for a worker: dependencies
   * satisfied, and — if it requires approval — already approved. Scans at
   * most {@link MAX_LEASE_SCAN_CANDIDATES} queued items to bound the cost of
   * a pathologically large backlog.
   *
   * @returns The claimed WorkItem and its new Lease, or `null` if nothing is eligible.
   */
  leaseNextWorkItem(
    { workerId }: { workerId: string },
    { leaseDurationMs = 5 * 60_000, now = DEFAULT_NOW }: { leaseDurationMs?: number; now?: NowFn } = {},
  ): { workItem: WorkItem; lease: Lease } | null {
    const rows = this.db
      .prepare('SELECT * FROM work_items WHERE state = ? ORDER BY created_at ASC LIMIT ?')
      .all('queued', MAX_LEASE_SCAN_CANDIDATES) as unknown as WorkItemRow[];

    for (const row of rows.map(mapWorkItemRow)) {
      if (row.requiresApproval && row.approvedAt === null) continue;
      if (!this.areDependenciesSatisfied({ dependsOn: row.dependsOn })) continue;

      const nowDate = now();
      const leaseId = `lease-${row.id}-${nowDate.getTime()}`;
      this.db
        .prepare(
          'INSERT INTO leases (id, work_item_id, worker_id, acquired_at, expires_at, released_at) VALUES (?, ?, ?, ?, ?, NULL)',
        )
        .run(
          leaseId,
          row.id,
          workerId,
          nowDate.toISOString(),
          new Date(nowDate.getTime() + leaseDurationMs).toISOString(),
        );
      this.applyTransition(
        { id: row.id, toState: 'leased', reason: `leased by ${workerId}` },
        { now },
      );

      const lease = this.db.prepare('SELECT * FROM leases WHERE id = ?').get(leaseId) as unknown as LeaseRow;
      return { workItem: this.getWorkItem({ id: row.id }), lease: mapLeaseRow(lease) };
    }
    return null;
  }

  /**
   * Starts an execution attempt for a WorkItem the caller already holds a
   * lease on: creates the attempt record and moves the item to `running`.
   *
   * @throws {InvalidWorkItemTransitionError} If the item is not `leased`.
   */
  startAttempt(
    { workItemId, leaseId, workerId, sandboxPath }: {
      workItemId: string;
      leaseId: string;
      workerId: string;
      sandboxPath: string;
    },
    { now = DEFAULT_NOW }: { now?: NowFn } = {},
  ): JobAttempt {
    const item = this.getWorkItem({ id: workItemId });
    if (item.state !== 'leased') {
      throw new InvalidWorkItemTransitionError(workItemId, item.state, 'start attempt for');
    }
    const activeLease = this.db
      .prepare('SELECT * FROM leases WHERE id = ? AND work_item_id = ? AND released_at IS NULL')
      .get(leaseId, workItemId) as unknown as LeaseRow | undefined;
    if (!activeLease) throw new LeaseNotHeldError(workItemId, leaseId);
    const priorAttempts = this.db
      .prepare('SELECT COUNT(*) as n FROM job_attempts WHERE work_item_id = ?')
      .get(workItemId) as { n: number };
    const attemptId = `attempt-${workItemId}-${priorAttempts.n + 1}`;
    const startedAt = now().toISOString();
    this.db
      .prepare(
        `INSERT INTO job_attempts (id, work_item_id, lease_id, worker_id, attempt_number, sandbox_path, started_at, ended_at, outcome, summary, error)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL)`,
      )
      .run(attemptId, workItemId, leaseId, workerId, priorAttempts.n + 1, sandboxPath, startedAt);
    this.applyTransition({ id: workItemId, toState: 'running', reason: 'attempt started' }, { now });
    const row = this.db
      .prepare('SELECT * FROM job_attempts WHERE id = ?')
      .get(attemptId) as unknown as JobAttemptRow;
    return mapJobAttemptRow(row);
  }

  /**
   * Records the terminal outcome of a running attempt and applies the retry
   * budget: `succeeded`/`cancelled` are terminal-ish immediately; `failed` and
   * `lease_expired` consume one retry and either return to `retry_scheduled`
   * (budget remains) or land on `failed` (budget exhausted).
   *
   * @throws {WorkItemNotFoundError} If `attemptId` does not exist.
   */
  completeAttempt(
    { attemptId, outcome, summary, error }: {
      attemptId: string;
      outcome: JobAttemptOutcome;
      summary: string;
      error?: string;
    },
    { now = DEFAULT_NOW }: { now?: NowFn } = {},
  ): WorkItem {
    const attemptRow = this.db
      .prepare('SELECT * FROM job_attempts WHERE id = ?')
      .get(attemptId) as unknown as JobAttemptRow | undefined;
    if (!attemptRow) throw new WorkItemNotFoundError(attemptId);
    const attempt = mapJobAttemptRow(attemptRow);
    const nowIso = now().toISOString();

    this.db
      .prepare('UPDATE job_attempts SET ended_at = ?, outcome = ?, summary = ?, error = ? WHERE id = ?')
      .run(nowIso, outcome, summary, error ?? null, attemptId);
    this.db
      .prepare('UPDATE leases SET released_at = ? WHERE id = ? AND released_at IS NULL')
      .run(nowIso, attempt.leaseId);

    return this.finalizeOutcome({ workItemId: attempt.workItemId, outcome }, { now });
  }

  /** Applies the retry-budget decision for a terminal attempt outcome. Shared by completeAttempt and lease reclaim. */
  private finalizeOutcome(
    { workItemId, outcome }: { workItemId: string; outcome: JobAttemptOutcome },
    { now = DEFAULT_NOW }: { now?: NowFn } = {},
  ): WorkItem {
    const item = this.getWorkItem({ id: workItemId });
    if (outcome === 'succeeded') {
      this.applyTransition({ id: workItemId, toState: 'succeeded', reason: 'attempt succeeded' }, { now });
      return this.getWorkItem({ id: workItemId });
    }
    if (outcome === 'cancelled') {
      this.applyTransition({ id: workItemId, toState: 'cancelled', reason: 'attempt cancelled' }, { now });
      return this.getWorkItem({ id: workItemId });
    }

    const retryCount = item.retryCount + 1;
    const nowIso = now().toISOString();
    this.db
      .prepare('UPDATE work_items SET retry_count = ?, next_attempt_earliest_at = ? WHERE id = ?')
      .run(retryCount, nowIso, workItemId);

    if (retryCount < item.maxRetries) {
      this.applyTransition(
        { id: workItemId, toState: 'retry_scheduled', reason: `attempt outcome ${outcome}; retry ${retryCount}/${item.maxRetries}` },
        { now },
      );
    } else {
      this.applyTransition(
        { id: workItemId, toState: 'failed', reason: `retry budget exhausted after outcome ${outcome} (${retryCount}/${item.maxRetries})` },
        { now },
      );
    }
    return this.getWorkItem({ id: workItemId });
  }

  /** Moves any `retry_scheduled` WorkItem whose backoff has elapsed back to `queued`. */
  requeueRetryScheduled({ now = DEFAULT_NOW }: { now?: NowFn } = {}): { requeuedIds: string[] } {
    const nowIso = now().toISOString();
    const candidates = this.listWorkItems({ state: 'retry_scheduled' }).filter(
      (item) => item.nextAttemptEarliestAt === null || item.nextAttemptEarliestAt <= nowIso,
    );
    for (const item of candidates) {
      this.applyTransition({ id: item.id, toState: 'queued', reason: 'retry backoff elapsed' }, { now });
    }
    return { requeuedIds: candidates.map((item) => item.id) };
  }

  /**
   * Reclaims leases whose TTL has passed: a `leased` item that never started
   * running is simply requeued (no attempt was made, no retry consumed); a
   * `running` item's open attempt is closed with outcome `lease_expired` and
   * goes through the normal retry-budget decision — this is what lets a
   * crashed worker's claim become reclaimable per the bootstrap spec.
   */
  reclaimExpiredLeases({ now = DEFAULT_NOW }: { now?: NowFn } = {}): { reclaimedWorkItemIds: string[] } {
    const nowIso = now().toISOString();
    const expiredLeases = this.db
      .prepare('SELECT * FROM leases WHERE released_at IS NULL AND expires_at < ?')
      .all(nowIso) as unknown as LeaseRow[];

    const reclaimedWorkItemIds: string[] = [];
    for (const leaseRow of expiredLeases) {
      const lease = mapLeaseRow(leaseRow);
      const item = this.getWorkItem({ id: lease.workItemId });
      if (TERMINAL_WORK_ITEM_STATES.has(item.state)) continue;

      this.releaseLease({ leaseId: lease.id, releasedAt: nowIso });
      this.reclaimSingleWorkItem({ item, lease }, { now });
      reclaimedWorkItemIds.push(item.id);
    }
    return { reclaimedWorkItemIds };
  }

  private releaseLease({ leaseId, releasedAt }: { leaseId: string; releasedAt: string }): void {
    this.db.prepare('UPDATE leases SET released_at = ? WHERE id = ?').run(releasedAt, leaseId);
  }

  /**
   * Applies the correct reclaim outcome for one expired lease depending on
   * how far its WorkItem got: never started (`leased`) is a free requeue; a
   * genuine crash mid-run (`running`) closes the open attempt as
   * `lease_expired` and goes through the normal retry-budget decision.
   */
  private reclaimSingleWorkItem(
    { item, lease }: { item: WorkItem; lease: Lease },
    { now = DEFAULT_NOW }: { now?: NowFn } = {},
  ): void {
    if (item.state === 'leased') {
      this.applyTransition(
        { id: item.id, toState: 'queued', reason: `lease ${lease.id} expired before attempt started` },
        { now },
      );
      return;
    }
    if (item.state !== 'running') return;

    const openAttempt = this.db
      .prepare('SELECT * FROM job_attempts WHERE lease_id = ? AND ended_at IS NULL')
      .get(lease.id) as unknown as JobAttemptRow | undefined;
    if (!openAttempt) return;

    this.completeAttempt(
      { attemptId: openAttempt.id, outcome: 'lease_expired', summary: `lease ${lease.id} expired mid-run` },
      { now },
    );
  }

  /**
   * Operator-initiated terminal cancellation. Releases any open lease first
   * so the ledger never leaves a dangling active lease on a cancelled item.
   *
   * @throws {InvalidWorkItemTransitionError} If the item is already terminal.
   */
  cancelWorkItem(
    { id, reason }: { id: string; reason: string },
    { now = DEFAULT_NOW }: { now?: NowFn } = {},
  ): WorkItem {
    const item = this.getWorkItem({ id });
    if (TERMINAL_WORK_ITEM_STATES.has(item.state)) {
      throw new InvalidWorkItemTransitionError(id, item.state, 'cancel');
    }
    const nowIso = now().toISOString();
    this.db
      .prepare('UPDATE leases SET released_at = ? WHERE work_item_id = ? AND released_at IS NULL')
      .run(nowIso, id);
    this.applyTransition({ id, toState: 'cancelled', reason: `cancelled: ${reason}` }, { now });
    return this.getWorkItem({ id });
  }
}
