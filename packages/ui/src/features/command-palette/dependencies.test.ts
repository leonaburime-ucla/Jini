import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLocalStorageRecents } from './dependencies.js';

describe('createLocalStorageRecents', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns [] when nothing is stored', () => {
    const recents = createLocalStorageRecents();
    expect(recents.read('scope-1')).toEqual([]);
  });

  it('round-trips a pushed id under a namespaced key', () => {
    const recents = createLocalStorageRecents({ namespace: 'test:ns' });
    recents.push('scope-1', 'file-a');
    expect(window.localStorage.getItem('test:ns:scope-1')).not.toBeNull();
    expect(recents.read('scope-1')).toEqual(['file-a']);
  });

  it('keeps different scope keys isolated', () => {
    const recents = createLocalStorageRecents({ namespace: 'test:ns' });
    recents.push('scope-a', 'x');
    expect(recents.read('scope-b')).toEqual([]);
  });

  it('de-duplicates and caps at the configured limit across pushes', () => {
    const recents = createLocalStorageRecents({ namespace: 'test:ns', limit: 2 });
    recents.push('s', 'a');
    recents.push('s', 'b');
    recents.push('s', 'a');
    recents.push('s', 'c');
    expect(recents.read('s')).toEqual(['c', 'a']);
  });

  it('swallows a quota/serialization failure on push rather than throwing', () => {
    const recents = createLocalStorageRecents();
    const setItemSpy = vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => recents.push('scope-1', 'x')).not.toThrow();
    setItemSpy.mockRestore();
  });

  it('returns [] when the stored payload is corrupt rather than throwing', () => {
    const recents = createLocalStorageRecents({ namespace: 'test:ns' });
    window.localStorage.setItem('test:ns:scope-1', 'not json');
    expect(recents.read('scope-1')).toEqual([]);
  });

  it('returns [] rather than throwing when localStorage.getItem itself throws', () => {
    const recents = createLocalStorageRecents();
    const getItemSpy = vi.spyOn(window.localStorage.__proto__, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => recents.read('scope-1')).not.toThrow();
    expect(recents.read('scope-1')).toEqual([]);
    getItemSpy.mockRestore();
  });

  it('defaults the namespace and limit when no options are supplied', () => {
    const recents = createLocalStorageRecents();
    recents.push('s', 'a');
    expect(window.localStorage.getItem('jini:command-palette:recents:s')).not.toBeNull();
  });
});

describe('createLocalStorageRecents — SSR guard', () => {
  it('returns [] and no-ops push when window is unavailable', () => {
    const originalWindow = globalThis.window;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).window;
    try {
      const recents = createLocalStorageRecents();
      expect(recents.read('scope-1')).toEqual([]);
      expect(() => recents.push('scope-1', 'x')).not.toThrow();
    } finally {
      globalThis.window = originalWindow;
    }
  });
});
