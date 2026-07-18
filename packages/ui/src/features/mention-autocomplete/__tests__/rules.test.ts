import { describe, expect, it } from 'vitest';
import {
  buildMentionToken,
  filterMentionItems,
  groupItemsByCategory,
  hasAnyResults,
  insertMentionToken,
  isCategoryVisible,
  mentionSelectionKey,
  readMentionTrigger,
} from '../rules.js';
import type { MentionItem } from '../types.js';

describe('readMentionTrigger', () => {
  it('returns null when there is no @ before the cursor', () => {
    expect(readMentionTrigger('hello world', 5)).toBeNull();
  });

  it('detects a trigger at the start of the text', () => {
    expect(readMentionTrigger('@foo', 4)).toEqual({ start: 0, end: 4, query: 'foo' });
  });

  it('detects a trigger preceded by whitespace', () => {
    expect(readMentionTrigger('hello @bar', 10)).toEqual({ start: 6, end: 10, query: 'bar' });
  });

  it('returns an empty query for a bare trigger', () => {
    expect(readMentionTrigger('hello @', 7)).toEqual({ start: 6, end: 7, query: '' });
  });

  it('returns null once the trigger is followed by whitespace (mention closed)', () => {
    expect(readMentionTrigger('hello @bar ', 11)).toBeNull();
  });

  it('returns null when the trigger is not preceded by whitespace or start-of-string', () => {
    expect(readMentionTrigger('email@bar', 9)).toBeNull();
  });

  it('reads the trigger match at an earlier cursor position, ignoring text after it', () => {
    expect(readMentionTrigger('@foo bar baz', 4)).toEqual({ start: 0, end: 4, query: 'foo' });
  });

  it('supports a custom trigger character', () => {
    expect(readMentionTrigger('type /cmd', 9, '/')).toEqual({ start: 5, end: 9, query: 'cmd' });
    expect(readMentionTrigger('type @cmd', 9, '/')).toBeNull();
  });
});

describe('buildMentionToken', () => {
  it('prefixes the label with the trigger character', () => {
    expect(buildMentionToken('Acme')).toBe('@Acme');
  });

  it('does not double-prefix an already-prefixed label', () => {
    expect(buildMentionToken('@Acme')).toBe('@Acme');
  });

  it('supports a custom trigger character', () => {
    expect(buildMentionToken('deploy', '/')).toBe('/deploy');
    expect(buildMentionToken('/deploy', '/')).toBe('/deploy');
  });
});

describe('insertMentionToken', () => {
  it('splices the token in place of an active trigger match', () => {
    const result = insertMentionToken('hello @fo world', { start: 6, end: 9, query: 'fo' }, '@Foobar');
    expect(result.nextValue).toBe('hello @Foobar world');
    expect(result.cursor).toBe('hello @Foobar '.length);
  });

  it('trims a leading space after the replaced token so there is no double space', () => {
    const result = insertMentionToken('hi @f  there', { start: 3, end: 5, query: 'f' }, '@Foo');
    expect(result.nextValue).toBe('hi @Foo there');
  });

  it('appends the token with a newline separator when there is no active match and existing text', () => {
    const result = insertMentionToken('some existing prompt', null, '@Foo');
    expect(result.nextValue).toBe('some existing prompt\n@Foo ');
    expect(result.cursor).toBe(result.nextValue.length);
  });

  it('appends the token with no separator when there is no active match and the text is empty', () => {
    const result = insertMentionToken('', null, '@Foo');
    expect(result.nextValue).toBe('@Foo ');
    expect(result.cursor).toBe(5);
  });

  it('appends the token with no separator when the existing text is only whitespace', () => {
    const result = insertMentionToken('   ', null, '@Foo');
    expect(result.nextValue).toBe('   @Foo ');
  });

  it('replaces a trigger at the very end of the text', () => {
    const result = insertMentionToken('hello @f', { start: 6, end: 8, query: 'f' }, '@Foo');
    expect(result.nextValue).toBe('hello @Foo ');
    expect(result.cursor).toBe(result.nextValue.length);
  });
});

interface TestItem extends MentionItem {
  extra?: string;
}

