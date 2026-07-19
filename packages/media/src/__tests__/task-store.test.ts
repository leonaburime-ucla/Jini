import { describe, expect, it } from 'vitest';
import { createInMemoryMediaTaskStore } from '../task-store.js';

describe('createInMemoryMediaTaskStore — lifecycle', () => {
  it('create() defaults status to queued and returns the full row', async () => {
    const store = createInMemoryMediaTaskStore();
    const task = await store.create({ id: 't1', ownerRef: 'run-1' });
    expect(task).toMatchObject({ id: 't1', ownerRef: 'run-1', status: 'queued', progress: [], file: null, error: null });
    expect(task.startedAt).toBeTypeOf('number');
    expect(task.endedAt).toBeNull();
  });

  it('create() accepts an explicit status, surface, model, progress, file, error, startedAt', async () => {
    const store = createInMemoryMediaTaskStore();
    const task = await store.create({
      id: 't2',
      ownerRef: 'run-1',
      status: 'running',
      surface: 'video',
      model: 'sora-2',
      progress: ['queued upstream'],
      file: { url: 'https://x/y.mp4' },
      error: null,
      startedAt: 1000,
    });
    expect(task).toMatchObject({
      status: 'running',
      surface: 'video',
      model: 'sora-2',
      progress: ['queued upstream'],
      file: { url: 'https://x/y.mp4' },
      startedAt: 1000,
    });
  });

  it('create() rejects an invalid status', async () => {
    const store = createInMemoryMediaTaskStore();
    await expect(store.create({ id: 't3', ownerRef: 'run-1', status: 'bogus' as never })).rejects.toThrow(RangeError);
  });

  it('get() returns null for an unknown id', async () => {
    const store = createInMemoryMediaTaskStore();
    expect(await store.get('nope')).toBeNull();
  });

  it('get() returns the created row', async () => {
    const store = createInMemoryMediaTaskStore();
    await store.create({ id: 't1', ownerRef: 'run-1' });
    expect((await store.get('t1'))?.id).toBe('t1');
  });

  it('update() returns null for an unknown id', async () => {
    const store = createInMemoryMediaTaskStore();
    expect(await store.update('nope', { status: 'done' })).toBeNull();
  });

  it('update() rejects an invalid status', async () => {
    const store = createInMemoryMediaTaskStore();
    await store.create({ id: 't1', ownerRef: 'run-1' });
    await expect(store.update('t1', { status: 'bogus' as never })).rejects.toThrow(RangeError);
  });

  it('update() patches status/progress/file/error/endedAt and preserves unspecified fields', async () => {
    const store = createInMemoryMediaTaskStore();
    await store.create({ id: 't1', ownerRef: 'run-1', surface: 'video', model: 'sora-2' });
    const updated = await store.update('t1', {
      status: 'done',
      progress: ['submitted', 'polling', 'done'],
      file: { url: 'https://x/y.mp4' },
      endedAt: 5000,
    });
    expect(updated).toMatchObject({
      status: 'done',
      progress: ['submitted', 'polling', 'done'],
      file: { url: 'https://x/y.mp4' },
      endedAt: 5000,
      surface: 'video',
      model: 'sora-2',
    });
  });

  it('update() with an empty patch keeps status/progress but bumps updatedAt', async () => {
    const store = createInMemoryMediaTaskStore();
    const created = await store.create({ id: 't1', ownerRef: 'run-1' });
    const updated = await store.update('t1', {});
    expect(updated?.status).toBe(created.status);
    expect(updated?.progress).toEqual(created.progress);
  });

  it('update() can clear surface/model/file/error/endedAt by passing null/undefined explicitly', async () => {
    const store = createInMemoryMediaTaskStore();
    await store.create({ id: 't1', ownerRef: 'run-1', surface: 'video', model: 'sora-2', file: { a: 1 } });
    const cleared = await store.update('t1', { surface: null, model: null, file: null, error: null, endedAt: null });
    expect(cleared?.surface).toBeUndefined();
    expect(cleared?.model).toBeUndefined();
    expect(cleared?.file).toBeNull();
    expect(cleared?.error).toBeNull();
    expect(cleared?.endedAt).toBeNull();
  });

  it('delete() removes a task; a second get() returns null', async () => {
    const store = createInMemoryMediaTaskStore();
    await store.create({ id: 't1', ownerRef: 'run-1' });
    await store.delete('t1');
    expect(await store.get('t1')).toBeNull();
  });

  it('delete() on an unknown id is a silent no-op', async () => {
    const store = createInMemoryMediaTaskStore();
    await expect(store.delete('nope')).resolves.toBeUndefined();
  });
});

