import { describe, expect, it } from 'vitest';
import { buildExtractionDag, EXTRACTION_DAG_ID } from '../../dag/build-dag.js';
import { EXTRACTION_MILESTONES } from '../../dag/extraction-milestones.js';

const PLAN_HASH = 'sha256:fixturehash';

describe('buildExtractionDag', () => {
  it('generates 7 WorkItems per milestone (6 tasks + 1 approval gate)', () => {
    const { workItems } = buildExtractionDag({ planHash: PLAN_HASH });
    expect(workItems).toHaveLength(EXTRACTION_MILESTONES.length * 7);
  });

  it('uses a stable dag id independent of the plan hash', () => {
    const a = buildExtractionDag({ planHash: 'sha256:aaa' });
    const b = buildExtractionDag({ planHash: 'sha256:bbb' });
    expect(a.dagId).toBe(EXTRACTION_DAG_ID);
    expect(b.dagId).toBe(EXTRACTION_DAG_ID);
  });

  it('chains in-milestone tasks red-spec -> impl -> ... -> human-approval', () => {
    const { workItems } = buildExtractionDag({ planHash: PLAN_HASH });
    const byId = new Map(workItems.map((item) => [item.id, item]));

    expect(byId.get('m1-red-spec')?.dependsOn).toEqual([]);
    expect(byId.get('m1-impl')?.dependsOn).toEqual(['m1-red-spec']);
    expect(byId.get('m1-package-contract')?.dependsOn).toEqual(['m1-impl']);
    expect(byId.get('m1-tarball')?.dependsOn).toEqual(['m1-package-contract']);
    expect(byId.get('m1-consumer-canary')?.dependsOn).toEqual(['m1-tarball']);
    expect(byId.get('m1-evidence')?.dependsOn).toEqual(['m1-consumer-canary']);
    expect(byId.get('m1-human-approval')?.dependsOn).toEqual(['m1-evidence']);
  });

  it('chains milestone N+1 red-spec on milestone N human-approval', () => {
    const { workItems } = buildExtractionDag({ planHash: PLAN_HASH });
    const byId = new Map(workItems.map((item) => [item.id, item]));

    expect(byId.get('m2-red-spec')?.dependsOn).toEqual(['m1-human-approval']);
    expect(byId.get('m10-red-spec')?.dependsOn).toEqual(['m9-human-approval']);
  });

  it('marks only human-approval tasks as requiring approval', () => {
    const { workItems } = buildExtractionDag({ planHash: PLAN_HASH });
    for (const item of workItems) {
      expect(item.requiresApproval).toBe(item.taskType === 'human-approval');
    }
  });

  it('starts every WorkItem queued with zero retries used and the given plan hash', () => {
    const { workItems } = buildExtractionDag({ planHash: PLAN_HASH });
    for (const item of workItems) {
      expect(item.state).toBe('queued');
      expect(item.retryCount).toBe(0);
      expect(item.planHash).toBe(PLAN_HASH);
    }
  });

  it('produces unique ids for every WorkItem (no accidental collisions across milestones)', () => {
    const { workItems } = buildExtractionDag({ planHash: PLAN_HASH });
    const ids = workItems.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
