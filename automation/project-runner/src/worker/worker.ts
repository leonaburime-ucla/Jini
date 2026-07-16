import type { WorkItem } from '../domain/types.js';
import type { ProjectRunnerLedger } from '../ledger/ledger.js';
import { createSandbox } from '../sandbox/sandbox.js';
import type { JobExecutor } from './executor.js';

/** Result of one {@link runWorkerTick} call. */
export type WorkerTickResult =
  | { leased: false }
  | { leased: true; workItem: WorkItem; outcome: 'succeeded' | 'failed' | 'retry_scheduled' };

/**
 * Runs exactly one worker tick: reclaims expired leases, promotes
 * ready-and-approval-gated items to `waiting_for_human`, requeues elapsed
 * retries, then leases and executes at most one WorkItem.
 *
 * This is the entire "one worker" loop body (bootstrap requirement: single
 * worker, no distributed coordination). A caller drives repeated ticks — see
 * `src/cli/worker.ts` for the process entry point.
 *
 * @param input.ledger - The ledger to lease from and record outcomes to.
 * @param input.workerId - Identity recorded on the lease and attempt rows.
 * @param input.sandboxRoot - Root directory for isolated per-attempt working directories.
 * @param input.executor - The pluggable unit of work; defaults are the caller's concern (see `noopJobExecutor`).
 * @param options.leaseDurationMs - How long a lease is held before it becomes reclaimable. Defaults to 5 minutes.
 * @param options.now - Injectable clock for deterministic tests.
 * @returns `{ leased: false }` if the queue had nothing eligible; otherwise the WorkItem and its resulting state.
 * @throws {Error} Propagates ledger, sandbox, or executor errors unchanged — a tick that throws has not
 *   corrupted ledger state (each ledger mutation is already committed before the throw could occur),
 *   but the caller should treat a thrown tick as needing operator attention, not a silent retry loop.
 * @example
 * const result = await runWorkerTick({ ledger, workerId: 'worker-1', sandboxRoot: '.sandbox', executor: noopJobExecutor });
 */
export async function runWorkerTick(
  {
    ledger,
    workerId,
    sandboxRoot,
    executor,
  }: {
    ledger: ProjectRunnerLedger;
    workerId: string;
    sandboxRoot: string;
    executor: JobExecutor;
  },
  // Forwarded verbatim to the ledger calls below rather than destructured and
  // rebuilt — with `exactOptionalPropertyTypes`, a rebuilt literal like
  // `{ now }` turns an *absent* property into one explicitly set to
  // `undefined`, which is a different (and rejected) type.
  tickOptions: { leaseDurationMs?: number; now?: () => Date } = {},
): Promise<WorkerTickResult> {
  ledger.reclaimExpiredLeases(tickOptions);
  ledger.promoteReadyApprovalGates();
  ledger.requeueRetryScheduled(tickOptions);

  const claimed = ledger.leaseNextWorkItem({ workerId }, tickOptions);
  if (!claimed) return { leased: false };

  const { workItem, lease } = claimed;
  // Mirrors the ledger's own `priorAttempts + 1` computation in startAttempt — safe only because
  // this bootstrap runs a single sequential worker, so there is no concurrent attempt to race with.
  const attemptNumberGuess = workItem.retryCount + 1;
  const { path: sandboxPath } = await createSandbox({
    sandboxRoot,
    workItemId: workItem.id,
    attemptNumber: attemptNumberGuess,
  });
  const attempt = ledger.startAttempt(
    { workItemId: workItem.id, leaseId: lease.id, workerId, sandboxPath },
    tickOptions,
  );

  const result = await executor({ workItem, attempt, sandboxPath });
  const completed = ledger.completeAttempt(
    {
      attemptId: attempt.id,
      outcome: result.outcome,
      summary: result.summary,
      ...(result.error !== undefined ? { error: result.error } : {}),
    },
    tickOptions,
  );

  return {
    leased: true,
    workItem: completed,
    outcome: completed.state as 'succeeded' | 'failed' | 'retry_scheduled',
  };
}

/**
 * Runs ticks until the queue has nothing left to lease or `maxTicks` is
 * reached, whichever comes first. Bounded by default so tests and CLI runs
 * never spin forever — this is a batch drain, not a persistent daemon.
 *
 * @returns Total ticks executed and how many actually leased a WorkItem.
 */
export async function drainWorkerQueue(
  input: { ledger: ProjectRunnerLedger; workerId: string; sandboxRoot: string; executor: JobExecutor },
  { maxTicks = 100, ...tickOptions }: { maxTicks?: number; leaseDurationMs?: number; now?: () => Date } = {},
): Promise<{ ticks: number; leasedCount: number }> {
  let ticks = 0;
  let leasedCount = 0;
  while (ticks < maxTicks) {
    // Rest-destructured above (not rebuilt field-by-field), so `tickOptions` only carries
    // whatever keys the caller actually passed — see the note in runWorkerTick.
    const result = await runWorkerTick(input, tickOptions);
    ticks += 1;
    if (!result.leased) break;
    leasedCount += 1;
  }
  return { ticks, leasedCount };
}
