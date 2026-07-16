import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openLedgerDb } from '../../ledger/db.js';
import { ProjectRunnerLedger } from '../../ledger/ledger.js';
import { drainWorkerQueue, runWorkerTick } from '../../worker/worker.js';
import { noopJobExecutor } from '../../worker/executor.js';
import type { JobExecutor } from '../../worker/executor.js';
import type { WorkItem } from '../../domain/types.js';

function makeItem(overrides: Partial<WorkItem> = {}): WorkItem {
  const id = overrides.id ?? 'w1';
  const nowIso = '2026-07-16T00:00:00.000Z';
  return {
    id,
    dagId: 'dag-1',
    planHash: 'sha256:test',
    milestone: 1,
    taskType: 'impl',
    title: `WorkItem ${id}`,
    dependsOn: [],
    requiresApproval: false,
    state: 'queued',
    retryCount: 0,
    maxRetries: 2,
    approvedAt: null,
    approvedBy: null,
    nextAttemptEarliestAt: null,
    createdAt: nowIso,
    updatedAt: nowIso,
    ...overrides,
  };
}

describe('runWorkerTick / drainWorkerQueue', () => {
  let sandboxRoot: string;
  let ledger: ProjectRunnerLedger;

  beforeEach(async () => {
    sandboxRoot = await mkdtemp(join(tmpdir(), 'project-runner-worker-test-'));
    ledger = new ProjectRunnerLedger({ db: openLedgerDb({ path: ':memory:' }) });
  });

  afterEach(async () => {
    await rm(sandboxRoot, { recursive: true, force: true });
  });

  it('returns leased: false when the queue is empty', async () => {
    const result = await runWorkerTick({ ledger, workerId: 'worker-1', sandboxRoot, executor: noopJobExecutor });
    expect(result).toEqual({ leased: false });
  });

  it('leases, sandboxes, executes, and settles one WorkItem to succeeded', async () => {
    ledger.seedWorkItems({ items: [makeItem({ id: 'w1' })] });
    const result = await runWorkerTick({ ledger, workerId: 'worker-1', sandboxRoot, executor: noopJobExecutor });

    expect(result).toMatchObject({ leased: true, outcome: 'succeeded' });
    expect(existsSync(join(sandboxRoot, 'w1', 'attempt-1'))).toBe(true);
    expect(ledger.getWorkItem({ id: 'w1' }).state).toBe('succeeded');
  });

  it('runs a failing WorkItem through retry_scheduled and back to running on the next tick', async () => {
    ledger.seedWorkItems({ items: [makeItem({ id: 'w1', maxRetries: 2 })] });
    const failingExecutor: JobExecutor = async () => ({ outcome: 'failed', summary: 'boom', error: 'boom' });

    const first = await runWorkerTick({ ledger, workerId: 'worker-1', sandboxRoot, executor: failingExecutor });
    expect(first).toMatchObject({ leased: true, outcome: 'retry_scheduled' });

    // Second tick: requeue + re-lease + fail again -> retry budget exhausted -> failed.
    const second = await runWorkerTick({ ledger, workerId: 'worker-1', sandboxRoot, executor: failingExecutor });
    expect(second).toMatchObject({ leased: true, outcome: 'failed' });
  });

  it('drainWorkerQueue processes every independent WorkItem and stops when the queue empties', async () => {
    ledger.seedWorkItems({ items: [makeItem({ id: 'w1' }), makeItem({ id: 'w2' }), makeItem({ id: 'w3' })] });
    const { ticks, leasedCount } = await drainWorkerQueue({
      ledger,
      workerId: 'worker-1',
      sandboxRoot,
      executor: noopJobExecutor,
    });

    expect(leasedCount).toBe(3);
    expect(ticks).toBe(4); // 3 successful leases + 1 tick that finds the queue empty
    for (const id of ['w1', 'w2', 'w3']) {
      expect(ledger.getWorkItem({ id }).state).toBe('succeeded');
    }
  });

  it('never leases a WorkItem awaiting manual approval, even mid-drain', async () => {
    ledger.seedWorkItems({
      items: [makeItem({ id: 'w1' }), makeItem({ id: 'gate', requiresApproval: true })],
    });
    const { leasedCount } = await drainWorkerQueue({
      ledger,
      workerId: 'worker-1',
      sandboxRoot,
      executor: noopJobExecutor,
    });

    expect(leasedCount).toBe(1);
    expect(ledger.getWorkItem({ id: 'gate' }).state).toBe('waiting_for_human');
  });
});
