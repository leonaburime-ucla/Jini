import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createNoteStore, type NoteChangeEvent, type NoteStore } from '../note-store.js';

const config = { validTypes: ['user', 'feedback', 'project'], defaultType: 'user' };

let dataDir: string;
let store: NoteStore;
let changes: NoteChangeEvent[];

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'jini-note-store-'));
  store = createNoteStore(config);
  changes = [];
  store.events.on('change', (e: NoteChangeEvent) => changes.push(e));
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

describe('createNoteStore', () => {
  it('dir() joins the configured subdir under dataDir, defaulting to "notes"', () => {
    expect(store.dir(dataDir)).toBe(join(dataDir, 'notes'));
    const customStore = createNoteStore({ ...config, subdir: 'memory' });
    expect(customStore.dir(dataDir)).toBe(join(dataDir, 'memory'));
  });

  describe('deriveId', () => {
    it('slugifies the name under the type prefix', () => {
      expect(store.deriveId('user', 'My Role!')).toBe('user_my_role');
    });

    it('treats a falsy name as an empty string before slugifying', () => {
      expect(store.deriveId('user', undefined as unknown as string)).toMatch(/^user_n[0-9a-z]+$/);
    });

    it('falls back to defaultType for an invalid type', () => {
      expect(store.deriveId('not-a-type', 'X')).toBe('user_x');
    });

    it('hashes a purely non-ASCII name deterministically instead of an empty slug', () => {
      const id = store.deriveId('user', '设计思路');
      expect(id).toMatch(/^user_n[0-9a-z]+$/);
      expect(store.deriveId('user', '设计思路')).toBe(id);
    });

    it('produces different hash ids for different non-ASCII names', () => {
      expect(store.deriveId('user', '设计思路')).not.toBe(store.deriveId('user', '视觉风格'));
    });
  });

  describe('config', () => {
    it('defaults to enabled when no config file exists', async () => {
      await expect(store.readConfig(dataDir)).resolves.toEqual({ enabled: true });
    });

    it('writes and reads back a config patch, emitting a config change only when it actually flips', async () => {
      await store.writeConfig(dataDir, { enabled: false });
      await expect(store.readConfig(dataDir)).resolves.toEqual({ enabled: false });
      expect(changes.filter((c) => c.kind === 'config')).toHaveLength(1);

      changes.length = 0;
      await store.writeConfig(dataDir, { enabled: false });
      expect(changes.filter((c) => c.kind === 'config')).toHaveLength(0);
    });

    it('leaves enabled unchanged when the patch omits it', async () => {
      await store.writeConfig(dataDir, { enabled: false });
      await store.writeConfig(dataDir, {});
      await expect(store.readConfig(dataDir)).resolves.toEqual({ enabled: false });
    });
  });

  describe('index', () => {
    it('returns the default index text when none has been written', async () => {
      const index = await store.readIndex(dataDir);
      expect(index).toContain('# Notes');
    });

    it('writes the index and emits an index change unless silent', async () => {
      await store.writeIndex(dataDir, 'custom index body');
      await expect(store.readIndex(dataDir)).resolves.toBe('custom index body');
      expect(changes.filter((c) => c.kind === 'index')).toHaveLength(1);

      changes.length = 0;
      await store.writeIndex(dataDir, 'again', { silent: true });
      expect(changes).toHaveLength(0);
    });
  });

  describe('entries', () => {
    it('upserts a new entry, deriving an id, and lists it', async () => {
      const entry = await store.upsertEntry(dataDir, { name: 'Role', description: 'desc', type: 'user', body: '- Role: engineer' });
      expect(entry.id).toBe('user_role');
      expect(entry.body.trim()).toBe('- Role: engineer');

      const list = await store.listEntries(dataDir);
      expect(list.map((e) => e.id)).toEqual(['user_role']);
      expect(changes.filter((c) => c.kind === 'upsert')).toHaveLength(1);
    });

    it('rejects an upsert missing a name or a valid type', async () => {
      await expect(store.upsertEntry(dataDir, { name: '', type: 'user' })).rejects.toThrow(/requires .name. and a valid .type./);
      await expect(store.upsertEntry(dataDir, { name: 'X', type: 'bogus' })).rejects.toThrow(/requires .name. and a valid .type./);
    });

    it('suppresses the change event when silent, and tags a custom source when provided', async () => {
      await store.upsertEntry(dataDir, { name: 'A', type: 'user' }, { silent: true });
      expect(changes.filter((c) => c.kind === 'upsert')).toHaveLength(0);

      await store.upsertEntry(dataDir, { name: 'B', type: 'user' }, { source: 'heuristic' });
      expect(changes.find((c) => c.kind === 'upsert')?.source).toBe('heuristic');
    });

    it('honors an explicit valid id instead of deriving one', async () => {
      const entry = await store.upsertEntry(dataDir, { id: 'user_custom', name: 'Custom', type: 'user' });
      expect(entry.id).toBe('user_custom');
    });

    it('falls back to a derived id when the supplied id is not a valid slug', async () => {
      const entry = await store.upsertEntry(dataDir, { id: 'Not Valid!', name: 'Fallback', type: 'user' });
      expect(entry.id).toBe('user_fallback');
    });

    it('readEntry returns null for a missing entry', async () => {
      await expect(store.readEntry(dataDir, 'user_missing')).resolves.toBeNull();
    });

    it('readEntry returns null for a syntactically invalid id rather than throwing', async () => {
      await expect(store.readEntry(dataDir, 'Not A Valid Id!')).resolves.toBeNull();
    });

    it('falls back to the id itself as the display name when the frontmatter name is blank', async () => {
      const fs = await import('node:fs/promises');
      const { mkdir, writeFile } = fs;
      await mkdir(store.dir(dataDir), { recursive: true });
      await writeFile(join(store.dir(dataDir), 'user_blank.md'), '---\nname: \ndescription: \ntype: user\n---\n\nbody\n');
      const entry = await store.readEntry(dataDir, 'user_blank');
      expect(entry?.name).toBe('user_blank');
    });

    it('surfaces the "failed to read after write" invariant if the entry file vanishes between write and read', async () => {
      const fs = await import('node:fs');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const originalReadFile: any = fs.promises.readFile;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const spy = vi.spyOn(fs.promises, 'readFile').mockImplementation(async (filePath: any, ...rest: any[]) => {
        if (typeof filePath === 'string' && filePath.endsWith('user_vanish.md')) {
          const err = new Error('ENOENT: simulated concurrent delete') as NodeJS.ErrnoException;
          err.code = 'ENOENT';
          throw err;
        }
        return originalReadFile(filePath, ...rest);
      });
      try {
        await expect(store.upsertEntry(dataDir, { id: 'user_vanish', name: 'Vanish', type: 'user' })).rejects.toThrow(
          /failed to read note entry after write/,
        );
      } finally {
        spy.mockRestore();
      }
    });

    it('defaults a stored type to defaultType when the frontmatter type is invalid or missing', async () => {
      await store.upsertEntry(dataDir, { name: 'A', type: 'user' });
      // Directly corrupt the file's type field to something invalid.
      const fs = await import('node:fs/promises');
      const filePath = join(store.dir(dataDir), 'user_a.md');
      const raw = await fs.readFile(filePath, 'utf8');
      await fs.writeFile(filePath, raw.replace('type: user', 'type: not-a-type'));
      const entry = await store.readEntry(dataDir, 'user_a');
      expect(entry?.type).toBe('user');
    });

    it('deletes an entry and removes its index line, tolerating a missing file', async () => {
      await store.upsertEntry(dataDir, { name: 'A', type: 'user' });
      await store.deleteEntry(dataDir, 'user_a');
      await expect(store.readEntry(dataDir, 'user_a')).resolves.toBeNull();
      expect((await store.readIndex(dataDir)).includes('user_a.md')).toBe(false);
      expect(changes.filter((c) => c.kind === 'delete')).toHaveLength(1);

      // Deleting again (file already gone) must not throw.
      await expect(store.deleteEntry(dataDir, 'user_a')).resolves.toBeUndefined();
    });

    it('listEntries returns [] when the store directory does not exist yet', async () => {
      await expect(store.listEntries(dataDir)).resolves.toEqual([]);
    });

    it('listEntries ignores the index file, non-.md files, and an invalid-id filename', async () => {
      await store.upsertEntry(dataDir, { name: 'A', type: 'user' });
      const fs = await import('node:fs/promises');
      await fs.writeFile(join(store.dir(dataDir), 'not-an-entry.txt'), 'x');
      await fs.writeFile(join(store.dir(dataDir), 'INVALID ID.md'), 'x');
      const list = await store.listEntries(dataDir);
      expect(list.map((e) => e.id)).toEqual(['user_a']);
    });

    it('listEntries skips a validly-named entry file that fails to read (e.g. a directory in its place)', async () => {
      await store.upsertEntry(dataDir, { name: 'A', type: 'user' });
      const fs = await import('node:fs/promises');
      // A directory named like an entry file: passes the .md/id checks but
      // fsp.readFile on it throws EISDIR, exercising the catch-and-skip path.
      await fs.mkdir(join(store.dir(dataDir), 'user_broken.md'));
      const list = await store.listEntries(dataDir);
      expect(list.map((e) => e.id)).toEqual(['user_a']);
    });

    it('listEntries sorts newest-updated first', async () => {
      await store.upsertEntry(dataDir, { name: 'First', type: 'user' });
      await new Promise((r) => setTimeout(r, 5));
      await store.upsertEntry(dataDir, { name: 'Second', type: 'user' });
      const list = await store.listEntries(dataDir);
      expect(list.map((e) => e.id)).toEqual(['user_second', 'user_first']);
    });
  });

  describe('listActiveEntries', () => {
    it('returns only entries linked in the index, excluding ones the user removed the bullet for', async () => {
      await store.upsertEntry(dataDir, { name: 'Kept', type: 'user' });
      await store.upsertEntry(dataDir, { name: 'Removed', type: 'user' });
      const index = await store.readIndex(dataDir);
      await store.writeIndex(dataDir, index.replace(/^- \[Removed\].*$/m, ''), { silent: true });

      const active = await store.listActiveEntries(dataDir);
      expect(active.map((e) => e.id)).toEqual(['user_kept']);
    });

    it('returns an empty list when the index links nothing', async () => {
      await store.upsertEntry(dataDir, { name: 'A', type: 'user' });
      await store.writeIndex(dataDir, '# Notes\n\nno links here\n', { silent: true });
      await expect(store.listActiveEntries(dataDir)).resolves.toEqual([]);
    });

    it('ignores a bulleted link that does not point at a .md file, and one pointing at the index itself', async () => {
      await store.upsertEntry(dataDir, { name: 'A', type: 'user' });
      const index = await store.readIndex(dataDir);
      await store.writeIndex(dataDir, `${index}\n- [Not markdown](readme.txt)\n- [Self](INDEX.md)\n`, { silent: true });
      const active = await store.listActiveEntries(dataDir);
      expect(active.map((e) => e.id)).toEqual(['user_a']);
    });
  });

  describe('index maintenance', () => {
    it('links a new entry with its description, and re-links (replaces) on a repeat upsert', async () => {
      await store.upsertEntry(dataDir, { name: 'A', description: 'first desc', type: 'user' });
      let index = await store.readIndex(dataDir);
      expect(index).toContain('- [A](user_a.md) — first desc');

      await store.upsertEntry(dataDir, { id: 'user_a', name: 'A', description: 'updated desc', type: 'user' });
      index = await store.readIndex(dataDir);
      expect(index).toContain('- [A](user_a.md) — updated desc');
      expect(index.match(/user_a\.md/g)).toHaveLength(1);
    });

    it('links an entry with no description without an em-dash suffix', async () => {
      await store.upsertEntry(dataDir, { name: 'NoDesc', type: 'user' });
      const index = await store.readIndex(dataDir);
      expect(index).toContain('- [NoDesc](user_nodesc.md)');
      expect(index).not.toContain('- [NoDesc](user_nodesc.md) —');
    });

    it('appends a blank separator line before a new bullet when the index does not already end with one', async () => {
      await store.writeIndex(dataDir, 'existing prose, no trailing blank line');
      await store.upsertEntry(dataDir, { name: 'A', type: 'user' });
      const index = await store.readIndex(dataDir);
      expect(index).toBe('existing prose, no trailing blank line\n\n- [A](user_a.md)');
    });
  });

  describe('updateTreeNode', () => {
    it('refuses to edit a folder node', async () => {
      await expect(store.updateTreeNode(dataDir, 'folder:user', {})).rejects.toThrow(/derived and cannot be edited/);
    });

    it('throws when the target entry does not exist', async () => {
      await expect(store.updateTreeNode(dataDir, 'user_missing', {})).rejects.toThrow(/not found/);
    });

    it('patches only the given fields, keeping the rest from the current entry', async () => {
      await store.upsertEntry(dataDir, { name: 'A', description: 'd', type: 'user', body: 'body' });
      const updated = await store.updateTreeNode(dataDir, 'user_a', { description: 'new-d' });
      expect(updated).toMatchObject({ name: 'A', description: 'new-d', type: 'user' });
      expect(updated.body.trim()).toBe('body');
    });

    it('falls back to the current name when the patch supplies a blank name, and to the current type when the patch type is invalid', async () => {
      await store.upsertEntry(dataDir, { name: 'A', type: 'user' });
      const updated = await store.updateTreeNode(dataDir, 'user_a', { name: '   ', type: 'bogus' });
      expect(updated.name).toBe('A');
      expect(updated.type).toBe('user');
    });

    it('accepts a valid type change', async () => {
      await store.upsertEntry(dataDir, { name: 'A', type: 'user' });
      const updated = await store.updateTreeNode(dataDir, 'user_a', { type: 'feedback' });
      expect(updated.type).toBe('feedback');
    });

    it('accepts a genuine non-blank name change', async () => {
      await store.upsertEntry(dataDir, { name: 'A', type: 'user' });
      const updated = await store.updateTreeNode(dataDir, 'user_a', { name: 'Renamed' });
      expect(updated.name).toBe('Renamed');
    });
  });

  describe('buildTree', () => {
    it('capitalize()s an empty-string type name to itself rather than throwing', async () => {
      const oddStore = createNoteStore({ validTypes: ['', 'user'], defaultType: 'user' });
      const tree = await oddStore.buildTree(dataDir);
      const blankFolder = tree.find((n) => n.id === 'folder:');
      expect(blankFolder).toMatchObject({ name: '', description: ' notes' });
    });

    it('groups an entry whose normalized type falls outside the configured folder list under an ungrouped bucket', async () => {
      // defaultType deliberately NOT a member of validTypes: an entry with a
      // corrupted/unrecognized type normalizes to defaultType, which is
      // outside the pre-seeded per-type buckets buildTree groups folders by.
      const oddStore = createNoteStore({ validTypes: ['user'], defaultType: 'unrouted' });
      await oddStore.upsertEntry(dataDir, { name: 'A', type: 'user' });
      const fs = await import('node:fs/promises');
      const filePath = join(oddStore.dir(dataDir), 'user_a.md');
      const raw = await fs.readFile(filePath, 'utf8');
      await fs.writeFile(filePath, raw.replace('type: user', 'type: not-a-real-type'));

      const tree = await oddStore.buildTree(dataDir);
      // Only one folder ('user') is declared; the ungrouped entry does not
      // appear as a folder child anywhere, but buildTree still completes
      // without throwing (the fallback in the entries-grouping loop).
      expect(tree.filter((n) => n.kind === 'folder')).toHaveLength(1);
      expect(tree.some((n) => n.id === 'user_a')).toBe(false);
    });

    it('produces one folder node per configured type plus one entry node per stored entry', async () => {
      await store.upsertEntry(dataDir, { name: 'A', description: 'a-desc', type: 'user' });
      await store.upsertEntry(dataDir, { name: 'B', type: 'feedback' });
      const tree = await store.buildTree(dataDir);

      const folders = tree.filter((n) => n.kind === 'folder');
      expect(folders.map((f) => f.id)).toEqual(['folder:user', 'folder:feedback', 'folder:project']);
      expect(folders.find((f) => f.id === 'folder:user')?.childrenCount).toBe(1);
      expect(folders.find((f) => f.id === 'folder:project')?.childrenCount).toBe(0);

      const entryNode = tree.find((n) => n.id === 'user_a');
      expect(entryNode).toMatchObject({ parentId: 'folder:user', path: '/user/user_a', name: 'A', description: 'a-desc', kind: 'entry' });
    });
  });
});
