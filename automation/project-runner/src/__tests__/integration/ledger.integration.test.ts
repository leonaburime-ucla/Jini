import { beforeEach, describe, expect, it } from 'vitest';
import { openLedgerDb } from '../../ledger/db.js';
import { ProjectRunnerLedger } from '../../ledger/ledger.js';
import {
  InvalidWorkItemTransitionError,
  LeaseNotHeldError,
  WorkItemNotFoundError,
} from '../../errors.js';
import type { WorkItem } from '../../domain/types.js';

/** Builds a minimal, independently-schedulable WorkItem for ledger tests. */
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

function makeLedger(): ProjectRunnerLedger {
  const db = openLedgerDb({ path: ':memory:' });
  return new ProjectRunnerLedger({ db });
}

describe('ProjectRunnerLedger — enqueue, get, list', () => {
  let ledger: ProjectRunnerLedger;
  beforeEach(() => {
    ledger = makeLedger();
  });

  it('round-trips a seeded WorkItem through getWorkItem', () => {
    ledger.seedWorkItems({ items: [makeItem({ id: 'w1', dependsOn: ['a', 'b'] })] });
    const item = ledger.getWorkItem({ id: 'w1' });
    expect(item.dependsOn).toEqual(['a', 'b']);
    expect(item.state).toBe('queued');
  });

  it('is idempotent: re-seeding the same id does not duplicate or reset it', () => {
    ledger.seedWorkItems({ items: [makeItem({ id: 'w1' })] });
    ledger.leaseNextWorkItem({ workerId: 'worker-a' });
    const { insertedCount, skippedCount } = ledger.seedWorkItems({ items: [makeItem({ id: 'w1' })] });
    expect(insertedCount).toBe(0);
    expect(skippedCount).toBe(1);
    expect(ledger.getWorkItem({ id: 'w1' }).state).toBe('leased');
  });

  it('throws WorkItemNotFoundError for an unknown id', () => {
    expect(() => ledger.getWorkItem({ id: 'nope' })).toThrow(WorkItemNotFoundError);
  });
});

describe('ProjectRunnerLedger — dependency gating', () => {
  it('never leases a WorkItem whose dependency has not succeeded', () => {
    const ledger = makeLedger();
    ledger.seedWorkItems({
      items: [makeItem({ id: 'dep' }), makeItem({ id: 'w1', dependsOn: ['dep'] })],
    });
    // 'dep' is queued and eligible, so it is leased first — 'w1' must never be returned yet.
    const first = ledger.leaseNextWorkItem({ workerId: 'worker-a' });
    expect(first?.workItem.id).toBe('dep');
    const second = ledger.leaseNextWorkItem({ workerId: 'worker-a' });
    expect(second).toBeNull();
  });

  it('becomes leasable once its dependency succeeds', () => {
    const ledger = makeLedger();
    ledger.seedWorkItems({
      items: [makeItem({ id: 'dep' }), makeItem({ id: 'w1', dependsOn: ['dep'] })],
    });
    const leased = ledger.leaseNextWorkItem({ workerId: 'worker-a' });
    const attempt = ledger.startAttempt({
      workItemId: 'dep',
      leaseId: leased!.lease.id,
      workerId: 'worker-a',
      sandboxPath: '/tmp/sandbox',
    });
    ledger.completeAttempt({ attemptId: attempt.id, outcome: 'succeeded', summary: 'ok' });

    const next = ledger.leaseNextWorkItem({ workerId: 'worker-a' });
    expect(next?.workItem.id).toBe('w1');
  });
});

describe('ProjectRunnerLedger — no double lease (adversarial: concurrent-looking claims)', () => {
  it('never returns the same WorkItem to two leaseNextWorkItem calls', () => {
    const ledger = makeLedger();
    ledger.seedWorkItems({ items: [makeItem({ id: 'w1' }), makeItem({ id: 'w2' })] });

    const first = ledger.leaseNextWorkItem({ workerId: 'worker-a' });
    const second = ledger.leaseNextWorkItem({ workerId: 'worker-b' });
    const third = ledger.leaseNextWorkItem({ workerId: 'worker-c' });

    expect(first?.workItem.id).not.toBe(second?.workItem.id);
    expect(new Set([first?.workItem.id, second?.workItem.id])).toEqual(new Set(['w1', 'w2']));
    expect(third).toBeNull();
  });
});

