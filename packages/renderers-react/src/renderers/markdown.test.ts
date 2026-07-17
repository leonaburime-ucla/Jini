import { describe, expect, it } from 'vitest';
import { MarkdownRenderer, renderMarkdownToSafeHtml } from './markdown.js';
import type { ArtifactFile } from '../types.js';

describe('renderMarkdownToSafeHtml', () => {
  it('renders basic markdown to HTML', () => {
    expect(renderMarkdownToSafeHtml('# Title\n\nHello **world**.')).toContain('<h1>Title</h1>');
  });

  it('adds rel=noreferrer/target=_blank to external links', () => {
    const html = renderMarkdownToSafeHtml('[Anthropic](https://anthropic.com)');
    expect(html).toContain('rel="noreferrer noopener" target="_blank"');
    expect(html).toContain('href="https://anthropic.com"');
  });

  it('does not add target=_blank to in-page anchor links', () => {
    const html = renderMarkdownToSafeHtml('[Jump](#section)');
    expect(html).not.toContain('target="_blank"');
  });

  it('drops links with an unsafe scheme', () => {
    const html = renderMarkdownToSafeHtml('[bad](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('bad');
  });

  it('escapes pipes inside inline code within a table cell', () => {
    const md = '| a | b |\n| --- | --- |\n| `x|y` | z |';
    const html = renderMarkdownToSafeHtml(md);
    expect(html).toContain('md-table');
    expect(html).toContain('x|y');
  });

  it('wraps tables in a scroll container class', () => {
    const md = '| a | b |\n| --- | --- |\n| 1 | 2 |';
    expect(renderMarkdownToSafeHtml(md)).toContain('md-table-wrap');
  });
});

describe('MarkdownRenderer', () => {
  function file(overrides: Partial<ArtifactFile> = {}): ArtifactFile {
    return { name: 'notes.md', kind: 'text', content: '# hi', ...overrides };
  }

  it('supports streaming and exposes renderPartial', () => {
    expect(MarkdownRenderer.supportsStreaming).toBe(true);
    expect(MarkdownRenderer.renderPartial?.('# hi')).toContain('<h1>hi</h1>');
  });

  it('matches a .md file with no manifest', () => {
    expect(MarkdownRenderer.canRender({ file: file() })).toBe(true);
  });

  it('matches an explicit markdown-document manifest', () => {
    const manifest = {
      version: 1 as const,
      kind: 'markdown-document' as const,
      title: 't',
      entry: 'a',
      renderer: 'markdown' as const,
      exports: [],
    };
    expect(MarkdownRenderer.canRender({ file: file({ manifest, name: 'a' }) })).toBe(true);
  });

  it('refuses a non-markdown text file', () => {
    expect(MarkdownRenderer.canRender({ file: file({ name: 'notes.txt' }) })).toBe(false);
  });
});
