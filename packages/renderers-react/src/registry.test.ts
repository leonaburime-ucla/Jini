import { describe, expect, it } from 'vitest';
import { RendererRegistry, resolveArtifactManifest, type ArtifactRenderer } from './registry.js';
import type { ArtifactFile } from './types.js';

const alwaysHtml: ArtifactRenderer = {
  id: 'html',
  supportsStreaming: false,
  canRender: () => true,
};

const neverMatches: ArtifactRenderer = {
  id: 'never',
  supportsStreaming: false,
  canRender: () => false,
};

function file(overrides: Partial<ArtifactFile> = {}): ArtifactFile {
  return { name: 'index.html', kind: 'html', content: '<p>hi</p>', ...overrides };
}

describe('resolveArtifactManifest', () => {
  it('prefers an explicit manifest over legacy inference', () => {
    const manifest = {
      version: 1 as const,
      kind: 'markdown-document' as const,
      title: 'Explicit',
      entry: 'index.html',
      renderer: 'markdown' as const,
      exports: [],
    };
    expect(resolveArtifactManifest(file({ manifest }))).toEqual(manifest);
  });

  it('falls back to legacy inference from the file name', () => {
    const manifest = resolveArtifactManifest(file({ name: 'notes.md' }));
    expect(manifest?.kind).toBe('markdown-document');
    expect(manifest?.renderer).toBe('markdown');
  });

  it('returns null when nothing can be inferred', () => {
    expect(resolveArtifactManifest(file({ name: 'data.bin' }))).toBeNull();
  });
});

describe('RendererRegistry', () => {
  it('resolves the first renderer whose canRender matches', () => {
    const registry = new RendererRegistry([neverMatches, alwaysHtml]);
    const match = registry.resolve({ file: file() });
    expect(match?.renderer.id).toBe('html');
  });

  it('returns null when no manifest can be resolved', () => {
    const registry = new RendererRegistry([alwaysHtml]);
    expect(registry.resolve({ file: file({ name: 'data.bin' }) })).toBeNull();
  });

  it('returns null when no renderer matches', () => {
    const registry = new RendererRegistry([neverMatches]);
    expect(registry.resolve({ file: file() })).toBeNull();
  });

  it('list() exposes renderers in resolution order', () => {
    const registry = new RendererRegistry([neverMatches, alwaysHtml]);
    expect(registry.list().map((r) => r.id)).toEqual(['never', 'html']);
  });

  it('register() replaces an existing renderer with the same id', () => {
    const registry = new RendererRegistry([neverMatches]);
    const replaced: ArtifactRenderer = { id: 'never', supportsStreaming: false, canRender: () => true };
    const next = registry.register(replaced);
    expect(next.list()).toHaveLength(1);
    expect(next.resolve({ file: file() })?.renderer).toBe(replaced);
    // original registry is untouched
    expect(registry.resolve({ file: file() })).toBeNull();
  });

  it('register() appends a renderer with a new id', () => {
    const registry = new RendererRegistry([neverMatches]);
    const next = registry.register(alwaysHtml);
    expect(next.list().map((r) => r.id)).toEqual(['never', 'html']);
  });
});
