import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { StaticRegistryBackend } from '../static-backend.js';
import { DatabaseRegistryBackend, ensureRegistryTables, upsertRegistryEntry } from '../database-backend.js';

const entry = {
  name: 'vendor/example',
  title: 'Example',
  description: 'Searchable fixture entry',
  version: '1.1.0',
  source: 'github:vendor/example@v1.1.0/entry',
  versions: [
    { version: '1.0.0', source: 'github:vendor/example@v1.0.0/entry' },
    { version: '1.1.0', source: 'github:vendor/example@v1.1.0/entry' },
  ],
  distTags: { latest: '1.1.0' },
};

let db: Database.Database;

beforeEach(() => {
  db = new Database(':memory:');
});

afterEach(() => {
  db.close();
});

describe('DatabaseRegistryBackend', () => {
  it('defaults trust to restricted and creates the table on construction', async () => {
    const backend = new DatabaseRegistryBackend({ id: 'fixture', db });
    expect(backend.kind).toBe('db');
    expect(backend.trust).toBe('restricted');
    await expect(backend.list()).resolves.toEqual([]);
  });

  it('keeps behavior equivalent to a static backend seeded with the same entries', async () => {
    const staticBackend = new StaticRegistryBackend({
      id: 'fixture',
      trust: 'trusted',
      manifest: { specVersion: '1.0.0', name: 'fixture', version: '1.0.0', entries: [entry] },
    });
    ensureRegistryTables(db);
    for (const e of await staticBackend.list()) {
      upsertRegistryEntry(db, 'fixture', e, 123);
    }
    const databaseBackend = new DatabaseRegistryBackend({ id: 'fixture', trust: 'trusted', db });

    await expect(databaseBackend.list()).resolves.toEqual(await staticBackend.list());
    await expect(databaseBackend.search({ query: 'Searchable' })).resolves.toMatchObject([{ entry: { name: 'vendor/example' } }]);
    await expect(databaseBackend.resolve('vendor/example')).resolves.toMatchObject({ source: entry.source });
  });

  it('publish upserts the row and returns db:// changed-file paths', async () => {
    const backend = new DatabaseRegistryBackend({ id: 'fixture', db });
    const outcome = await backend.publish?.({ entry });
    expect(outcome).toMatchObject({
      ok: true,
      dryRun: false,
      changedFiles: ['db://fixture/entries/vendor/example', 'db://fixture/entries/vendor/example/versions/1.1.0'],
    });
    await expect(backend.list()).resolves.toHaveLength(1);
  });

  it('publish called twice for the same name upserts (does not duplicate rows)', async () => {
    const backend = new DatabaseRegistryBackend({ id: 'fixture', db });
    await backend.publish?.({ entry });
    await backend.publish?.({ entry: { ...entry, version: '1.2.0', source: 's-1.2.0' } });
    const list = await backend.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.version).toBe('1.2.0');
  });

  it('yank returns ok:false with a warning when the entry does not exist', async () => {
    const backend = new DatabaseRegistryBackend({ id: 'fixture', db });
    const outcome = await backend.yank?.('vendor/missing', '1.0.0', 'security issue');
    expect(outcome).toMatchObject({ ok: false, warnings: ['vendor/missing not found'] });
  });

  it('yank marks the specific version record yanked and, when it is the top version, the entry itself', async () => {
    const backend = new DatabaseRegistryBackend({ id: 'fixture', db });
    await backend.publish?.({ entry });
    const outcome = await backend.yank?.('vendor/example', '1.1.0', 'security issue');
    expect(outcome).toMatchObject({ ok: true, name: 'vendor/example', version: '1.1.0', reason: 'security issue' });

    const row = db.prepare('SELECT entry_json FROM registry_entries WHERE backend_id = ? AND name = ?').get('fixture', 'vendor/example') as { entry_json: string };
    const stored = JSON.parse(row.entry_json);
    expect(stored.yanked).toBe(true);
    expect(stored.yankReason).toBe('security issue');
    expect(stored.versions.find((v: { version: string }) => v.version === '1.1.0').yanked).toBe(true);
  });

  it('yank on a non-top version marks only that version record, leaving the entry itself un-yanked', async () => {
    const backend = new DatabaseRegistryBackend({ id: 'fixture', db });
    await backend.publish?.({ entry });
    await backend.yank?.('vendor/example', '1.0.0', 'superseded');

    const row = db.prepare('SELECT entry_json FROM registry_entries WHERE backend_id = ? AND name = ?').get('fixture', 'vendor/example') as { entry_json: string };
    const stored = JSON.parse(row.entry_json);
    expect(stored.yanked).toBeUndefined();
    expect(stored.versions.find((v: { version: string }) => v.version === '1.0.0').yanked).toBe(true);
    expect(stored.versions.find((v: { version: string }) => v.version === '1.1.0').yanked).toBeUndefined();
  });

  it('yank falls back to a synthetic single-version list when the stored entry has no versions array', async () => {
    const backend = new DatabaseRegistryBackend({ id: 'fixture', db });
    const bare = { name: 'vendor/bare', version: '1.0.0', source: 's' };
    await backend.publish?.({ entry: bare });
    const outcome = await backend.yank?.('vendor/bare', '1.0.0', 'security issue');
    expect(outcome).toMatchObject({ ok: true });

    const row = db.prepare('SELECT entry_json FROM registry_entries WHERE backend_id = ? AND name = ?').get('fixture', 'vendor/bare') as { entry_json: string };
    const stored = JSON.parse(row.entry_json);
    expect(stored.yanked).toBe(true);
  });
});
