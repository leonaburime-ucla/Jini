import { readFile } from 'node:fs/promises';
import { openLedgerDb } from '../ledger/db.js';
import { ProjectRunnerLedger } from '../ledger/ledger.js';
import { buildExtractionDag } from '../dag/build-dag.js';
import { computeExtractionPlanHash } from '../dag/hash.js';
import { verifyDagFreshness } from '../dag/verify-freshness.js';
import { PlanHashDriftError } from '../errors.js';
import { renderAndWriteViews } from './render-views.js';
import { EXTRACTION_PLAN_PATH, LEDGER_DB_PATH, PIPELINE_STATE_MD_PATH, TASKS_MD_PATH } from './paths.js';

/**
 * Operator entry point: `pnpm --filter @jini-automation/project-runner run seed`.
 *
 * Idempotently derives the §8 extraction DAG from `foundry/docs/jini-port/extraction-plan.md`,
 * seeds any not-yet-present WorkItems into the committed SQLite ledger, and
 * regenerates the two committed markdown views. Safe to re-run at any time —
 * existing WorkItems and their progress are never overwritten.
 */
async function main(): Promise<void> {
  const planText = await readFile(EXTRACTION_PLAN_PATH, 'utf8');
  const planHash = computeExtractionPlanHash({ planText });
  const { dagId, workItems } = buildExtractionDag({ planHash });

  const db = openLedgerDb({ path: LEDGER_DB_PATH });
  const ledger = new ProjectRunnerLedger({ db });

  try {
    verifyDagFreshness({ ledger, dagId, currentPlanHash: planHash });
  } catch (error) {
    if (!(error instanceof PlanHashDriftError)) throw error;
    console.warn(`[seed] DRIFT DETECTED: ${error.message}`);
    console.warn(
      '[seed] proceeding: new/renamed WorkItems will be added, but existing WorkItem ' +
        'ids are never rewritten from stale text — review foundry/docs/jini-port/extraction-plan.md ' +
        '§8 against src/dag/extraction-milestones.ts by hand before trusting titles/gates.',
    );
  }

  ledger.recordDagMeta({ dagId, planHash });
  const { insertedCount, skippedCount } = ledger.seedWorkItems({ items: workItems });
  console.log(
    `[seed] dag=${dagId} planHash=${planHash} inserted=${insertedCount} alreadyPresent=${skippedCount}`,
  );

  await renderAndWriteViews({ ledger, dagId });
  console.log(`[seed] wrote ${TASKS_MD_PATH}`);
  console.log(`[seed] wrote ${PIPELINE_STATE_MD_PATH}`);

  db.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
