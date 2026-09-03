import { describe, expect, it } from 'vitest';

import {
  createInMemoryAsyncOperationStore,
  CREDENTIAL_IN_STATE_MESSAGE,
} from '../async-operation-store.js';

const BASE = {
  id: 'op-1',
  providerId: 'imagerouter',
  routeKey: 'video',
  ownerRef: 'run-1',
  maxAttempts: 5,
  deadlineAt: 10_000,
  nextPollAt: 0,
} as const;

describe('createInMemoryAsyncOperationStore', () => {
  it('persists a new operation as "submitted" carrying both independent bounds', async () => {
    const store = createInMemoryAsyncOperationStore();
    const row = await store.create(BASE);

    expect(row.status).toBe('submitted');
    expect(row.attempts).toBe(0);
    // Two independent bounds, both required (consensus-report "Settled" #3).
    expect(row.maxAttempts).toBe(5);
    expect(row.deadlineAt).toBe(10_000);
    expect(row.leaseOwner).toBeNull();
  });

  it('refuses to persist credential material in the operation state', async () => {
    const store = createInMemoryAsyncOperationStore();

    await expect(
      store.create({ ...BASE, state: { jobId: 'j1', apiKey: 'sk-live-123' } }),
    ).rejects.toThrow(CREDENTIAL_IN_STATE_MESSAGE);
  });

  it('refuses to smuggle credential material in on a later update', async () => {
    const store = createInMemoryAsyncOperationStore();
    await store.create(BASE);

    await expect(
      store.update('op-1', { state: { authorization: 'Bearer sk-live-123' } }),
    ).rejects.toThrow(CREDENTIAL_IN_STATE_MESSAGE);
  });

  it('rejects a credential-shaped key the old denylist missed (clientSecret)', async () => {
    // Regression for the concrete bypass: `CREDENTIAL_KEY_PATTERN` never matched `clientSecret` /
    // `client_secret`, so an adapter returning `{jobId, clientSecret}` cloned the secret straight
    // into durable state. The fix replaced the denylist with an allowlist of the shapes this
    // package's adapters actually emit, so this is rejected for not being `jobId` — not because
    // the key name was pattern-matched as "credential-shaped".
    const store = createInMemoryAsyncOperationStore();

    await expect(
      store.create({ ...BASE, state: { jobId: 'job-77', clientSecret: 'vendor-secret' } }),
    ).rejects.toThrow(CREDENTIAL_IN_STATE_MESSAGE);
  });

  it('rejects ANY key outside the resumption-handle allowlist, not just names that look like credentials', async () => {
    // Proves the mechanism is a fail-closed allowlist, not a wider denylist that would rot the
    // same way: an entirely innocuous-looking, non-credential-shaped key is rejected too, because
    // it was never registered as a legitimate resumption-handle field.
    const store = createInMemoryAsyncOperationStore();

    await expect(
      store.create({ ...BASE, state: { jobId: 'job-77', someBrandNewVendorField: 'anything' } }),
    ).rejects.toThrow(CREDENTIAL_IN_STATE_MESSAGE);
  });

  it('claims only operations that are due and unleased', async () => {
    const store = createInMemoryAsyncOperationStore();
    await store.create({ ...BASE, id: 'due', nextPollAt: 100 });
    await store.create({ ...BASE, id: 'not-due', nextPollAt: 900 });

    const claimed = await store.claimDue({ now: 500, leaseOwner: 'w1', leaseMs: 1000 });

    expect(claimed.map((r) => r.id)).toEqual(['due']);
  });

  it('leases exclusively — a second worker cannot claim the same row', async () => {
    const store = createInMemoryAsyncOperationStore();
    await store.create({ ...BASE, id: 'due', nextPollAt: 0 });

    const first = await store.claimDue({ now: 500, leaseOwner: 'w1', leaseMs: 1000 });
    const second = await store.claimDue({ now: 500, leaseOwner: 'w2', leaseMs: 1000 });

    expect(first.map((r) => r.id)).toEqual(['due']);
    expect(second).toEqual([]);
  });

  it('lets another worker reclaim a row whose lease has expired', async () => {
    const store = createInMemoryAsyncOperationStore();
    await store.create({ ...BASE, id: 'due', nextPollAt: 0 });
    await store.claimDue({ now: 500, leaseOwner: 'w1', leaseMs: 1000 });

    const reclaimed = await store.claimDue({ now: 2_000, leaseOwner: 'w2', leaseMs: 1000 });

    expect(reclaimed.map((r) => r.id)).toEqual(['due']);
    expect(reclaimed[0]!.leaseOwner).toBe('w2');
  });

  it('never claims a terminal operation', async () => {
    const store = createInMemoryAsyncOperationStore();
    await store.create({ ...BASE, id: 'done', nextPollAt: 0 });
    await store.update('done', { status: 'succeeded' });

    expect(await store.claimDue({ now: 5_000, leaseOwner: 'w1', leaseMs: 1000 })).toEqual([]);
  });

  it('rejects an illegal lifecycle transition with the exact table-driven message', async () => {
    const store = createInMemoryAsyncOperationStore();
    await store.create(BASE);
    await store.update('op-1', { status: 'succeeded' });

    await expect(store.update('op-1', { status: 'polling' })).rejects.toThrow(
      'Invalid async operation transition: "succeeded" -> "polling"',
    );
  });

  it('releases expired leases on boot WITHOUT terminating in-flight work', async () => {
    const store = createInMemoryAsyncOperationStore();
    await store.create({ ...BASE, id: 'inflight', nextPollAt: 0 });
    await store.update('inflight', { status: 'polling' });
    await store.claimDue({ now: 0, leaseOwner: 'dead-process', leaseMs: 1000 });

    const result = await store.reconcileOnBoot({ now: 9_000 });
    const row = await store.get('inflight');

    // The whole point of the durable row: a crash must leave resumable work,
    // not work marked dead the way `MediaTaskStore.reconcileOnBoot` does.
    expect(result.leasesReleased).toBe(1);
    expect(row?.status).toBe('polling');
    expect(row?.leaseOwner).toBeNull();
  });

  it('marks an operation past its absolute deadline as unknown on boot, not succeeded', async () => {
    const store = createInMemoryAsyncOperationStore();
    await store.create({ ...BASE, id: 'expired', nextPollAt: 0, deadlineAt: 1_000 });
    await store.update('expired', { status: 'polling' });

    const result = await store.reconcileOnBoot({ now: 50_000 });

    expect(result.deadlineExpired).toBe(1);
    expect((await store.get('expired'))?.status).toBe('unknown');
  });
});
