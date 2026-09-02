import { describe, expect, it, vi } from 'vitest';

import { createInMemoryAsyncOperationStore } from '../async-operation-store.js';
import type { AsyncOperationStore } from '../async-operation-store.js';
import { createBearerSigner } from '../polling-adapter.js';
import type { PollingVendorAdapter } from '../polling-adapter.js';
import {
  pollDueOperations,
  recoverAfterRestart,
  startOperation,
} from '../operation-runtime.js';
import type { RenderContext } from '../types.js';

const CTX: RenderContext = {
  surface: 'video',
  model: 'veo-3',
  wireModel: 'veo-3',
  prompt: 'a cat',
  aspect: '16:9',
  length: 5,
  duration: undefined,
  voice: '',
  audioKind: undefined,
  language: 'en',
  loop: false,
  promptInfluence: undefined,
  imageRef: null,
  imageRefs: [],
  requestInit: {},
  speechFormat: 'mp3',
};

const signer = createBearerSigner({
  resolve: () => ({ apiKey: 'sk-test-secret' }),
  missingCredentialMessage: 'no key',
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** A vendor whose submit returns the finished artifact immediately. */
function fastAdapter(overrides: Partial<PollingVendorAdapter> = {}): PollingVendorAdapter {
  return {
    expectedLatencyClass: 'fast',
    buildSubmitRequest: () => ({ url: 'https://vendor.test/submit', init: { method: 'POST' }, meta: undefined }),
    parseSubmitResponse: async (resp) => {
      const data = (await resp.json()) as { id?: string; b64?: string };
      if (data.b64) {
        return { kind: 'complete', result: { bytes: Buffer.from(data.b64, 'base64'), providerNote: 'fast done' } };
      }
      return { kind: 'pending', state: { jobId: data.id! } };
    },
    buildPollRequest: (state) => ({ url: `https://vendor.test/jobs/${String(state.jobId)}`, init: {}, meta: undefined }),
    parsePollResponse: async (resp) => {
      const data = (await resp.json()) as { status: string; b64?: string; message?: string };
      if (data.status === 'completed') {
        return { kind: 'complete', result: { bytes: Buffer.from(data.b64!, 'base64'), providerNote: 'polled done' } };
      }
      if (data.status === 'failed') return { kind: 'failed', message: data.message ?? 'vendor failed' };
      return { kind: 'pending' };
    },
    ...overrides,
  };
}

describe('startOperation', () => {
  it('returns {done:true} in the same round trip when a fast vendor answers inside the grace window', async () => {
    const store = createInMemoryAsyncOperationStore();
    const fetchImpl = vi.fn(async () => json({ b64: Buffer.from('MP4').toString('base64') }));

    const outcome = await startOperation(
      { store, signer, fetchImpl: fetchImpl as unknown as typeof fetch },
      { adapter: fastAdapter(), ctx: CTX, providerId: 'imagerouter', routeKey: 'video', ownerRef: 'run-1', graceMs: 500 },
    );

    expect(outcome.done).toBe(true);
    expect(outcome.done && outcome.result.bytes.toString()).toBe('MP4');
    expect((await store.get(outcome.operationId))?.status).toBe('succeeded');
  });

  it('persists the operation row BEFORE the first fetch is issued', async () => {
    const store = createInMemoryAsyncOperationStore();
    let rowsAtFetchTime = 0;
    const fetchImpl = vi.fn(async () => {
      rowsAtFetchTime = (await store.listByOwner('run-1')).length;
      return json({ b64: Buffer.from('X').toString('base64') });
    });

    await startOperation(
      { store, signer, fetchImpl: fetchImpl as unknown as typeof fetch },
      { adapter: fastAdapter(), ctx: CTX, providerId: 'imagerouter', routeKey: 'video', ownerRef: 'run-1', graceMs: 500 },
    );

    // Crash safety is a consequence of this ordering, not a separate mechanism.
    expect(rowsAtFetchTime).toBe(1);
  });

  it('hands back {done:false, operationId} when a fast vendor overruns the grace window, and still settles the row', async () => {
    const store = createInMemoryAsyncOperationStore();
    const fetchImpl = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 120));
      return json({ b64: Buffer.from('LATE').toString('base64') });
    });

    const outcome = await startOperation(
      { store, signer, fetchImpl: fetchImpl as unknown as typeof fetch },
      { adapter: fastAdapter(), ctx: CTX, providerId: 'imagerouter', routeKey: 'video', ownerRef: 'run-1', graceMs: 10 },
    );

    expect(outcome.done).toBe(false);

    // The grace window is a race, not a fork: the same in-flight submit keeps going and writes
    // its own outcome into the row the caller already holds an id for.
    await vi.waitFor(async () => {
      expect((await store.get(outcome.operationId))?.status).toBe('succeeded');
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('moves a pending submit to "polling" carrying the vendor handle, never the credential', async () => {
    const store = createInMemoryAsyncOperationStore();
    const fetchImpl = vi.fn(async () => json({ id: 'job-77' }));

    const outcome = await startOperation(
      { store, signer, fetchImpl: fetchImpl as unknown as typeof fetch },
      { adapter: fastAdapter(), ctx: CTX, providerId: 'imagerouter', routeKey: 'video', ownerRef: 'run-1', graceMs: 500 },
    );

    const row = await store.get(outcome.operationId);
    expect(outcome.done).toBe(false);
    expect(row?.status).toBe('polling');
    expect(row?.state).toEqual({ jobId: 'job-77' });
    expect(JSON.stringify(row)).not.toContain('sk-test-secret');
  });

  it('signs the request without the adapter ever seeing the secret', async () => {
    const store = createInMemoryAsyncOperationStore();
    let seenAuth: string | undefined;
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      seenAuth = (init.headers as Record<string, string>).authorization;
      return json({ b64: Buffer.from('X').toString('base64') });
    });
    let unsignedInit: RequestInit | undefined;
    const base = fastAdapter();
    const adapter: PollingVendorAdapter = {
      ...base,
      buildSubmitRequest: (ctx) => {
        const built = base.buildSubmitRequest(ctx);
        unsignedInit = built.init;
        return built;
      },
    };

    await startOperation(
      { store, signer, fetchImpl: fetchImpl as unknown as typeof fetch },
      { adapter, ctx: CTX, providerId: 'imagerouter', routeKey: 'video', ownerRef: 'run-1', graceMs: 500 },
    );

    // What the adapter produced carried no auth; the signer added it beneath the adapter.
    expect((unsignedInit?.headers as Record<string, string> | undefined)?.authorization).toBeUndefined();
    expect(seenAuth).toBe('Bearer sk-test-secret');
  });
});

