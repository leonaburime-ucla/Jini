import { openLedgerDb } from '../ledger/db.js';
import { ProjectRunnerLedger } from '../ledger/ledger.js';
import { drainWorkerQueue } from '../worker/worker.js';
import { noopJobExecutor } from '../worker/executor.js';
import { EXTRACTION_DAG_ID } from '../dag/build-dag.js';
import { renderAndWriteViews } from './render-views.js';
import { LEDGER_DB_PATH, SANDBOX_ROOT } from './paths.js';

/**
 * Operator entry point: `pnpm --filter @jini-automation/project-runner run worker [maxTicks]`.
 *
 * Runs the single local worker until the queue is drained or `maxTicks` is
 * reached (default 1 — a single tick per invocation, so an operator or a
 * future scheduler stays in control of pacing rather than this leaving a
 * background daemon running).
 *
 * Uses {@link noopJobExecutor} — this bootstrap does not drive real
 * extraction work yet (see `src/worker/executor.ts` for the seam a future
 * `@jini/agent-runtime`-backed executor plugs into).
 */
async function main(): Promise<void> {
  const workerId = process.env['PROJECT_RUNNER_WORKER_ID'] ?? `worker-${process.pid}`;
  const maxTicksArg = process.argv[2];
  const maxTicks = maxTicksArg !== undefined ? Number.parseInt(maxTicksArg, 10) : 1;

  const db = openLedgerDb({ path: LEDGER_DB_PATH });
  const ledger = new ProjectRunnerLedger({ db });

  const { ticks, leasedCount } = await drainWorkerQueue(
    { ledger, workerId, sandboxRoot: SANDBOX_ROOT, executor: noopJobExecutor },
    { maxTicks },
  );
  console.log(`[worker] workerId=${workerId} ticks=${ticks} leasedCount=${leasedCount}`);

  await renderAndWriteViews({ ledger, dagId: EXTRACTION_DAG_ID });
  db.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
