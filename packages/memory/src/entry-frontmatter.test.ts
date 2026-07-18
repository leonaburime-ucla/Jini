import { describe, expect, it } from 'vitest';

import { parseEntryFrontmatter, renderEntryFrontmatter } from './entry-frontmatter.js';

describe('parseEntryFrontmatter', () => {
  it('parses name/description/type and trims the body', () => {
    const raw = '---\nname: Role\ndescription: A summary\ntype: user\n---\n\n- Role: engineer\n';
    const { data, body } = parseEntryFrontmatter(raw);
    expect(data).toEqual({ name: 'Role', description: 'A summary', type: 'user' });
    expect(body.trim()).toBe('- Role: engineer');
  });

  it('returns empty fields and the raw text as body when there is no frontmatter block', () => {
    const raw = 'just a plain file, no frontmatter';
    const { data, body } = parseEntryFrontmatter(raw);
    expect(data).toEqual({ name: '', description: '', type: '' });
    expect(body).toBe(raw);
  });

  it('ignores unrecognized keys inside the frontmatter block', () => {
    const raw = '---\nname: X\nbogus: ignored\ntype: user\n---\nbody\n';
    const { data } = parseEntryFrontmatter(raw);
    expect(data).toEqual({ name: 'X', description: '', type: 'user' });
  });

  it('handles a frontmatter block with no trailing body', () => {
    const raw = '---\nname: X\ndescription: Y\ntype: user\n---';
    const { data, body } = parseEntryFrontmatter(raw);
    expect(data.name).toBe('X');
    expect(body).toBe('');
  });
});

describe('renderEntryFrontmatter', () => {
  it('renders sanitized single-line frontmatter fields plus the trimmed body', () => {
    const rendered = renderEntryFrontmatter({ name: 'Role\nwith newline', description: 'desc', type: 'user' }, '\n\n  body text');
    expect(rendered).toBe('---\nname: Role with newline\ndescription: desc\ntype: user\n---\n\nbody text\n');
  });

  it('round-trips through parseEntryFrontmatter', () => {
    const rendered = renderEntryFrontmatter({ name: 'A', description: 'B', type: 'user' }, 'body');
    const { data, body } = parseEntryFrontmatter(rendered);
    expect(data).toEqual({ name: 'A', description: 'B', type: 'user' });
    expect(body.trim()).toBe('body');
  });
});
