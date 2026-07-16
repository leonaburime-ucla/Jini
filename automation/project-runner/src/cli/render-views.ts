import { writeFile } from 'node:fs/promises';
import type { ProjectRunnerLedger } from '../ledger/ledger.js';
import { renderTasksMarkdown } from '../render/render-tasks-md.js';
import { renderPipelineStateMarkdown } from '../render/render-pipeline-state-md.js';
import { PIPELINE_STATE_MD_PATH, TASKS_MD_PATH } from './paths.js';

/**
 * Regenerates the two committed markdown views (`ledger/tasks.md`,
 * `ledger/pipeline-state.md`) from current ledger state for the given DAG.
 * Shared by every CLI entry point that mutates the ledger (`seed`, `worker`,
 * `approve`) so the generated views never go stale after an operator-visible
 * state change — extraction-plan.md §12 C6: "runner state authoritative,
 * tasks.md/pipeline-state.md become generated views."
 *
 * @throws {Error} Propagates any `node:fs` write error unchanged.
 */
export async function renderAndWriteViews({
  ledger,
  dagId,
}: {
  ledger: ProjectRunnerLedger;
  dagId: string;
}): Promise<void> {
  const planHash = ledger.getDagPlanHash({ dagId }) ?? 'unknown';
  const workItems = ledger.listWorkItems({ dagId });

  await writeFile(TASKS_MD_PATH, renderTasksMarkdown({ dagId, planHash, workItems }), 'utf8');
  await writeFile(
    PIPELINE_STATE_MD_PATH,
    renderPipelineStateMarkdown({
      dagId,
      planHash,
      renderedAt: new Date().toISOString(),
      workItems,
    }),
    'utf8',
  );
}
