import { openLedgerDb } from '../ledger/db.js';
import { ProjectRunnerLedger } from '../ledger/ledger.js';
import { createSandbox } from '../sandbox/sandbox.js';
import { EXTRACTION_MILESTONES } from '../dag/extraction-milestones.js';
import { EXTRACTION_DAG_ID } from '../dag/build-dag.js';
import { renderAndWriteViews } from './render-views.js';
import { LEDGER_DB_PATH, SANDBOX_ROOT } from './paths.js';

/**
 * Operator/cloud-executor entry point:
 * `pnpm --filter @jini-automation/project-runner run claim`.
 *
 * Unlike `worker.ts` (which claims AND executes AND completes a WorkItem in
 * one call via a `JobExecutor`), this claims and starts an attempt only,
 * then prints the claim as `key=value` lines so a calling shell/workflow can
 * capture them (e.g. into `$GITHUB_OUTPUT`) and hand off to an external
 * executor — a cloud agent session — that isn't a `JobExecutor` in-process
 * function. `complete.ts` is the matching counterpart once that external
 * work finishes.
 *
 * Exits 0 with `claimed=false` (not an error) if nothing is eligible —
 * callers should treat that as "no work available this run", not a failure.
 */
async function main(): Promise<void> {
  const workerId = process.env['PROJECT_RUNNER_WORKER_ID'] ?? `cloud-claim-${process.pid}`;

  const db = openLedgerDb({ path: LEDGER_DB_PATH });
  const ledger = new ProjectRunnerLedger({ db });

  ledger.reclaimExpiredLeases();
  ledger.promoteReadyApprovalGates();
  ledger.requeueRetryScheduled();

  const claimed = ledger.leaseNextWorkItem({ workerId });
  if (!claimed) {
    console.log('claimed=false');
    await renderAndWriteViews({ ledger, dagId: EXTRACTION_DAG_ID });
    db.close();
    return;
  }

  const { workItem, lease } = claimed;
  const { path: sandboxPath } = await createSandbox({
    sandboxRoot: SANDBOX_ROOT,
    workItemId: workItem.id,
    attemptNumber: workItem.retryCount + 1,
  });
  const attempt = ledger.startAttempt({
    workItemId: workItem.id,
    leaseId: lease.id,
    workerId,
    sandboxPath,
  });

  const milestone = EXTRACTION_MILESTONES.find((m) => m.milestone === workItem.milestone);

  console.log('claimed=true');
  console.log(`work_item_id=${workItem.id}`);
  console.log(`attempt_id=${attempt.id}`);
  console.log(`task_type=${workItem.taskType}`);
  console.log(`milestone=${workItem.milestone}`);
  console.log(`title=${workItem.title}`);
  console.log(`milestone_title=${milestone?.title ?? ''}`);
  console.log(`milestone_gate=${milestone?.gate ?? ''}`);
  console.log(`sandbox_path=${sandboxPath}`);

  await renderAndWriteViews({ ledger, dagId: EXTRACTION_DAG_ID });
  db.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
