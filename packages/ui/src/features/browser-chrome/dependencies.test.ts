import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createBrowserHistoryStorage,
  createDefaultBrowserChromeDependencies,
  createNoopBrowserBridgeRegistration,
} from './dependencies.js';
import type { BrowserHistoryEntry } from './types.js';

describe('createBrowserHistoryStorage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns [] when nothing is stored', () => {
    const storage = createBrowserHistoryStorage();
    expect(storage.loadHistory('scope-1')).toEqual([]);
  });

  it('round-trips a saved history under a namespaced key', () => {
    const storage = createBrowserHistoryStorage({ namespace: 'test:ns' });
    const history: BrowserHistoryEntry[] = [{ title: 'A', url: 'https://a.com', lastVisitedAt: 1, visitCount: 1 }];
    storage.saveHistory('scope-1', history);
    expect(window.localStorage.getItem('test:ns:scope-1')).not.toBeNull();
    expect(storage.loadHistory('scope-1')).toEqual(history);
  });

  it('keeps different scope keys isolated', () => {
    const storage = createBrowserHistoryStorage({ namespace: 'test:ns' });
    storage.saveHistory('scope-a', [{ title: 'A', url: 'https://a.com', lastVisitedAt: 1, visitCount: 1 }]);
    expect(storage.loadHistory('scope-b')).toEqual([]);
  });

  it('swallows a quota/serialization failure on save rather than throwing', () => {
    const storage = createBrowserHistoryStorage();
    const setItemSpy = vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => storage.saveHistory('scope-1', [])).not.toThrow();
    setItemSpy.mockRestore();
  });

  it('returns [] when the stored payload is corrupt rather than throwing', () => {
    const storage = createBrowserHistoryStorage({ namespace: 'test:ns' });
    window.localStorage.setItem('test:ns:scope-1', 'not json');
    expect(storage.loadHistory('scope-1')).toEqual([]);
  });

  it('returns [] rather than throwing when localStorage.getItem itself throws (e.g. private-mode access restrictions)', () => {
    const storage = createBrowserHistoryStorage();
    const getItemSpy = vi.spyOn(window.localStorage.__proto__, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => storage.loadHistory('scope-1')).not.toThrow();
    expect(storage.loadHistory('scope-1')).toEqual([]);
    getItemSpy.mockRestore();
  });
});

describe('createBrowserHistoryStorage — SSR guard', () => {
  it('returns [] and no-ops save when window is unavailable', () => {
    const originalWindow = globalThis.window;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).window;
    try {
      const storage = createBrowserHistoryStorage();
      expect(storage.loadHistory('scope-1')).toEqual([]);
      expect(() => storage.saveHistory('scope-1', [])).not.toThrow();
    } finally {
      globalThis.window = originalWindow;
    }
  });
});

describe('createNoopBrowserBridgeRegistration', () => {
  it('is callable and does nothing observable', () => {
    const port = createNoopBrowserBridgeRegistration();
    expect(() => port.registerBrowserHandle('scope-1', null)).not.toThrow();
  });
});

describe('createDefaultBrowserChromeDependencies', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('wires a real history storage and a no-op bridge registration', () => {
    const deps = createDefaultBrowserChromeDependencies({ historyNamespace: 'test:default' });
    deps.historyStorage.saveHistory('s', [{ title: 'A', url: 'https://a.com', lastVisitedAt: 1, visitCount: 1 }]);
    expect(deps.historyStorage.loadHistory('s')).toHaveLength(1);
    expect(() => deps.bridgeRegistration.registerBrowserHandle('s', null)).not.toThrow();
  });
});
