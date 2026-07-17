import { describe, expect, it } from 'vitest';
import {
  canGoBack,
  canGoForward,
  faviconUrl,
  formatAddressDisplay,
  formatAddressDisplayParts,
  historyStorageKey,
  hostnameFromUrl,
  initialNavigationState,
  isHistoryEntry,
  isHistoryUrl,
  labelFromUrl,
  mergeHistoryEntry,
  normalizeBrowserAddress,
  parseHistoryPayload,
  recordNavigation,
  resolveNavigationHistoryDelta,
  sameUrl,
  serializeHistoryPayload,
  updateCurrentNavigationTitle,
} from './rules.js';
import { EMPTY_URL, HISTORY_LIMIT } from './constants.js';
import type { BrowserHistoryEntry, BrowserNavigationState } from './types.js';

describe('normalizeBrowserAddress', () => {
  it('returns EMPTY_URL for blank input', () => {
    expect(normalizeBrowserAddress('')).toBe(EMPTY_URL);
    expect(normalizeBrowserAddress('   ')).toBe(EMPTY_URL);
    expect(normalizeBrowserAddress(EMPTY_URL)).toBe(EMPTY_URL);
  });

  it('passes through http(s)/file URLs unchanged', () => {
    expect(normalizeBrowserAddress('https://example.com')).toBe('https://example.com');
    expect(normalizeBrowserAddress('http://example.com')).toBe('http://example.com');
    expect(normalizeBrowserAddress('file:///tmp/x.html')).toBe('file:///tmp/x.html');
  });

  it('adds http:// for localhost and loopback addresses', () => {
    expect(normalizeBrowserAddress('localhost:3000')).toBe('http://localhost:3000');
    expect(normalizeBrowserAddress('127.0.0.1:8080/x')).toBe('http://127.0.0.1:8080/x');
    expect(normalizeBrowserAddress('0.0.0.0')).toBe('http://0.0.0.0');
  });

  it('falls back to file:// for a bare absolute path with no app-route match configured', () => {
    expect(normalizeBrowserAddress('/some/local/path')).toBe(`file://${encodeURI('/some/local/path')}`);
  });

  it('resolves an absolute path against appOrigin when it matches an appRoutePrefixes entry', () => {
    const result = normalizeBrowserAddress('/api/widgets', {
      appOrigin: 'https://host.example',
      appRoutePrefixes: ['api', 'artifacts'],
    });
    expect(result).toBe('https://host.example/api/widgets');
  });

  it('does not resolve against appOrigin when the path does not match a configured prefix', () => {
    const result = normalizeBrowserAddress('/other/path', {
      appOrigin: 'https://host.example',
      appRoutePrefixes: ['api'],
    });
    expect(result).toBe(`file://${encodeURI('/other/path')}`);
  });

  it('adds https:// for bare domains', () => {
    expect(normalizeBrowserAddress('example.com')).toBe('https://example.com');
    expect(normalizeBrowserAddress('sub.example.co/path')).toBe('https://sub.example.co/path');
  });

  it('falls back to a Google search for anything else', () => {
    expect(normalizeBrowserAddress('best design tools')).toBe(
      `https://www.google.com/search?q=${encodeURIComponent('best design tools')}`,
    );
  });
});

describe('labelFromUrl', () => {
  it('returns the home label for the empty URL', () => {
    expect(labelFromUrl(EMPTY_URL)).toBe('New Tab');
    expect(labelFromUrl(EMPTY_URL, 'Home')).toBe('Home');
  });

  it('strips www. from the hostname', () => {
    expect(labelFromUrl('https://www.example.com/path')).toBe('example.com');
  });

  it('returns the raw value for an unparsable URL', () => {
    expect(labelFromUrl('not a url')).toBe('not a url');
  });
});

describe('formatAddressDisplayParts / formatAddressDisplay', () => {
  it('returns an empty url for the empty URL', () => {
    expect(formatAddressDisplayParts(EMPTY_URL)).toEqual({ url: '' });
    expect(formatAddressDisplay(EMPTY_URL)).toBe('');
  });

  it('omits the title when it matches the hostname fallback', () => {
    expect(formatAddressDisplayParts('https://example.com/', 'example.com')).toEqual({ url: 'https://example.com/' });
  });

  it('keeps a distinct title, trimming a trailing slash from the url', () => {
    expect(formatAddressDisplayParts('https://example.com/', 'Example Site')).toEqual({
      url: 'https://example.com',
      title: 'Example Site',
    });
    expect(formatAddressDisplay('https://example.com/', 'Example Site')).toBe('https://example.com / Example Site');
  });
});

