import { describe, expect, it } from 'vitest';
import { highlightCode } from './shiki.js';

describe('highlightCode', () => {
  it('returns highlighted HTML for a known language', async () => {
    const html = await highlightCode('const x = 1;', 'javascript');
    expect(html).toContain('<pre');
    expect(html).toContain('const');
  }, 20000);

  it('returns an empty string for an unloaded language', async () => {
    expect(await highlightCode('SELECT 1', 'not-a-real-lang')).toBe('');
  }, 20000);

  it('caches identical (theme, lang, code) lookups', async () => {
    const first = await highlightCode('const y = 2;', 'javascript');
    const second = await highlightCode('const y = 2;', 'javascript');
    expect(second).toBe(first);
  }, 20000);
});
