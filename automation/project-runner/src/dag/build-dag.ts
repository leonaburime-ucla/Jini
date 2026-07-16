import type { WorkItem, WorkItemTaskType } from '../domain/types.js';
import type { ExtractionMilestone } from './extraction-milestones.js';
import { EXTRACTION_MILESTONES } from './extraction-milestones.js';

/** Non-approval task types generated for every milestone, in dependency order. */
const MILESTONE_TASK_SEQUENCE: readonly Exclude<WorkItemTaskType, 'human-approval'>[] = [
  'red-spec',
  'impl',
  'package-contract',
  'tarball',
  'consumer-canary',
  'evidence',
];

const DEFAULT_MAX_RETRIES = 3;

/**
 * Stable identity of "the" §8 extraction DAG. Deliberately NOT derived from
 * the plan hash: the DAG's identity must stay constant across plan
 * revisions so `verify-freshness.ts` can compare an old recorded hash
 * against a new one for the *same* DAG and detect drift. If §8 is ever
 * restructured into a materially different milestone set, bump this to
 * `v2` and treat it as a new DAG rather than silently mutating history.
 */
export const EXTRACTION_DAG_ID = 'extraction-plan-v1';

/**
 * Converts extraction-plan.md §8's ten milestones into a hashed WorkItem DAG:
 * each milestone becomes red-spec → impl → package-contract → tarball →
 * consumer-canary → evidence → human-approval, and each milestone's
 * red-spec depends on the previous milestone's human-approval — so the DAG
 * enforces both in-milestone task order and cross-milestone sequencing, with
 * a mandatory manual sign-off gate between milestones (bootstrap requirement:
 * "a job state ... that blocks on human sign-off before proceeding").
 *
 * @param input.planHash - The `sha256:...` digest identifying the
 *   extraction-plan.md §8 revision this DAG was derived from (see
 *   `hash.ts`). Stored on every WorkItem and in `dag_meta` so drift can be
 *   detected later via `verify-freshness.ts`.
 * @returns The DAG id (always {@link EXTRACTION_DAG_ID}) and the full ordered
 *   list of generated WorkItems, all in `queued` state with zero retries used.
 * @example
 * const { dagId, workItems } = buildExtractionDag({ planHash: 'sha256:abc...' });
 */
export function buildExtractionDag({ planHash }: { planHash: string }): {
  dagId: string;
  workItems: WorkItem[];
} {
  const dagId = EXTRACTION_DAG_ID;
  const nowIso = new Date().toISOString();
  const workItems: WorkItem[] = [];
  let precedingApprovalId: string | null = null;

  for (const milestone of EXTRACTION_MILESTONES) {
    const built = buildMilestoneWorkItems({ milestone, dagId, planHash, precedingApprovalId, createdAt: nowIso });
    workItems.push(...built.items);
    precedingApprovalId = built.approvalId;
  }

  return { dagId, workItems };
}

/**
 * Builds one milestone's red-spec → impl → package-contract → tarball →
 * consumer-canary → evidence → human-approval chain, wiring its first task
 * to `precedingApprovalId` (the previous milestone's approval gate, or
 * `null` for milestone 1) so cross-milestone sequencing falls out of the
 * same dependency mechanism as in-milestone ordering.
 *
 * @returns The milestone's WorkItems and its own approval task id, so the
 *   caller can thread it into the next milestone's `precedingApprovalId`.
 */
function buildMilestoneWorkItems({
  milestone,
  dagId,
  planHash,
  precedingApprovalId,
  createdAt,
}: {
  milestone: ExtractionMilestone;
  dagId: string;
  planHash: string;
  precedingApprovalId: string | null;
  createdAt: string;
}): { items: WorkItem[]; approvalId: string } {
  const items: WorkItem[] = [];
  let previousTaskId = precedingApprovalId;

  for (const taskType of MILESTONE_TASK_SEQUENCE) {
    const id = buildWorkItemId({ milestone: milestone.milestone, taskType });
    items.push(
      makeWorkItem({
        id,
        dagId,
        planHash,
        milestone: milestone.milestone,
        taskType,
        title: `m${milestone.milestone} ${taskType}: ${milestone.title}`,
        dependsOn: dependsOnList(previousTaskId),
        requiresApproval: false,
        createdAt,
      }),
    );
    previousTaskId = id;
  }

  const approvalId = buildWorkItemId({ milestone: milestone.milestone, taskType: 'human-approval' });
  items.push(
    makeWorkItem({
      id: approvalId,
      dagId,
      planHash,
      milestone: milestone.milestone,
      taskType: 'human-approval',
      title: `m${milestone.milestone} human-approval: sign off on gate — ${milestone.gate}`,
      dependsOn: dependsOnList(previousTaskId),
      requiresApproval: true,
      createdAt,
    }),
  );

  return { items, approvalId };
}

/** A single-predecessor dependency list, or none if there is no predecessor. */
function dependsOnList(precedingId: string | null): string[] {
  return precedingId ? [precedingId] : [];
}

function buildWorkItemId({
  milestone,
  taskType,
}: {
  milestone: number;
  taskType: WorkItemTaskType;
}): string {
  return `m${milestone}-${taskType}`;
}

function makeWorkItem({
  id,
  dagId,
  planHash,
  milestone,
  taskType,
  title,
  dependsOn,
  requiresApproval,
  createdAt,
}: {
  id: string;
  dagId: string;
  planHash: string;
  milestone: number;
  taskType: WorkItemTaskType;
  title: string;
  dependsOn: readonly string[];
  requiresApproval: boolean;
  createdAt: string;
}): WorkItem {
  return {
    id,
    dagId,
    planHash,
    milestone,
    taskType,
    title,
    dependsOn,
    requiresApproval,
    state: 'queued',
    retryCount: 0,
    maxRetries: DEFAULT_MAX_RETRIES,
    approvedAt: null,
    approvedBy: null,
    nextAttemptEarliestAt: null,
    createdAt,
    updatedAt: createdAt,
  };
}