function item(overrides: Partial<TestItem> = {}): TestItem {
  return { id: 'a', label: 'Alpha', category: 'skills', ...overrides };
}

describe('filterMentionItems', () => {
  it('returns every item, capped, when the query is empty', () => {
    const items = Array.from({ length: 15 }, (_, i) => item({ id: `${i}`, label: `Item ${i}` }));
    expect(filterMentionItems(items, '')).toHaveLength(10);
  });

  it('filters by a case-insensitive substring match on the default label selector', () => {
    const items = [item({ id: '1', label: 'Alpha' }), item({ id: '2', label: 'Beta' })];
    expect(filterMentionItems(items, 'AL').map((i) => i.id)).toEqual(['1']);
  });

  it('supports a custom getSearchText selector', () => {
    const items = [item({ id: '1', label: 'Alpha', extra: 'zzz' }), item({ id: '2', label: 'Beta', extra: 'needle' })];
    const matches = filterMentionItems(items, 'needle', (i) => `${i.label} ${i.extra ?? ''}`);
    expect(matches.map((i) => i.id)).toEqual(['2']);
  });

  it('respects a custom maxResults cap', () => {
    const items = Array.from({ length: 5 }, (_, i) => item({ id: `${i}` }));
    expect(filterMentionItems(items, '', undefined, 2)).toHaveLength(2);
  });

  it('a whitespace-only query behaves like an empty query', () => {
    const items = [item({ id: '1' })];
    expect(filterMentionItems(items, '   ')).toHaveLength(1);
  });
});

describe('isCategoryVisible', () => {
  it('the "all" filter shows every category', () => {
    expect(isCategoryVisible('all', 'skills')).toBe(true);
    expect(isCategoryVisible('all', 'plugins')).toBe(true);
  });

  it('a specific filter only shows the matching category', () => {
    expect(isCategoryVisible('skills', 'skills')).toBe(true);
    expect(isCategoryVisible('skills', 'plugins')).toBe(false);
  });
});

describe('groupItemsByCategory', () => {
  const categories = [
    { id: 'skills', label: 'Skills' },
    { id: 'plugins', label: 'Plugins' },
  ];

  it('groups items by category in category order', () => {
    const items = [item({ id: '1', category: 'plugins' }), item({ id: '2', category: 'skills' })];
    const groups = groupItemsByCategory(items, categories);
    expect(groups.map((g) => g.category.id)).toEqual(['skills', 'plugins']);
    expect(groups[0]?.items.map((i) => i.id)).toEqual(['2']);
    expect(groups[1]?.items.map((i) => i.id)).toEqual(['1']);
  });

  it('omits categories with zero visible items', () => {
    const items = [item({ id: '1', category: 'skills' })];
    const groups = groupItemsByCategory(items, categories);
    expect(groups.map((g) => g.category.id)).toEqual(['skills']);
  });

  it('respects the active category filter', () => {
    const items = [item({ id: '1', category: 'skills' }), item({ id: '2', category: 'plugins' })];
    const groups = groupItemsByCategory(items, categories, 'plugins');
    expect(groups.map((g) => g.category.id)).toEqual(['plugins']);
  });

  it('defaults to showing all categories when no filter is passed', () => {
    const items = [item({ id: '1', category: 'skills' }), item({ id: '2', category: 'plugins' })];
    const groups = groupItemsByCategory(items, categories);
    expect(groups).toHaveLength(2);
  });
});

describe('mentionSelectionKey', () => {
  it('joins category and id with a colon', () => {
    expect(mentionSelectionKey('skills', 'abc')).toBe('skills:abc');
  });

  it('disambiguates the same raw id across different categories', () => {
    expect(mentionSelectionKey('skills', '1')).not.toBe(mentionSelectionKey('plugins', '1'));
  });
});

describe('hasAnyResults', () => {
  it('is false for no groups', () => {
    expect(hasAnyResults([])).toBe(false);
  });

  it('is true when at least one group is present', () => {
    expect(hasAnyResults([{ category: { id: 'skills', label: 'Skills' }, items: [item()] }])).toBe(true);
  });
});
