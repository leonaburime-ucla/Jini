import { describe, expect, it } from 'vitest';
import { SvgRenderer } from './svg.js';
import type { ArtifactFile } from '../types.js';

function file(overrides: Partial<ArtifactFile> = {}): ArtifactFile {
  return { name: 'icon.svg', kind: 'image', content: '<svg></svg>', ...overrides };
}

describe('SvgRenderer', () => {
  it('matches an image-kind file with an .svg extension', () => {
    expect(SvgRenderer.canRender({ file: file() })).toBe(true);
  });

  it('matches a sketch-kind file with an .svg extension', () => {
    expect(SvgRenderer.canRender({ file: file({ kind: 'sketch' }) })).toBe(true);
  });

  it('refuses a non-svg extension', () => {
    expect(SvgRenderer.canRender({ file: file({ name: 'icon.png' }) })).toBe(false);
  });

  it('refuses a sketch-kind file with a non-svg extension', () => {
    expect(SvgRenderer.canRender({ file: file({ kind: 'sketch', name: 'icon.png' }) })).toBe(false);
  });

  it('refuses a file kind that is neither image nor sketch when an explicit non-svg manifest is set', () => {
    // A bare .svg name always legacy-infers to the svg renderer (see the test
    // above), so the file.kind fallback only matters once an explicit
    // manifest overrides that inference to something else.
    const manifest = { version: 1 as const, kind: 'html' as const, title: 't', entry: 'a', renderer: 'html' as const, exports: [] };
    expect(SvgRenderer.canRender({ file: file({ kind: 'text', manifest }) })).toBe(false);
  });

  it('matches via an explicit svg manifest regardless of file kind/extension', () => {
    const manifest = { version: 1 as const, kind: 'svg' as const, title: 't', entry: 'a', renderer: 'svg' as const, exports: [] };
    expect(SvgRenderer.canRender({ file: file({ kind: 'text', name: 'diagram.txt', manifest }) })).toBe(true);
  });

  it('falls back to the file.kind/.svg-extension check when an explicit non-svg manifest leaves an image-kind file with an .svg name', () => {
    // A non-svg manifest (e.g. html) means the renderer/kind === 'svg' shortcut
    // on the line above never fires, so this exercises the file.kind + regex
    // fallback actually running its right-hand (.svg extension) check with an
    // image-kind file, rather than short-circuiting via the manifest.
    const manifest = { version: 1 as const, kind: 'html' as const, title: 't', entry: 'a', renderer: 'html' as const, exports: [] };
    expect(SvgRenderer.canRender({ file: file({ kind: 'image', name: 'icon.svg', manifest }) })).toBe(true);
  });
});
