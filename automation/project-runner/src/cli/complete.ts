import { openLedgerDb } from '../ledger/db.js';
import { ProjectRunnerLedger } from '../ledger/ledger.js';
import { EXTRACTION_DAG_ID } from '../dag/build-dag.js';
import { renderAndWriteViews } from './render-views.js';
import { LEDGER_DB_PATH } from './paths.js';
import type { JobAttemptOutcome } from '../domain/types.js';

const VALID_OUTCOMES: readonly JobAttemptOutcome[] = ['succeeded', 'failed', 'lease_expired', 'cancelled'];

function isJobAttemptOutcome(value: string): value is JobAttemptOutcome {
  return (VALID_OUTCOMES as readonly string[]).includes(value);
}

/**
 * Operator/cloud-executor entry point:
 * `pnpm --filter @jini-automation/project-runner run complete <attempt-id> <outcome> [summary] [error]`.
 *
 * The counterpart to `claim.ts` — records the terminal outcome of an attempt
 * an external executor (not an in-process `JobExecutor`) already started via
 * `claim`.
 */
async function main(): Promise<void> {
  const [, , attemptId, outcomeArg, summaryArg, errorArg] = process.argv;
  if (attemptId === undefined || outcomeArg === undefined || !isJobAttemptOutcome(outcomeArg)) {
    console.error(
      `Usage: pnpm --filter @jini-automation/project-runner run complete <attempt-id> <${VALID_OUTCOMES.join('|')}> [summary] [error]`,
    );
    process.exitCode = 1;
    return;
  }

  const db = openLedgerDb({ path: LEDGER_DB_PATH });
  const ledger = new ProjectRunnerLedger({ db });

  const item = ledger.completeAttempt({
    attemptId,
    outcome: outcomeArg,
    summary: summaryArg ?? `completed via cli: ${outcomeArg}`,
    ...(errorArg !== undefined ? { error: errorArg } : {}),
  });
  console.log(`[complete] ${attemptId} -> workItem ${item.id} is now ${item.state}`);

  await renderAndWriteViews({ ledger, dagId: EXTRACTION_DAG_ID });
  db.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
