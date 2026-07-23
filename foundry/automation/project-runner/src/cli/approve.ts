import { openLedgerDb } from '../ledger/db.js';
import { ProjectRunnerLedger } from '../ledger/ledger.js';
import { EXTRACTION_DAG_ID } from '../dag/build-dag.js';
import { renderAndWriteViews } from './render-views.js';
import { LEDGER_DB_PATH } from './paths.js';

/**
 * Operator entry point: `pnpm --filter @jini-automation/project-runner run approve <work-item-id> <approved-by>`.
 *
 * The only way a `waiting_for_human` WorkItem returns to `queued` — approval
 * is never automatic (bootstrap requirement: "do not auto-approve").
 */
async function main(): Promise<void> {
  const [, , id, approvedBy] = process.argv;
  if (id === undefined || approvedBy === undefined) {
    console.error('Usage: pnpm --filter @jini-automation/project-runner run approve <work-item-id> <approved-by>');
    process.exitCode = 1;
    return;
  }

  const db = openLedgerDb({ path: LEDGER_DB_PATH });
  const ledger = new ProjectRunnerLedger({ db });
  const item = ledger.approveWorkItem({ id, approvedBy });
  console.log(`[approve] ${item.id} -> ${item.state} (approvedBy=${item.approvedBy})`);

  await renderAndWriteViews({ ledger, dagId: EXTRACTION_DAG_ID });
  db.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