describe('ProjectRunnerLedger — manual approval gate', () => {
  it('never leases a WorkItem that requires approval and has not been approved', () => {
    const ledger = makeLedger();
    ledger.seedWorkItems({ items: [makeItem({ id: 'gate', requiresApproval: true })] });
    expect(ledger.leaseNextWorkItem({ workerId: 'worker-a' })).toBeNull();
  });

  it('promotes a ready approval-gated item to waiting_for_human instead of leaving it silently queued', () => {
    const ledger = makeLedger();
    ledger.seedWorkItems({ items: [makeItem({ id: 'gate', requiresApproval: true })] });
    const { promotedIds } = ledger.promoteReadyApprovalGates();
    expect(promotedIds).toEqual(['gate']);
    expect(ledger.getWorkItem({ id: 'gate' }).state).toBe('waiting_for_human');
  });

  it('does not promote an approval-gated item whose dependency has not succeeded', () => {
    const ledger = makeLedger();
    ledger.seedWorkItems({
      items: [makeItem({ id: 'dep' }), makeItem({ id: 'gate', requiresApproval: true, dependsOn: ['dep'] })],
    });
    const { promotedIds } = ledger.promoteReadyApprovalGates();
    expect(promotedIds).toEqual([]);
    expect(ledger.getWorkItem({ id: 'gate' }).state).toBe('queued');
  });

  it('only becomes leasable after an explicit approveWorkItem call, never automatically', () => {
    const ledger = makeLedger();
    ledger.seedWorkItems({ items: [makeItem({ id: 'gate', requiresApproval: true })] });
    ledger.promoteReadyApprovalGates();

    expect(ledger.leaseNextWorkItem({ workerId: 'worker-a' })).toBeNull();

    const approved = ledger.approveWorkItem({ id: 'gate', approvedBy: 'lea' });
    expect(approved.state).toBe('queued');
    expect(approved.approvedBy).toBe('lea');

    const leased = ledger.leaseNextWorkItem({ workerId: 'worker-a' });
    expect(leased?.workItem.id).toBe('gate');
  });

  it('rejects approving a WorkItem that is not waiting_for_human', () => {
    const ledger = makeLedger();
    ledger.seedWorkItems({ items: [makeItem({ id: 'w1' })] }); // plain queued item, not a gate
    expect(() => ledger.approveWorkItem({ id: 'w1', approvedBy: 'lea' })).toThrow(
      InvalidWorkItemTransitionError,
    );
  });
});

describe('ProjectRunnerLedger — retry budget (adversarial: exact boundary)', () => {
  it('schedules a retry while attempts remain under maxRetries', () => {
    const ledger = makeLedger();
    ledger.seedWorkItems({ items: [makeItem({ id: 'w1', maxRetries: 2 })] });
    const leased = ledger.leaseNextWorkItem({ workerId: 'worker-a' })!;
    const attempt = ledger.startAttempt({
      workItemId: 'w1',
      leaseId: leased.lease.id,
      workerId: 'worker-a',
      sandboxPath: '/tmp/s',
    });
    const result = ledger.completeAttempt({ attemptId: attempt.id, outcome: 'failed', summary: 'boom' });
    expect(result.state).toBe('retry_scheduled');
    expect(result.retryCount).toBe(1);
  });

  it('fails terminally exactly at maxRetries, not one before or one after', () => {
    const ledger = makeLedger();
    ledger.seedWorkItems({ items: [makeItem({ id: 'w1', maxRetries: 2 })] });

    // Attempt 1: fails -> retry_scheduled (retryCount 1, budget 2)
    let leased = ledger.leaseNextWorkItem({ workerId: 'worker-a' })!;
    let attempt = ledger.startAttempt({
      workItemId: 'w1',
      leaseId: leased.lease.id,
      workerId: 'worker-a',
      sandboxPath: '/tmp/s',
    });
    let result = ledger.completeAttempt({ attemptId: attempt.id, outcome: 'failed', summary: 'boom' });
    expect(result.state).toBe('retry_scheduled');

    // Attempt 2: fails -> retryCount reaches maxRetries -> failed (terminal)
    ledger.requeueRetryScheduled();
    leased = ledger.leaseNextWorkItem({ workerId: 'worker-a' })!;
    attempt = ledger.startAttempt({
      workItemId: 'w1',
      leaseId: leased.lease.id,
      workerId: 'worker-a',
      sandboxPath: '/tmp/s',
    });
    result = ledger.completeAttempt({ attemptId: attempt.id, outcome: 'failed', summary: 'boom again' });
    expect(result.state).toBe('failed');
    expect(result.retryCount).toBe(2);

    // Once failed, it must never be leasable again without operator intervention.
    ledger.requeueRetryScheduled();
    expect(ledger.leaseNextWorkItem({ workerId: 'worker-a' })).toBeNull();
  });
});

