import { AI_DEV_SHOP_STATUS_BY_WORK_ITEM_STATE } from '../domain/types.js';
import type { WorkItem } from '../domain/types.js';

const GENERATED_FILE_BANNER =
  '<!-- GENERATED FILE — do not hand-edit. Regenerate with `pnpm --filter @jini-automation/project-runner run seed`. -->';

/**
 * Renders `ledger/pipeline-state.md`: the current DAG state translated into
 * AI-Dev-Shop's canonical job-lifecycle vocabulary
 * (`AI-Dev-Shop/framework/workflows/job-lifecycle.md`), per
 * extraction-plan.md §12 C6 ("render its markdown lifecycle from the
 * runner's compact states").
 *
 * A `failed` WorkItem that has exhausted its retry budget is additionally
 * annotated as AI-Dev-Shop's `ESCALATED` in the Notes column — job-lifecycle.md
 * defines `ESCALATED` as "Coordinator has routed to human due to budget
 * exhaustion", which is exactly what an exhausted `failed` WorkItem means
 * here, but this bootstrap does not model `ESCALATED` as a distinct runner
 * state (see `domain/types.ts`).
 *
 * @returns The full markdown document as a string. Pure function — takes no
 *   ledger dependency and performs no I/O.
 */
export function renderPipelineStateMarkdown({
  dagId,
  planHash,
  renderedAt,
  workItems,
}: {
  dagId: string;
  planHash: string;
  renderedAt: string;
  workItems: readonly WorkItem[];
}): string {
  const rows = workItems.map(renderWorkItemRow).join('\n');
  const inFlight = workItems.filter((item) => !isSettled({ item }));

  return [
    '# Pipeline State (project-runner generated view)',
    '',
    GENERATED_FILE_BANNER,
    '',
    `- dag_id: ${dagId}`,
    `- plan_hash: ${planHash}`,
    `- rendered_at: ${renderedAt}`,
    '- state_machine_source: AI-Dev-Shop/framework/workflows/job-lifecycle.md',
    '',
    '## WorkItem Status',
    '',
    '| WorkItem | Milestone | Task Type | AI-Dev-Shop Status | Retry | Notes |',
    '|---|---|---|---|---|---|',
    rows,
    '',
    '## In-Flight / Blocked',
    '',
    inFlight.length > 0
      ? inFlight.map((item) => `- \`${item.id}\`: ${item.state} — ${describeNote({ item })}`).join('\n')
      : '- none',
    '',
  ].join('\n');
}

function renderWorkItemRow(item: WorkItem): string {
  const status = AI_DEV_SHOP_STATUS_BY_WORK_ITEM_STATE[item.state];
  return `| \`${item.id}\` | ${item.milestone} | ${item.taskType} | ${status} | ${item.retryCount}/${item.maxRetries} | ${describeNote({ item })} |`;
}

function isSettled({ item }: { item: WorkItem }): boolean {
  return item.state === 'succeeded' || item.state === 'cancelled';
}

function describeNote({ item }: { item: WorkItem }): string {
  if (item.state === 'failed' && item.retryCount >= item.maxRetries) {
    return 'ESCALATED (retry budget exhausted; needs human triage)';
  }
  if (item.state === 'waiting_for_human') {
    return 'awaiting manual approval';
  }
  return '';
}
