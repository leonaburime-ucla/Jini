import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createFakeResourceBoardDependencies,
  createFakeResourceBoardPort,
  createFakeResourceRowListDependencies,
  createFakeResourceRowListPort,
  createLocalStorageViewModeStorage,
} from './dependencies.js';
import type { ResourceBoardItem, ResourceRowItem } from './types.js';

function makeItem(overrides: Partial<ResourceBoardItem> = {}): ResourceBoardItem {
  return { id: 'i1', title: 'Item one', ...overrides };
}

function makeRow(overrides: Partial<ResourceRowItem> = {}): ResourceRowItem {
  return { id: 'r1', title: 'Row one', actions: [], ...overrides };
}

describe('createFakeResourceBoardPort', () => {
  it('fetches a snapshot array (mutating the returned array does not affect the store)', async () => {
    const port = createFakeResourceBoardPort({ items: [makeItem()] });
    const fetched = await port.fetchItems();
    expect(fetched).toEqual([makeItem()]);
    fetched.pop();
    expect(await port.fetchItems()).toEqual([makeItem()]);
  });

  it('starts empty when no items are seeded', async () => {
    const port = createFakeResourceBoardPort();
    expect(await port.fetchItems()).toEqual([]);
  });

  it('renames an item', async () => {
    const port = createFakeResourceBoardPort({ items: [makeItem()] });
    const renamed = await port.renameItem!('i1', 'New title');
    expect(renamed?.title).toBe('New title');
    expect((await port.fetchItems())[0]!.title).toBe('New title');
  });

  it('renameItem returns null for an unknown id', async () => {
    const port = createFakeResourceBoardPort({ items: [makeItem()] });
    expect(await port.renameItem!('nope', 'x')).toBeNull();
  });

  it('duplicates an item with a default id/title transform', async () => {
    const port = createFakeResourceBoardPort({ items: [makeItem()] });
    const duplicate = await port.duplicateItem!('i1');
    expect(duplicate).toEqual({ id: 'i1-copy', title: 'Item one copy' });
    expect(await port.fetchItems()).toHaveLength(2);
  });

  it('duplicates using a host-supplied onDuplicate transform', async () => {
    const port = createFakeResourceBoardPort({
      items: [makeItem()],
      onDuplicate: (item) => ({ ...item, id: 'custom-id', title: `${item.title} (dup)` }),
    });
    const duplicate = await port.duplicateItem!('i1');
    expect(duplicate).toEqual({ id: 'custom-id', title: 'Item one (dup)' });
  });

  it('duplicateItem returns null for an unknown id', async () => {
    const port = createFakeResourceBoardPort({ items: [makeItem()] });
    expect(await port.duplicateItem!('nope')).toBeNull();
  });

  it('deletes an item', async () => {
    const port = createFakeResourceBoardPort({ items: [makeItem()] });
    expect(await port.deleteItem('i1')).toBe(true);
    expect(await port.fetchItems()).toEqual([]);
  });

  it('deleteItem returns false for an unknown id', async () => {
    const port = createFakeResourceBoardPort({ items: [makeItem()] });
    expect(await port.deleteItem('nope')).toBe(false);
  });

  it('omits renameItem/duplicateItem when disabled', async () => {
    const port = createFakeResourceBoardPort({ items: [makeItem()], supportsRename: false, supportsDuplicate: false });
    expect(port.renameItem).toBeUndefined();
    expect(port.duplicateItem).toBeUndefined();
  });

  it('resolves after the configured latency', async () => {
    vi.useFakeTimers();
    const port = createFakeResourceBoardPort({ items: [makeItem()], latencyMs: 50 });
    const promise = port.fetchItems();
    let resolved = false;
    void promise.then(() => {
      resolved = true;
    });
    await vi.advanceTimersByTimeAsync(49);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(resolved).toBe(true);
    vi.useRealTimers();
  });
});

describe('createFakeResourceBoardDependencies', () => {
  it('wraps a fake port', async () => {
    const deps = createFakeResourceBoardDependencies({ items: [makeItem()] });
    expect(await deps.port.fetchItems()).toEqual([makeItem()]);
  });
});

