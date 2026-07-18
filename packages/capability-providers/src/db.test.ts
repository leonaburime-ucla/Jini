import { describe, expect, it } from 'vitest';
import { createInMemoryDbProvider } from './db.js';

describe('createInMemoryDbProvider', () => {
  it('insert then get round-trips a record', async () => {
    const db = createInMemoryDbProvider();
    const record = await db.insert('widgets', { id: 'w1', name: 'sprocket' });
    expect(record).toEqual({ id: 'w1', name: 'sprocket' });
    expect(await db.get('widgets', 'w1')).toEqual({ id: 'w1', name: 'sprocket' });
  });

  it('insert rejects a duplicate id within the same collection', async () => {
    const db = createInMemoryDbProvider();
    await db.insert('widgets', { id: 'w1' });
    await expect(db.insert('widgets', { id: 'w1' })).rejects.toThrow(/already exists/);
  });

  it('the same id is allowed across different collections', async () => {
    const db = createInMemoryDbProvider();
    await db.insert('widgets', { id: 'w1' });
    await expect(db.insert('gadgets', { id: 'w1' })).resolves.toEqual({ id: 'w1' });
  });

  it('get returns null for an unknown collection or unknown id', async () => {
    const db = createInMemoryDbProvider();
    expect(await db.get('nope', 'w1')).toBeNull();
    await db.insert('widgets', { id: 'w1' });
    expect(await db.get('widgets', 'w2')).toBeNull();
  });

  it('update shallow-merges a patch into an existing record', async () => {
    const db = createInMemoryDbProvider();
    await db.insert('widgets', { id: 'w1', name: 'sprocket', qty: 1 });
    const updated = await db.update('widgets', 'w1', { qty: 2 });
    expect(updated).toEqual({ id: 'w1', name: 'sprocket', qty: 2 });
  });

  it('update returns null for an unknown collection or unknown id (no upsert)', async () => {
    const db = createInMemoryDbProvider();
    expect(await db.update('nope', 'w1', { qty: 2 })).toBeNull();
    await db.insert('widgets', { id: 'w1' });
    expect(await db.update('widgets', 'w2', { qty: 2 })).toBeNull();
  });

  it('delete removes a record; a second get returns null', async () => {
    const db = createInMemoryDbProvider();
    await db.insert('widgets', { id: 'w1' });
    await db.delete('widgets', 'w1');
    expect(await db.get('widgets', 'w1')).toBeNull();
  });

  it('delete on an unknown collection or unknown id is a silent no-op', async () => {
    const db = createInMemoryDbProvider();
    await expect(db.delete('nope', 'w1')).resolves.toBeUndefined();
    await db.insert('widgets', { id: 'w1' });
    await expect(db.delete('widgets', 'w2')).resolves.toBeUndefined();
  });

  it('query with no filter returns every record in the collection', async () => {
    const db = createInMemoryDbProvider();
    await db.insert('widgets', { id: 'w1', color: 'red' });
    await db.insert('widgets', { id: 'w2', color: 'blue' });
    const all = await db.query('widgets');
    expect(all).toHaveLength(2);
  });

  it('query filters by an exact-match where clause', async () => {
    const db = createInMemoryDbProvider();
    await db.insert('widgets', { id: 'w1', color: 'red' });
    await db.insert('widgets', { id: 'w2', color: 'blue' });
    const red = await db.query('widgets', { where: { color: 'red' } });
    expect(red.map((r) => r.id)).toEqual(['w1']);
  });

  it('query on an unknown collection returns []', async () => {
    const db = createInMemoryDbProvider();
    expect(await db.query('nope')).toEqual([]);
  });

  it('query where clause with multiple keys requires all to match', async () => {
    const db = createInMemoryDbProvider();
    await db.insert('widgets', { id: 'w1', color: 'red', size: 'm' });
    await db.insert('widgets', { id: 'w2', color: 'red', size: 'l' });
    const matched = await db.query('widgets', { where: { color: 'red', size: 'm' } });
    expect(matched.map((r) => r.id)).toEqual(['w1']);
  });
});
