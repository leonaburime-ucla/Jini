import { describe, expect, it } from 'vitest';
import { createDefaultRendererRegistry } from './index.js';
import type { ArtifactFile } from '../types.js';

describe('createDefaultRendererRegistry', () => {
  const registry = createDefaultRendererRegistry();

  it.each([
    ['index.html', 'html'],
    ['notes.md', 'markdown'],
    ['icon.svg', 'svg'],
  ])('resolves %s to the %s renderer', (name, rendererId) => {
    const kind = name.endsWith('.svg') ? 'image' : name.endsWith('.md') ? 'text' : 'html';
    const file: ArtifactFile = { name, kind, content: '' };
    expect(registry.resolve({ file })?.renderer.id).toBe(rendererId);
  });

  it('does not ship a deck-html renderer', () => {
    expect(registry.list().some((r) => r.id === 'deck-html')).toBe(false);
  });

  it('a host can register its own deck-html renderer', () => {
    const withDeck = registry.register({
      id: 'deck-html',
      supportsStreaming: false,
      canRender: ({ file }) => file.name === 'deck.html',
    });
    const match = withDeck.resolve({ file: { name: 'deck.html', kind: 'html', content: '' } });
    expect(match?.renderer.id).toBe('deck-html');
  });
});