describe('createLocalStorageViewModeStorage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns null when nothing is stored', () => {
    const storage = createLocalStorageViewModeStorage();
    expect(storage.getViewMode('scope-a')).toBeNull();
  });

  it('round-trips a stored view mode, scoped by key', () => {
    const storage = createLocalStorageViewModeStorage();
    storage.setViewMode('scope-a', 'kanban');
    storage.setViewMode('scope-b', 'grid');
    expect(storage.getViewMode('scope-a')).toBe('kanban');
    expect(storage.getViewMode('scope-b')).toBe('grid');
  });

  it('treats a corrupted/unexpected stored value as null', () => {
    window.localStorage.setItem('scope-a', 'not-a-view-mode');
    const storage = createLocalStorageViewModeStorage();
    expect(storage.getViewMode('scope-a')).toBeNull();
  });

  describe('when window is unavailable (SSR)', () => {
    const originalWindow = globalThis.window;

    beforeEach(() => {
      // @ts-expect-error -- simulating an SSR environment for this block only
      delete globalThis.window;
    });

    afterEach(() => {
      globalThis.window = originalWindow;
    });

    it('getViewMode returns null without touching storage', () => {
      const storage = createLocalStorageViewModeStorage();
      expect(storage.getViewMode('scope-a')).toBeNull();
    });

    it('setViewMode is a no-op', () => {
      const storage = createLocalStorageViewModeStorage();
      expect(() => storage.setViewMode('scope-a', 'grid')).not.toThrow();
    });
  });

  it('swallows a storage write failure (quota/private-mode)', () => {
    const storage = createLocalStorageViewModeStorage();
    const spy = vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(() => storage.setViewMode('scope-a', 'grid')).not.toThrow();
    spy.mockRestore();
  });

  it('swallows a storage read failure', () => {
    const storage = createLocalStorageViewModeStorage();
    const spy = vi.spyOn(window.localStorage.__proto__, 'getItem').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(storage.getViewMode('scope-a')).toBeNull();
    spy.mockRestore();
  });
});

describe('createFakeResourceRowListPort', () => {
  it('fetches a snapshot copy of the seeded rows', async () => {
    const port = createFakeResourceRowListPort({ rows: [makeRow()] });
    const fetched = await port.fetchRows();
    expect(fetched).toEqual([makeRow()]);
  });

  it('starts empty when no rows are seeded', async () => {
    const port = createFakeResourceRowListPort();
    expect(await port.fetchRows()).toEqual([]);
  });

  it('fetches per-row history, defaulting to empty for a row with none configured', async () => {
    const port = createFakeResourceRowListPort({
      rows: [makeRow()],
      historyByRowId: { r1: [{ id: 'run-1', status: 'succeeded', startedAtLabel: 'today' }] },
    });
    expect(await port.fetchRowHistory!('r1')).toEqual([{ id: 'run-1', status: 'succeeded', startedAtLabel: 'today' }]);
    expect(await port.fetchRowHistory!('unknown-row')).toEqual([]);
  });

  it('omits fetchRowHistory when disabled', () => {
    const port = createFakeResourceRowListPort({ supportsHistory: false });
    expect(port.fetchRowHistory).toBeUndefined();
  });

  it('resolves after the configured latency', async () => {
    vi.useFakeTimers();
    const port = createFakeResourceRowListPort({ rows: [makeRow()], latencyMs: 30 });
    const promise = port.fetchRows();
    let resolved = false;
    void promise.then(() => {
      resolved = true;
    });
    await vi.advanceTimersByTimeAsync(29);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(resolved).toBe(true);
    vi.useRealTimers();
  });
});

describe('createFakeResourceRowListDependencies', () => {
  it('wraps a fake port', async () => {
    const deps = createFakeResourceRowListDependencies({ rows: [makeRow()] });
    expect(await deps.port.fetchRows()).toEqual([makeRow()]);
  });
});
