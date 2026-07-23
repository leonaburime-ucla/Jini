import type { WorkItem } from '../domain/types.js';

const GENERATED_FILE_BANNER =
  '<!-- GENERATED FILE — do not hand-edit. Regenerate with `pnpm --filter @jini-automation/project-runner run seed`. -->';

/**
 * Renders `ledger/tasks.md`: a per-milestone checklist view of the current
 * WorkItem DAG. This is a *generated view* — extraction-plan.md §12 C6:
 * "runner state authoritative, tasks.md/pipeline-state.md become generated
 * views" — the ledger (SQLite) remains the only source of truth; this
 * function has no side effects and does not read or write the ledger itself.
 *
 * @param input.dagId - The DAG these WorkItems belong to (rendered in the header).
 * @param input.planHash - The plan hash the DAG was derived from (rendered in the header).
 * @param input.workItems - All WorkItems to render, in any order — grouped and sorted by milestone internally.
 * @returns The full markdown document as a string.
 * @example
 * const markdown = renderTasksMarkdown({ dagId: 'extraction-abc123', planHash: 'sha256:...', workItems });
 */
export function renderTasksMarkdown({
  dagId,
  planHash,
  workItems,
}: {
  dagId: string;
  planHash: string;
  workItems: readonly WorkItem[];
}): string {
  const byMilestone = groupByMilestone({ workItems });
  const sections = [...byMilestone.entries()]
    .sort(([a], [b]) => a - b)
    .map(([milestone, items]) => renderMilestoneSection({ milestone, items }));

  return [
    '# project-runner — extraction tasks (generated view)',
    '',
    GENERATED_FILE_BANNER,
    '',
    `- dag_id: ${dagId}`,
    `- plan_hash: ${planHash}`,
    '',
    ...sections,
  ].join('\n');
}

function groupByMilestone({
  workItems,
}: {
  workItems: readonly WorkItem[];
}): Map<number, WorkItem[]> {
  const byMilestone = new Map<number, WorkItem[]>();
  for (const item of workItems) {
    const existing = byMilestone.get(item.milestone) ?? [];
    existing.push(item);
    byMilestone.set(item.milestone, existing);
  }
  return byMilestone;
}

function renderMilestoneSection({
  milestone,
  items,
}: {
  milestone: number;
  items: readonly WorkItem[];
}): string {
  const lines = [`## Milestone ${milestone}`, ''];
  for (const item of items) {
    const checkbox = item.state === 'succeeded' ? '[x]' : '[ ]';
    lines.push(`- ${checkbox} \`${item.id}\` — ${item.state} (retries used: ${item.retryCount}/${item.maxRetries})`);
  }
  lines.push('');
  return lines.join('\n');
}