describe('hostnameFromUrl / sameUrl / isHistoryUrl / faviconUrl', () => {
  it('extracts a www-stripped hostname', () => {
    expect(hostnameFromUrl('https://www.example.com/a/b')).toBe('example.com');
    expect(hostnameFromUrl('not a url')).toBe('not a url');
  });

  it('compares urls ignoring trailing slashes', () => {
    expect(sameUrl('https://example.com/', 'https://example.com')).toBe(true);
    expect(sameUrl('https://example.com/a', 'https://example.com/b')).toBe(false);
  });

  it('classifies history-worthy urls', () => {
    expect(isHistoryUrl('https://example.com')).toBe(true);
    expect(isHistoryUrl('file:///a.html')).toBe(true);
    expect(isHistoryUrl(EMPTY_URL)).toBe(false);
    expect(isHistoryUrl('not-a-url')).toBe(false);
  });

  it('builds a favicon url only for http(s) urls', () => {
    expect(faviconUrl('https://example.com/page')).toBe('https://example.com/favicon.ico');
    expect(faviconUrl('file:///a.html')).toBeUndefined();
    expect(faviconUrl('not a url')).toBeUndefined();
  });
});

describe('isHistoryEntry', () => {
  it('accepts a well-formed entry', () => {
    const entry: BrowserHistoryEntry = { title: 'A', url: 'https://a.com', lastVisitedAt: 1, visitCount: 1 };
    expect(isHistoryEntry(entry)).toBe(true);
    expect(isHistoryEntry({ ...entry, iconUrl: 'https://a.com/i.png' })).toBe(true);
  });

  it('rejects malformed values', () => {
    expect(isHistoryEntry(null)).toBe(false);
    expect(isHistoryEntry([])).toBe(false);
    expect(isHistoryEntry({ title: 'A' })).toBe(false);
    expect(isHistoryEntry({ title: 'A', url: 'x', lastVisitedAt: 'x', visitCount: 1 })).toBe(false);
  });
});

describe('historyStorageKey / parseHistoryPayload / serializeHistoryPayload', () => {
  it('namespaces by scope key', () => {
    expect(historyStorageKey('jini:browser-chrome:history', 'project-1')).toBe('jini:browser-chrome:history:project-1');
  });

  it('round-trips a history list, sorted by most-recent-first and capped at the limit', () => {
    const history: BrowserHistoryEntry[] = [
      { title: 'A', url: 'https://a.com', lastVisitedAt: 1, visitCount: 1 },
      { title: 'B', url: 'https://b.com', lastVisitedAt: 5, visitCount: 2 },
    ];
    const raw = serializeHistoryPayload(history);
    expect(parseHistoryPayload(raw)).toEqual([history[1], history[0]]);
  });

  it('caps at the given limit', () => {
    const history: BrowserHistoryEntry[] = Array.from({ length: 5 }, (_, i) => ({
      title: `E${i}`,
      url: `https://e${i}.com`,
      lastVisitedAt: i,
      visitCount: 1,
    }));
    expect(parseHistoryPayload(serializeHistoryPayload(history, 5), 3)).toHaveLength(3);
  });

  it('returns [] for malformed JSON or a non-array payload', () => {
    expect(parseHistoryPayload('not json')).toEqual([]);
    expect(parseHistoryPayload(JSON.stringify({ not: 'an array' }))).toEqual([]);
  });

  it('drops entries that fail the isHistoryEntry shape check', () => {
    const raw = JSON.stringify([{ title: 'A', url: 'https://a.com', lastVisitedAt: 1, visitCount: 1 }, { bogus: true }]);
    expect(parseHistoryPayload(raw)).toHaveLength(1);
  });
});

describe('mergeHistoryEntry', () => {
  it('inserts a new entry at the front', () => {
    const result = mergeHistoryEntry([], 'https://a.com', { title: 'A Site' }, {}, 100);
    expect(result).toEqual([{ title: 'A Site', url: 'https://a.com', lastVisitedAt: 100, visitCount: 1, iconUrl: 'https://a.com/favicon.ico' }]);
  });

  it('bumps an existing entry to the front and increments visitCount', () => {
    const existing: BrowserHistoryEntry[] = [
      { title: 'B', url: 'https://b.com', lastVisitedAt: 1, visitCount: 1 },
      { title: 'A', url: 'https://a.com', lastVisitedAt: 2, visitCount: 3 },
    ];
    const result = mergeHistoryEntry(existing, 'https://b.com', {}, {}, 500);
    expect(result[0]).toMatchObject({ url: 'https://b.com', lastVisitedAt: 500, visitCount: 2 });
    expect(result[1]).toMatchObject({ url: 'https://a.com' });
  });

  it('does not bump lastVisitedAt/visitCount when countVisit is false', () => {
    const existing: BrowserHistoryEntry[] = [{ title: 'A', url: 'https://a.com', lastVisitedAt: 10, visitCount: 1 }];
    const result = mergeHistoryEntry(existing, 'https://a.com', { title: 'Renamed' }, { countVisit: false }, 999);
    expect(result[0]).toMatchObject({ lastVisitedAt: 10, visitCount: 1, title: 'Renamed' });
  });

  it('returns the same array reference when nothing changed', () => {
    const existing: BrowserHistoryEntry[] = [{ title: 'A', url: 'https://a.com', lastVisitedAt: 10, visitCount: 1, iconUrl: 'https://a.com/favicon.ico' }];
    const result = mergeHistoryEntry(existing, 'https://a.com', { title: 'A' }, { countVisit: false }, 999);
    expect(result).toBe(existing);
  });

  it('ignores non-history urls (e.g. about:blank)', () => {
    expect(mergeHistoryEntry([], EMPTY_URL)).toEqual([]);
  });

  it('drops an invalid iconUrl meta value in favor of the favicon fallback', () => {
    const result = mergeHistoryEntry([], 'https://a.com', { iconUrl: 'javascript:alert(1)' }, {}, 1);
    expect(result[0]?.iconUrl).toBe('https://a.com/favicon.ico');
  });
});