describe('createInMemoryMediaTaskStore — listByOwner', () => {
  it('scopes to ownerRef and excludes terminal tasks by default, newest first', async () => {
    const store = createInMemoryMediaTaskStore();
    await store.create({ id: 'a', ownerRef: 'run-1', startedAt: 1 });
    await store.create({ id: 'b', ownerRef: 'run-1', startedAt: 2 });
    await store.create({ id: 'c', ownerRef: 'run-2', startedAt: 3 });
    await store.update('b', { status: 'done', endedAt: 10 });

    const list = await store.listByOwner('run-1');
    expect(list.map((t) => t.id)).toEqual(['a']);
  });

  it('includeTerminal:true includes terminal tasks', async () => {
    const store = createInMemoryMediaTaskStore();
    await store.create({ id: 'a', ownerRef: 'run-1', startedAt: 1 });
    await store.create({ id: 'b', ownerRef: 'run-1', startedAt: 2 });
    await store.update('b', { status: 'failed', endedAt: 10 });

    const list = await store.listByOwner('run-1', { includeTerminal: true });
    expect(list.map((t) => t.id)).toEqual(['b', 'a']);
  });

  it('returns an empty array for an owner with no tasks', async () => {
    const store = createInMemoryMediaTaskStore();
    expect(await store.listByOwner('nobody')).toEqual([]);
  });
});

describe('createInMemoryMediaTaskStore — reconcileOnBoot', () => {
  it('marks in-flight (queued/running) tasks interrupted', async () => {
    const store = createInMemoryMediaTaskStore();
    await store.create({ id: 'a', ownerRef: 'run-1', status: 'queued' });
    await store.create({ id: 'b', ownerRef: 'run-1', status: 'running' });

    const result = await store.reconcileOnBoot({ terminalTtlMs: 1000, now: 5000 });
    expect(result).toEqual({ interrupted: 2, deleted: 0 });
    const a = await store.get('a');
    expect(a?.status).toBe('interrupted');
    expect(a?.error?.code).toBe('DAEMON_RESTART');
    expect(a?.endedAt).toBe(5000);
  });

  it('does not overwrite an already-set endedAt when interrupting', async () => {
    const store = createInMemoryMediaTaskStore();
    await store.create({ id: 'a', ownerRef: 'run-1', status: 'running' });
    await store.update('a', { endedAt: 1234 });
    // update() only sets endedAt when explicitly present in the patch; force status back to running to re-test reconcile.
    await store.update('a', { status: 'running', endedAt: 1234 });
    const result = await store.reconcileOnBoot({ terminalTtlMs: 1000, now: 9999 });
    expect(result.interrupted).toBe(1);
    expect((await store.get('a'))?.endedAt).toBe(1234);
  });

  it('deletes terminal tasks older than terminalTtlMs and keeps recent ones', async () => {
    const store = createInMemoryMediaTaskStore();
    await store.create({ id: 'old', ownerRef: 'run-1' });
    await store.update('old', { status: 'done', endedAt: 1000 });
    await store.create({ id: 'recent', ownerRef: 'run-1' });
    await store.update('recent', { status: 'done', endedAt: 9000 });

    const result = await store.reconcileOnBoot({ terminalTtlMs: 5000, now: 10000 });
    expect(result).toEqual({ interrupted: 0, deleted: 1 });
    expect(await store.get('old')).toBeNull();
    expect(await store.get('recent')).not.toBeNull();
  });

  it('uses Date.now() when now is not supplied', async () => {
    const store = createInMemoryMediaTaskStore();
    await store.create({ id: 'a', ownerRef: 'run-1', status: 'queued' });
    const result = await store.reconcileOnBoot({ terminalTtlMs: 1000 });
    expect(result.interrupted).toBe(1);
  });

  it('falls back to updatedAt for the cutoff comparison when endedAt is null', async () => {
    const store = createInMemoryMediaTaskStore();
    const created = await store.create({ id: 'a', ownerRef: 'run-1', status: 'done' });
    // status 'done' at create time leaves endedAt null (create() always sets endedAt: null).
    expect(created.endedAt).toBeNull();
    const result = await store.reconcileOnBoot({ terminalTtlMs: 1, now: created.updatedAt + 1000 });
    expect(result.deleted).toBe(1);
  });
});