describe('pollDueOperations', () => {
  const resolveContext = () => CTX;

  async function seedPolling(store: AsyncOperationStore, id = 'op-1', over: Record<string, unknown> = {}) {
    await store.create({
      id,
      providerId: 'imagerouter',
      routeKey: 'video',
      ownerRef: 'run-1',
      maxAttempts: 3,
      deadlineAt: Date.now() + 60_000,
      nextPollAt: 0,
      state: { jobId: 'job-77' },
      ...over,
    });
    await store.update(id, { status: 'polling' });
  }

  it('completes an operation when the vendor reports the job finished', async () => {
    const store = createInMemoryAsyncOperationStore();
    await seedPolling(store);
    const fetchImpl = vi.fn(async () => json({ status: 'completed', b64: Buffer.from('DONE').toString('base64') }));

    const stats = await pollDueOperations(
      { store, signer, fetchImpl: fetchImpl as unknown as typeof fetch },
      { adapters: () => fastAdapter(), resolveContext, leaseOwner: 'w1', leaseMs: 1000 },
    );

    const row = await store.get('op-1');
    expect(stats.completed).toBe(1);
    expect(row?.status).toBe('succeeded');
    expect(Buffer.from(row!.result!.bytesBase64, 'base64').toString()).toBe('DONE');
    expect(row?.leaseOwner).toBeNull();
  });

  it('re-resolves credentials on every poll tick, covering a token that expires mid-stream', async () => {
    const store = createInMemoryAsyncOperationStore();
    await seedPolling(store);
    const keys = ['sk-first', 'sk-rotated'];
    let i = 0;
    const rotating = createBearerSigner({ resolve: () => ({ apiKey: keys[i++] ?? 'sk-rotated' }), missingCredentialMessage: 'no key' });
    const seen: string[] = [];
    const fetchImpl = vi.fn(async (_u: string, init: RequestInit) => {
      seen.push((init.headers as Record<string, string>).authorization ?? '');
      return json({ status: 'pending' });
    });

    const deps = { store, signer: rotating, fetchImpl: fetchImpl as unknown as typeof fetch };
    const params = { adapters: () => fastAdapter(), resolveContext, leaseOwner: 'w1', leaseMs: 1000 };
    await pollDueOperations(deps, params);
    await store.update('op-1', { nextPollAt: 0 });
    await pollDueOperations(deps, params);

    expect(seen).toEqual(['Bearer sk-first', 'Bearer sk-rotated']);
  });

  it('fails an operation that exhausts its attempt cap', async () => {
    const store = createInMemoryAsyncOperationStore();
    await seedPolling(store, 'op-1', { maxAttempts: 2 });
    const fetchImpl = vi.fn(async () => json({ status: 'pending' }));
    const deps = { store, signer, fetchImpl: fetchImpl as unknown as typeof fetch };
    const params = { adapters: () => fastAdapter(), resolveContext, leaseOwner: 'w1', leaseMs: 1000 };

    for (let n = 0; n < 3; n += 1) {
      await store.update('op-1', { nextPollAt: 0 });
      await pollDueOperations(deps, params);
    }

    const row = await store.get('op-1');
    expect(row?.status).toBe('failed');
    expect(row?.error?.code).toBe('ATTEMPTS_EXHAUSTED');
  });

  it('marks an operation past its absolute deadline "unknown", never "failed"', async () => {
    const store = createInMemoryAsyncOperationStore();
    await seedPolling(store, 'op-1', { deadlineAt: Date.now() - 1 });
    const fetchImpl = vi.fn(async () => json({ status: 'pending' }));

    const stats = await pollDueOperations(
      { store, signer, fetchImpl: fetchImpl as unknown as typeof fetch },
      { adapters: () => fastAdapter(), resolveContext, leaseOwner: 'w1', leaseMs: 1000 },
    );

    const row = await store.get('op-1');
    expect(stats.unknown).toBe(1);
    expect(row?.status).toBe('unknown');
    expect(row?.error?.code).toBe('DEADLINE_EXPIRED');
    // A blown deadline says nothing about whether the vendor did the work — so it must not
    // be reported as a clean failure, and must not have cost another vendor call.
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('crash recovery', () => {
  const resolveContext = () => CTX;

  it('resumes a polling operation after a kill -9 without re-charging the vendor', async () => {
    // One durable store across the "restart" — the row is the only thing that survives.
    const store = createInMemoryAsyncOperationStore();
    const submitCalls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      submitCalls.push(url);
      if (url.endsWith('/submit')) return json({ id: 'job-77' });
      return json({ status: 'completed', b64: Buffer.from('RECOVERED').toString('base64') });
    });

    const outcome = await startOperation(
      { store, signer, fetchImpl: fetchImpl as unknown as typeof fetch },
      { adapter: fastAdapter(), ctx: CTX, providerId: 'imagerouter', routeKey: 'video', ownerRef: 'run-1', graceMs: 500 },
    );
    expect(outcome.done).toBe(false);

    // Worker A claims the row and is killed mid-poll: the lease is held by a process that no
    // longer exists, and nothing else about the row was ever in that process's memory.
    await store.update(outcome.operationId, { nextPollAt: 0 });
    const leased = await store.claimDue({ now: Date.now(), leaseOwner: 'worker-A-dead', leaseMs: 30_000 });
    expect(leased).toHaveLength(1);

    const recovery = await recoverAfterRestart(
      { store, signer, fetchImpl: fetchImpl as unknown as typeof fetch },
      { adapters: () => fastAdapter(), now: Date.now() + 60_000 },
    );
    expect(recovery.leasesReleased).toBe(1);

    await store.update(outcome.operationId, { nextPollAt: 0 });
    const stats = await pollDueOperations(
      { store, signer, fetchImpl: fetchImpl as unknown as typeof fetch },
      { adapters: () => fastAdapter(), resolveContext, leaseOwner: 'worker-B', leaseMs: 1000 },
    );

    const row = await store.get(outcome.operationId);
    expect(stats.completed).toBe(1);
    expect(row?.status).toBe('succeeded');
    expect(Buffer.from(row!.result!.bytesBase64, 'base64').toString()).toBe('RECOVERED');
    // The acceptance bar: no duplicate vendor charge.
    expect(submitCalls.filter((u) => u.endsWith('/submit'))).toHaveLength(1);
  });

  it('routes a crashed non-idempotent submit to "unknown" instead of blindly retrying it', async () => {
    const store = createInMemoryAsyncOperationStore();
    await store.create({
      id: 'orphan',
      providerId: 'imagerouter',
      routeKey: 'video',
      ownerRef: 'run-1',
      maxAttempts: 3,
      deadlineAt: Date.now() + 60_000,
    });

    const recovery = await recoverAfterRestart(
      { store, signer, fetchImpl: (async () => json({})) as unknown as typeof fetch },
      { adapters: () => fastAdapter({ submitIsIdempotent: false }), now: Date.now() },
    );

    const row = await store.get('orphan');
    expect(recovery.unknownCrashGap).toBe(1);
    expect(row?.status).toBe('unknown');
    expect(row?.error?.code).toBe('CRASH_GAP_NOT_IDEMPOTENT');
  });

  it('leaves a crashed idempotent submit resubmittable rather than marking it unknown', async () => {
    const store = createInMemoryAsyncOperationStore();
    await store.create({
      id: 'orphan',
      providerId: 'imagerouter',
      routeKey: 'video',
      ownerRef: 'run-1',
      maxAttempts: 3,
      deadlineAt: Date.now() + 60_000,
    });

    const recovery = await recoverAfterRestart(
      { store, signer, fetchImpl: (async () => json({})) as unknown as typeof fetch },
      { adapters: () => fastAdapter({ submitIsIdempotent: true }), now: Date.now() },
    );

    expect(recovery.resubmittable).toEqual(['orphan']);
    expect((await store.get('orphan'))?.status).toBe('submitted');
  });
});