describe('ProjectRunnerLedger — lease expiry (crashed worker becomes reclaimable)', () => {
  it('requeues a leased-but-never-started item without consuming retry budget', () => {
    const ledger = makeLedger();
    ledger.seedWorkItems({ items: [makeItem({ id: 'w1', maxRetries: 2 })] });
    const past = () => new Date('2020-01-01T00:00:00.000Z');
    const later = () => new Date('2020-01-01T00:10:00.000Z');

    ledger.leaseNextWorkItem({ workerId: 'crashed-worker' }, { leaseDurationMs: 1000, now: past });
    const { reclaimedWorkItemIds } = ledger.reclaimExpiredLeases({ now: later });

    expect(reclaimedWorkItemIds).toEqual(['w1']);
    const item = ledger.getWorkItem({ id: 'w1' });
    expect(item.state).toBe('queued');
    expect(item.retryCount).toBe(0); // no attempt was ever made — not a penalized failure
  });

  it('closes an open attempt as lease_expired and consumes retry budget for a crash mid-run', () => {
    const ledger = makeLedger();
    ledger.seedWorkItems({ items: [makeItem({ id: 'w1', maxRetries: 2 })] });
    const past = () => new Date('2020-01-01T00:00:00.000Z');
    const later = () => new Date('2020-01-01T00:10:00.000Z');

    const leased = ledger.leaseNextWorkItem({ workerId: 'crashed-worker' }, { leaseDurationMs: 1000, now: past });
    ledger.startAttempt(
      { workItemId: 'w1', leaseId: leased!.lease.id, workerId: 'crashed-worker', sandboxPath: '/tmp/s' },
      { now: past },
    );

    const { reclaimedWorkItemIds } = ledger.reclaimExpiredLeases({ now: later });
    expect(reclaimedWorkItemIds).toEqual(['w1']);

    const item = ledger.getWorkItem({ id: 'w1' });
    expect(item.state).toBe('retry_scheduled');
    expect(item.retryCount).toBe(1);
  });

  it('does not reclaim a lease that has not yet expired', () => {
    const ledger = makeLedger();
    ledger.seedWorkItems({ items: [makeItem({ id: 'w1' })] });
    const now = () => new Date('2020-01-01T00:00:00.000Z');
    ledger.leaseNextWorkItem({ workerId: 'worker-a' }, { leaseDurationMs: 60_000, now });
    const { reclaimedWorkItemIds } = ledger.reclaimExpiredLeases({ now });
    expect(reclaimedWorkItemIds).toEqual([]);
    expect(ledger.getWorkItem({ id: 'w1' }).state).toBe('leased');
  });
});

describe('ProjectRunnerLedger — lease and attempt integrity', () => {
  it('rejects starting an attempt with a lease id that is not the active lease (adversarial: stale/forged lease)', () => {
    const ledger = makeLedger();
    ledger.seedWorkItems({ items: [makeItem({ id: 'w1' })] });
    ledger.leaseNextWorkItem({ workerId: 'worker-a' });
    expect(() =>
      ledger.startAttempt({
        workItemId: 'w1',
        leaseId: 'lease-that-does-not-exist',
        workerId: 'worker-a',
        sandboxPath: '/tmp/s',
      }),
    ).toThrow(LeaseNotHeldError);
  });

  it('throws WorkItemNotFoundError when completing an unknown attempt id', () => {
    const ledger = makeLedger();
    expect(() =>
      ledger.completeAttempt({ attemptId: 'no-such-attempt', outcome: 'succeeded', summary: 'x' }),
    ).toThrow(WorkItemNotFoundError);
  });
});

describe('ProjectRunnerLedger — cancellation', () => {
  it('cancels a queued item and releases any open lease', () => {
    const ledger = makeLedger();
    ledger.seedWorkItems({ items: [makeItem({ id: 'w1' })] });
    ledger.leaseNextWorkItem({ workerId: 'worker-a' });
    const cancelled = ledger.cancelWorkItem({ id: 'w1', reason: 'no longer needed' });
    expect(cancelled.state).toBe('cancelled');
  });

  it('rejects cancelling a WorkItem that is already terminal', () => {
    const ledger = makeLedger();
    ledger.seedWorkItems({ items: [makeItem({ id: 'w1' })] });
    ledger.cancelWorkItem({ id: 'w1', reason: 'first cancel' });
    expect(() => ledger.cancelWorkItem({ id: 'w1', reason: 'second cancel' })).toThrow(
      InvalidWorkItemTransitionError,
    );
  });
});

describe('ProjectRunnerLedger — dag metadata / plan hash', () => {
  it('records a plan hash for a dag id and returns null for an unknown dag', () => {
    const ledger = makeLedger();
    expect(ledger.getDagPlanHash({ dagId: 'dag-1' })).toBeNull();
    ledger.recordDagMeta({ dagId: 'dag-1', planHash: 'sha256:aaa' });
    expect(ledger.getDagPlanHash({ dagId: 'dag-1' })).toBe('sha256:aaa');
  });

  it('never overwrites an already-recorded plan hash (INSERT OR IGNORE)', () => {
    const ledger = makeLedger();
    ledger.recordDagMeta({ dagId: 'dag-1', planHash: 'sha256:aaa' });
    ledger.recordDagMeta({ dagId: 'dag-1', planHash: 'sha256:bbb' });
    expect(ledger.getDagPlanHash({ dagId: 'dag-1' })).toBe('sha256:aaa');
  });
});
