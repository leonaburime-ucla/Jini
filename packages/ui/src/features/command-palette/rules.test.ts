import { describe, expect, it } from 'vitest';
import { nextCursor, parseRecentIds, pushRecentId, rankItems, scoreItemMatch } from './rules.js';
import type { CommandPaletteItem } from './types.js';

function item(overrides: Partial<CommandPaletteItem> & { id: string; name: string }): CommandPaletteItem {
  return { kind: 'file', ...overrides };
}

describe('scoreItemMatch', () => {
  it('scores an exact match highest', () => {
    expect(scoreItemMatch(item({ id: '1', name: 'readme' }), 'readme')).toBe(1000);
  });

  it('scores a prefix match above a substring match', () => {
    const prefix = scoreItemMatch(item({ id: '1', name: 'readme.md' }), 'read');
    const substring = scoreItemMatch(item({ id: '2', name: 'the-readme.md' }), 'read');
    expect(prefix).toBeGreaterThan(substring);
  });

  it('scores a keywords-only match lower than a name substring match', () => {
    const keywordsOnly = scoreItemMatch(item({ id: '1', name: 'index', keywords: 'browser tab' }), 'browser');
    const nameSubstring = scoreItemMatch(item({ id: '2', name: 'browser-panel' }), 'browser');
    expect(keywordsOnly).toBeGreaterThan(0);
    expect(keywordsOnly).toBeLessThan(nameSubstring);
  });

  it('scores 0 when nothing matches, including when keywords is absent', () => {
    expect(scoreItemMatch(item({ id: '1', name: 'readme' }), 'zzz')).toBe(0);
  });
});

describe('rankItems', () => {
  const items = [
    item({ id: 'a', name: 'apple.txt', mtime: 3 }),
    item({ id: 'b', name: 'banana.txt', mtime: 1 }),
    item({ id: 'c', name: 'cherry.txt', mtime: 2 }),
  ];

  it('returns an empty array for an empty item list regardless of query', () => {
    expect(rankItems([], 'anything', [])).toEqual([]);
    expect(rankItems([], '', [])).toEqual([]);
  });

  it('returns no matches when the query matches nothing', () => {
    expect(rankItems(items, 'zzz-no-match', [])).toEqual([]);
  });

  it('returns a single match when only one item qualifies', () => {
    const result = rankItems(items, 'apple', []);
    expect(result).toHaveLength(1);
    expect(result[0]?.item.id).toBe('a');
  });

  it('sorts multiple matches by descending score', () => {
    const result = rankItems(items, '.txt', []);
    expect(result.map((r) => r.item.id)).toEqual(['a', 'b', 'c']);
    expect(result.every((r) => r.score > 0)).toBe(true);
  });

  it('with an empty query, surfaces still-extant recents first in recent order, then the rest by mtime desc', () => {
    const result = rankItems(items, '', ['b', 'missing-id']);
    expect(result.map((r) => r.item.id)).toEqual(['b', 'a', 'c']);
    expect(result.every((r) => r.score === 0)).toBe(true);
  });

  it('with an empty query and no recents, orders purely by mtime desc', () => {
    const result = rankItems(items, '', []);
    expect(result.map((r) => r.item.id)).toEqual(['a', 'c', 'b']);
  });

  it('treats a missing mtime as 0 when sorting the non-recent remainder, on either side of the comparison', () => {
    const withMissingMtime = [
      item({ id: 'x', name: 'x.txt' }),
      item({ id: 'w', name: 'w.txt' }),
      item({ id: 'y', name: 'y.txt', mtime: 5 }),
    ];
    const result = rankItems(withMissingMtime, '', []);
    expect(result[0]?.item.id).toBe('y');
    expect(new Set(result.slice(1).map((r) => r.item.id))).toEqual(new Set(['x', 'w']));
  });

  it('treats a whitespace-only query as empty', () => {
    const result = rankItems(items, '   ', []);
    expect(result.map((r) => r.item.id)).toEqual(['a', 'c', 'b']);
  });
});

describe('nextCursor', () => {
  it('advances forward within bounds', () => {
    expect(nextCursor(0, 3, 1)).toBe(1);
    expect(nextCursor(1, 3, 1)).toBe(2);
  });

  it('wraps forward from the last index to the first', () => {
    expect(nextCursor(2, 3, 1)).toBe(0);
  });

  it('advances backward within bounds', () => {
    expect(nextCursor(2, 3, -1)).toBe(1);
  });

  it('wraps backward from the first index to the last', () => {
    expect(nextCursor(0, 3, -1)).toBe(2);
  });

  it('returns 0 for a zero or negative total (no results to navigate)', () => {
    expect(nextCursor(0, 0, 1)).toBe(0);
    expect(nextCursor(5, 0, -1)).toBe(0);
  });

  it('stays at 0 with a single-item list in either direction', () => {
    expect(nextCursor(0, 1, 1)).toBe(0);
    expect(nextCursor(0, 1, -1)).toBe(0);
  });
});

describe('parseRecentIds', () => {
  it('parses a valid JSON string array', () => {
    expect(parseRecentIds('["a","b"]')).toEqual(['a', 'b']);
  });

  it('filters out non-string entries', () => {
    expect(parseRecentIds('["a", 1, null, "b"]')).toEqual(['a', 'b']);
  });

  it('returns an empty array for a non-array JSON value', () => {
    expect(parseRecentIds('{"a":1}')).toEqual([]);
  });

  it('returns an empty array for malformed JSON', () => {
    expect(parseRecentIds('not json')).toEqual([]);
  });
});

describe('pushRecentId', () => {
  it('adds a new id to the front', () => {
    expect(pushRecentId(['a', 'b'], 'c', 6)).toEqual(['c', 'a', 'b']);
  });

  it('de-duplicates an existing id by moving it to the front', () => {
    expect(pushRecentId(['a', 'b', 'c'], 'b', 6)).toEqual(['b', 'a', 'c']);
  });

  it('caps the result at the given limit', () => {
    expect(pushRecentId(['a', 'b', 'c'], 'd', 2)).toEqual(['d', 'a']);
  });
});
