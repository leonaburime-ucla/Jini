/**
 * Automation-domain vocabulary for project-runner.
 *
 * Vocabulary firewall (foundry/docs/jini-port/extraction-plan.md §12 C5/C6, root AGENTS.md):
 * the engine owns `{Run, Agent, Tool}`; automation owns
 * `{PipelineRun, WorkItem, JobAttempt, Worker, Persona, MethodDefinition}`.
 * Nothing in this module may be named `Job`, `Run`, `Agent`, or `Tool` in a way
 * that collides with `@jini/core` / `@jini/daemon` domain types, and nothing here
 * imports from `packages/@jini/**`.
 */

/**
 * Compact runner state machine, adopted verbatim from AI-Dev-Shop's canonical
 * job lifecycle (`AI-Dev-Shop/framework/workflows/job-lifecycle.md`)
 * per extraction-plan §12 C6: "adopt AI-Dev-Shop's existing state machine;
 * render its markdown lifecycle from the runner's compact states."
 *
 * Mapping to the AI-Dev-Shop canonical states lives in
 * {@link AI_DEV_SHOP_STATUS_BY_WORK_ITEM_STATE}. Two AI-Dev-Shop states have no
 * runner-state equivalent in this bootstrap and are documented there instead of
 * invented here: `ESCALATED` (rendered as a Notes annotation once a `failed`
 * item has exhausted its retry budget) and `ABORTED` (no distributed/session
 * concept exists yet in a single local-process worker).
 */
export type WorkItemState =
  | 'queued'
  | 'leased'
  | 'running'
  | 'succeeded'
  | 'retry_scheduled'
  | 'waiting_for_human'
  | 'failed'
  | 'cancelled';

/** States a work item cannot leave once entered. */
export const TERMINAL_WORK_ITEM_STATES: ReadonlySet<WorkItemState> = new Set([
  'succeeded',
  'failed',
  'cancelled',
]);

/**
 * Maps every {@link WorkItemState} to the AI-Dev-Shop canonical job-lifecycle
 * state it renders as in generated `pipeline-state.md` views. This is the
 * single source of truth for that translation — the render layer must not
 * duplicate this mapping.
 */
export const AI_DEV_SHOP_STATUS_BY_WORK_ITEM_STATE: Readonly<Record<WorkItemState, string>> = {
  queued: 'QUEUED',
  leased: 'DISPATCHED',
  running: 'RUNNING',
  succeeded: 'DONE',
  retry_scheduled: 'RETRYING',
  waiting_for_human: 'WAITING_FOR_HUMAN',
  failed: 'FAILED',
  cancelled: 'CANCELLED',
};

/**
 * Task shape generated per extraction-plan §8 milestone (see
 * `src/dag/extraction-milestones.ts`). `human-approval` is the manual sign-off
 * gate task type — it always carries `requiresApproval: true`.
 */
export type WorkItemTaskType =
  | 'red-spec'
  | 'impl'
  | 'package-contract'
  | 'tarball'
  | 'consumer-canary'
  | 'evidence'
  | 'human-approval';

/**
 * A unit of schedulable work owned by project-runner. This is the automation
 * domain's replacement for the engine's `Run` — the two must never be unified.
 */
export interface WorkItem {
  id: string;
  dagId: string;
  planHash: string;
  milestone: number;
  taskType: WorkItemTaskType;
  title: string;
  /** Ids of other WorkItems in the same DAG that must reach `succeeded` first. */
  dependsOn: readonly string[];
  requiresApproval: boolean;
  state: WorkItemState;
  retryCount: number;
  maxRetries: number;
  approvedAt: string | null;
  approvedBy: string | null;
  /** Earliest time a `retry_scheduled` item becomes eligible for re-lease. */
  nextAttemptEarliestAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A worker's exclusive, time-bounded claim on a WorkItem. */
export interface Lease {
  id: string;
  workItemId: string;
  workerId: string;
  acquiredAt: string;
  expiresAt: string;
  releasedAt: string | null;
}

/** Terminal result of one execution attempt. */
export type JobAttemptOutcome = 'succeeded' | 'failed' | 'lease_expired' | 'cancelled';

/**
 * One execution attempt of a WorkItem by a Worker holding a Lease, inside an
 * isolated filesystem sandbox. This is the automation domain's audit record —
 * it must never be confused with the engine's run event log.
 */
export interface JobAttempt {
  id: string;
  workItemId: string;
  leaseId: string;
  workerId: string;
  attemptNumber: number;
  sandboxPath: string;
  startedAt: string;
  endedAt: string | null;
  outcome: JobAttemptOutcome | null;
  summary: string | null;
  error: string | null;
}

/** Identity of a single local-process worker loop (this bootstrap runs exactly one). */
export interface Worker {
  id: string;
  startedAt: string;
}