describe('navigation stack', () => {
  it('initialNavigationState seeds a home entry for an empty/absent url', () => {
    expect(initialNavigationState()).toEqual({
      addressValue: '',
      navigationIndex: 0,
      navigationStack: [{ title: 'New Tab', url: EMPTY_URL }],
      url: EMPTY_URL,
    });
  });

  it('initialNavigationState seeds a real entry for a valid initial url', () => {
    expect(initialNavigationState('https://example.com', 'Example')).toEqual({
      addressValue: 'https://example.com',
      navigationIndex: 0,
      navigationStack: [{ title: 'Example', url: 'https://example.com' }],
      url: 'https://example.com',
    });
  });

  it('recordNavigation appends a new entry and truncates forward history', () => {
    let state: BrowserNavigationState = { navigationStack: [{ title: 'Home', url: EMPTY_URL }], navigationIndex: 0 };
    state = recordNavigation(state, 'https://a.com', 'A');
    state = recordNavigation(state, 'https://b.com', 'B');
    expect(state.navigationStack.map((e) => e.url)).toEqual([EMPTY_URL, 'https://a.com', 'https://b.com']);
    expect(state.navigationIndex).toBe(2);

    // Going back then navigating somewhere new truncates the forward entry.
    const back = resolveNavigationHistoryDelta(state, -1)!;
    state = recordNavigation(back.state, 'https://c.com', 'C');
    expect(state.navigationStack.map((e) => e.url)).toEqual([EMPTY_URL, 'https://a.com', 'https://c.com']);
  });

  it('recordNavigation updates the current entry in place for the same url', () => {
    let state: BrowserNavigationState = { navigationStack: [{ title: 'A', url: 'https://a.com' }], navigationIndex: 0 };
    state = recordNavigation(state, 'https://a.com/', 'A renamed');
    expect(state.navigationStack).toEqual([{ title: 'A renamed', url: 'https://a.com/' }]);
  });

  it('recordNavigation rejoins an adjacent back/forward entry instead of duplicating it', () => {
    const state: BrowserNavigationState = {
      navigationStack: [{ title: 'A', url: 'https://a.com' }, { title: 'B', url: 'https://b.com' }],
      navigationIndex: 1,
    };
    const back = resolveNavigationHistoryDelta(state, -1)!;
    const result = recordNavigation(back.state, 'https://a.com');
    expect(result.navigationStack).toHaveLength(2);
    expect(result.navigationIndex).toBe(0);
  });

  it('recordNavigation rejoins the previous-index entry when its url matches, without going through resolveNavigationHistoryDelta first', () => {
    // Full 3-entry stack, current pointer sitting on the last entry (as if the
    // host's webview already rendered B) — a navigation event now reports a
    // url matching the entry one BEHIND the pointer (A), which should move the
    // pointer back onto A in place, not push a 4th stack entry.
    const state: BrowserNavigationState = {
      navigationStack: [
        { title: 'Home', url: EMPTY_URL },
        { title: 'A', url: 'https://a.com' },
        { title: 'B', url: 'https://b.com' },
      ],
      navigationIndex: 2,
    };
    const result = recordNavigation(state, 'https://a.com', 'A renamed');
    expect(result.navigationStack).toHaveLength(3);
    expect(result.navigationIndex).toBe(1);
    expect(result.navigationStack[1]).toEqual({ title: 'A renamed', url: 'https://a.com' });
    // B (the entry that was current before this rejoin) survives untouched —
    // this is an in-place pointer move, not a truncation.
    expect(result.navigationStack[2]).toEqual({ title: 'B', url: 'https://b.com' });
  });

  it('recordNavigation rejoins the next-index entry when its url matches (e.g. navigating forward again after an out-of-band back)', () => {
    // Pointer sitting on Home (index 0) with the forward stack still intact —
    // as if the host went back once — and a navigation event now reports a
    // url matching the entry one AHEAD of the pointer (A). This should move
    // the pointer forward onto that same entry in place, not truncate B off
    // the stack the way a brand-new navigation to A would.
    const state: BrowserNavigationState = {
      navigationStack: [
        { title: 'Home', url: EMPTY_URL },
        { title: 'A', url: 'https://a.com' },
        { title: 'B', url: 'https://b.com' },
      ],
      navigationIndex: 0,
    };
    const result = recordNavigation(state, 'https://a.com', 'A renamed');
    expect(result.navigationStack).toHaveLength(3);
    expect(result.navigationIndex).toBe(1);
    expect(result.navigationStack[1]).toEqual({ title: 'A renamed', url: 'https://a.com' });
    expect(result.navigationStack[2]).toEqual({ title: 'B', url: 'https://b.com' });
  });

  it('recordNavigation replaces the current entry in place when replacePendingTarget matches an optimistic pending url, even though the settled url differs', () => {
    // Mirrors the origin's navigateTo -> webview onNavigate flow: an
    // address-bar submit optimistically pushes a new stack entry for the
    // typed url (the "pending target"), then the real webview navigation
    // event reports back with the actual (redirected) url and asks to settle
    // into the SAME entry rather than push a second one. The settled url here
    // deliberately does NOT equal the current entry's url, so this only
    // passes through the `shouldReplacePending` branch, not the plain
    // same-url branch.
    const state: BrowserNavigationState = {
      navigationStack: [{ title: 'Home', url: EMPTY_URL }, { title: 'example.com', url: 'https://example.com' }],
      navigationIndex: 1,
    };
    const result = recordNavigation(state, 'https://example.com/home', 'Example Domain', {
      replacePendingTarget: true,
      pendingTarget: 'https://example.com',
    });
    expect(result.navigationStack).toHaveLength(2);
    expect(result.navigationIndex).toBe(1);
    expect(result.navigationStack[1]).toEqual({ title: 'Example Domain', url: 'https://example.com/home' });
  });

  it('recordNavigation ignores replacePendingTarget when pendingTarget does not match the current entry', () => {
    const state: BrowserNavigationState = {
      navigationStack: [{ title: 'Home', url: EMPTY_URL }, { title: 'A', url: 'https://a.com' }],
      navigationIndex: 1,
    };
    // pendingTarget points somewhere other than the current entry, so this
    // should fall through to a normal append rather than an in-place update.
    const result = recordNavigation(state, 'https://c.com', 'C', {
      replacePendingTarget: true,
      pendingTarget: 'https://b.com',
    });
    expect(result.navigationStack).toHaveLength(3);
    expect(result.navigationIndex).toBe(2);
  });

  it('resolveNavigationHistoryDelta returns null at either end of the stack', () => {
    const state: BrowserNavigationState = { navigationStack: [{ title: 'A', url: 'https://a.com' }], navigationIndex: 0 };
    expect(resolveNavigationHistoryDelta(state, -1)).toBeNull();
    expect(resolveNavigationHistoryDelta(state, 1)).toBeNull();
  });

  it('canGoBack / canGoForward reflect the current index', () => {
    const state: BrowserNavigationState = {
      navigationStack: [{ title: 'A', url: 'a' }, { title: 'B', url: 'b' }, { title: 'C', url: 'c' }],
      navigationIndex: 1,
    };
    expect(canGoBack(state)).toBe(true);
    expect(canGoForward(state)).toBe(true);
    expect(canGoBack({ ...state, navigationIndex: 0 })).toBe(false);
    expect(canGoForward({ ...state, navigationIndex: 2 })).toBe(false);
  });

  it('updateCurrentNavigationTitle updates only the current entry', () => {
    const state: BrowserNavigationState = {
      navigationStack: [{ title: 'A', url: 'a' }, { title: 'B', url: 'b' }],
      navigationIndex: 1,
    };
    const result = updateCurrentNavigationTitle(state, 'B renamed');
    expect(result.navigationStack).toEqual([{ title: 'A', url: 'a' }, { title: 'B renamed', url: 'b' }]);
  });

  it('updateCurrentNavigationTitle is a no-op for a blank title', () => {
    const state: BrowserNavigationState = { navigationStack: [{ title: 'A', url: 'a' }], navigationIndex: 0 };
    expect(updateCurrentNavigationTitle(state, '  ')).toBe(state);
  });
});

it('HISTORY_LIMIT is a sane positive cap', () => {
  expect(HISTORY_LIMIT).toBeGreaterThan(0);
});
