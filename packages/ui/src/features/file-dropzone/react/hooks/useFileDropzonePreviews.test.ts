// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFileDropzonePreviews } from './useFileDropzonePreviews.js';

function file(name: string, type: string, content: string[] = ['x']): File {
  return new File(content, name, { type });
}

// jsdom's `Blob`/`File` implementation doesn't ship `.text()` (verified
// directly: `file.slice(0, n).text` is `undefined` under this package's
// jsdom version) — real browsers and Node's own `Blob` both have it. Without
// this polyfill, every text-snippet read below would silently fail through
// the hook's own error-swallowing catch, exercising only the "unreadable"
// branch and never the happy path. `FileReader.readAsText` IS implemented
// by jsdom, so it's used here to back the missing method.
if (typeof Blob !== 'undefined' && typeof Blob.prototype.text !== 'function') {
  Blob.prototype.text = function (this: Blob) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.readAsText(this);
    });
  };
}

/** jsdom doesn't implement `document.fonts` — patches it in-place (restorable) rather than replacing the whole `document` global, which breaks React/testing-library internals that depend on the real `Document`. */
function stubDocumentFonts(fonts: { add: (face: FontFace) => void; delete: (face: FontFace) => void }): () => void {
  const had = Object.prototype.hasOwnProperty.call(document, 'fonts');
  const previous = (document as unknown as { fonts?: unknown }).fonts;
  Object.defineProperty(document, 'fonts', { value: fonts, configurable: true });
  return () => {
    if (had) {
      Object.defineProperty(document, 'fonts', { value: previous, configurable: true });
    } else {
      delete (document as unknown as { fonts?: unknown }).fonts;
    }
  };
}

// Every `renderHook` below uses the `initialProps` form (never
// `renderHook(() => useFileDropzonePreviews([f]))`) so the `files` array
// passed to the hook has a STABLE reference across re-renders. A fresh `[f]`
// literal recreated inside the render callback itself would give the
// object-URL/font/text effects (each keyed on `files` by reference) a new
// dependency on every render they themselves triggered via `setState` — an
// infinite render loop that only some assertions here would happen to
// resolve before a run-away background loop hangs the process.
describe('useFileDropzonePreviews', () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    let counter = 0;
    createObjectURL = vi.fn(() => `blob:mock-${counter++}`);
    revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates an object URL for a kind that needs one (image)', async () => {
    const f = file('a.png', 'image/png');
    const { result } = renderHook(({ files }) => useFileDropzonePreviews(files), {
      initialProps: { files: [f] },
    });
    await waitFor(() => expect(result.current.previewUrls.get(f)).toBe('blob:mock-0'));
  });

  it('does not create an object URL for a kind that does not need one (text)', async () => {
    const f = file('a.txt', 'text/plain');
    const { result } = renderHook(({ files }) => useFileDropzonePreviews(files), {
      initialProps: { files: [f] },
    });
    await waitFor(() => expect(result.current.textSnippets.get(f)).toBeDefined());
    expect(result.current.previewUrls.has(f)).toBe(false);
  });

  it('revokes previous object URLs when the files list changes', async () => {
    const f1 = file('a.png', 'image/png');
    const f2 = file('b.png', 'image/png');
    const { result, rerender } = renderHook(({ files }) => useFileDropzonePreviews(files), {
      initialProps: { files: [f1] },
    });
    await waitFor(() => expect(result.current.previewUrls.get(f1)).toBe('blob:mock-0'));
    rerender({ files: [f2] });
    await waitFor(() => expect(result.current.previewUrls.get(f2)).toBe('blob:mock-1'));
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-0');
  });

  it('revokes previews on unmount', async () => {
    const f = file('a.png', 'image/png');
    const { result, unmount } = renderHook(({ files }) => useFileDropzonePreviews(files), {
      initialProps: { files: [f] },
    });
    await waitFor(() => expect(result.current.previewUrls.get(f)).toBe('blob:mock-0'));
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-0');
  });

  it('gracefully handles an environment with no URL.createObjectURL (returns no preview, no throw)', async () => {
    vi.stubGlobal('URL', {});
    const f = file('a.png', 'image/png');
    const { result } = renderHook(({ files }) => useFileDropzonePreviews(files), {
      initialProps: { files: [f] },
    });
    await waitFor(() => expect(result.current.previewUrls.size).toBe(0));
  });

  it('swallows a createObjectURL that throws and renders no preview for that file', async () => {
    createObjectURL.mockImplementation(() => {
      throw new Error('boom');
    });
    const f = file('a.png', 'image/png');
    const { result } = renderHook(({ files }) => useFileDropzonePreviews(files), {
      initialProps: { files: [f] },
    });
    await waitFor(() => expect(result.current.previewUrls.size).toBe(0));
  });

  it('swallows a revokeObjectURL that throws', async () => {
    revokeObjectURL.mockImplementation(() => {
      throw new Error('boom');
    });
    const f1 = file('a.png', 'image/png');
    const f2 = file('b.png', 'image/png');
    const { result, rerender } = renderHook(({ files }) => useFileDropzonePreviews(files), {
      initialProps: { files: [f1] },
    });
    await waitFor(() => expect(result.current.previewUrls.get(f1)).toBe('blob:mock-0'));
    expect(() => rerender({ files: [f2] })).not.toThrow();
  });

  it('reads a bounded text snippet for a text-kind file', async () => {
    const f = file('notes.txt', 'text/plain', ['hello world']);
    const { result } = renderHook(({ files }) => useFileDropzonePreviews(files), {
      initialProps: { files: [f] },
    });
    await waitFor(() => expect(result.current.textSnippets.get(f)).toBe('hello world'));
  });

  it('clears text snippets once no text-kind file remains', async () => {
    const f1 = file('notes.txt', 'text/plain', ['hello']);
    const f2 = file('a.png', 'image/png');
    const { result, rerender } = renderHook(({ files }) => useFileDropzonePreviews(files), {
      initialProps: { files: [f1] },
    });
    await waitFor(() => expect(result.current.textSnippets.get(f1)).toBe('hello'));
    rerender({ files: [f2] });
    await waitFor(() => expect(result.current.textSnippets.size).toBe(0));
  });

  it('reads the whole file directly when `.slice` is not a function', async () => {
    const f = file('notes.txt', 'text/plain', ['no slice here']);
    Object.defineProperty(f, 'slice', { value: undefined });
    const { result } = renderHook(({ files }) => useFileDropzonePreviews(files), {
      initialProps: { files: [f] },
    });
    await waitFor(() => expect(result.current.textSnippets.get(f)).toBe('no slice here'));
  });

  it('swallows a text read failure for one file without failing the others', async () => {
    const bad = file('bad.txt', 'text/plain');
    Object.defineProperty(bad, 'slice', {
      value: () => {
        throw new Error('unreadable');
      },
    });
    const good = file('good.txt', 'text/plain', ['ok']);
    const { result } = renderHook(({ files }) => useFileDropzonePreviews(files), {
      initialProps: { files: [bad, good] },
    });
    await waitFor(() => expect(result.current.textSnippets.get(good)).toBe('ok'));
    expect(result.current.textSnippets.has(bad)).toBe(false);
  });

  it('loads a FontFace for a font-kind file and exposes its family name', async () => {
    class FakeFontFace {
      family: string;
      constructor(family: string, _source: string) {
        this.family = family;
      }
      load() {
        return Promise.resolve(this);
      }
    }
    const fontsAdd = vi.fn();
    const fontsDelete = vi.fn();
    vi.stubGlobal('FontFace', FakeFontFace as unknown as typeof FontFace);
    const restore = stubDocumentFonts({ add: fontsAdd, delete: fontsDelete });

    const f = file('brand.woff2', 'font/woff2');
    const { result, unmount } = renderHook(({ files }) => useFileDropzonePreviews(files), {
      initialProps: { files: [f] },
    });
    await waitFor(() => expect(result.current.fontFamilies.get(f)).toMatch(/^jini-file-dropzone-font-0-/));
    expect(fontsAdd).toHaveBeenCalled();
    unmount();
    restore();
  });

  it('is a no-op for fonts when the environment has no FontFace/document.fonts', async () => {
    vi.stubGlobal('FontFace', undefined);
    const f = file('brand.woff2', 'font/woff2');
    const { result } = renderHook(({ files }) => useFileDropzonePreviews(files), {
      initialProps: { files: [f] },
    });
    await waitFor(() => expect(result.current.previewUrls.get(f)).toBe('blob:mock-0'));
    expect(result.current.fontFamilies.size).toBe(0);
  });

  it('skips a font file with no resolved preview URL', async () => {
    vi.stubGlobal('URL', {});
    const f = file('brand.woff2', 'font/woff2');
    const { result } = renderHook(({ files }) => useFileDropzonePreviews(files), {
      initialProps: { files: [f] },
    });
    await waitFor(() => expect(result.current.previewUrls.size).toBe(0));
    expect(result.current.fontFamilies.size).toBe(0);
  });

  it('swallows a FontFace construction failure and leaves the glyph fallback in place', async () => {
    class ThrowingFontFace {
      constructor() {
        throw new Error('bad font');
      }
    }
    vi.stubGlobal('FontFace', ThrowingFontFace as unknown as typeof FontFace);
    const restore = stubDocumentFonts({ add: vi.fn(), delete: vi.fn() });
    const f = file('brand.woff2', 'font/woff2');
    const { result } = renderHook(({ files }) => useFileDropzonePreviews(files), {
      initialProps: { files: [f] },
    });
    await waitFor(() => expect(result.current.previewUrls.get(f)).toBe('blob:mock-0'));
    expect(result.current.fontFamilies.size).toBe(0);
    restore();
  });

  it('swallows a font load() rejection and leaves the glyph fallback in place', async () => {
    class RejectingFontFace {
      load() {
        return Promise.reject(new Error('unsupported'));
      }
    }
    vi.stubGlobal('FontFace', RejectingFontFace as unknown as typeof FontFace);
    const restore = stubDocumentFonts({ add: vi.fn(), delete: vi.fn() });
    const f = file('brand.woff2', 'font/woff2');
    const { result } = renderHook(({ files }) => useFileDropzonePreviews(files), {
      initialProps: { files: [f] },
    });
    await waitFor(() => expect(result.current.previewUrls.get(f)).toBe('blob:mock-0'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current.fontFamilies.size).toBe(0);
    restore();
  });

  it('removes registered font faces on cleanup (unmount) and ignores a delete failure', async () => {
    class FakeFontFace {
      load() {
        return Promise.resolve(this);
      }
    }
    const fontsDelete = vi.fn(() => {
      throw new Error('boom');
    });
    vi.stubGlobal('FontFace', FakeFontFace as unknown as typeof FontFace);
    const restore = stubDocumentFonts({ add: vi.fn(), delete: fontsDelete });
    const f = file('brand.woff2', 'font/woff2');
    const { result, unmount } = renderHook(({ files }) => useFileDropzonePreviews(files), {
      initialProps: { files: [f] },
    });
    await waitFor(() => expect(result.current.fontFamilies.get(f)).toBeDefined());
    expect(() => unmount()).not.toThrow();
    expect(fontsDelete).toHaveBeenCalled();
    restore();
  });

  it('ignores a font load resolving after the effect was cancelled (files changed mid-flight)', async () => {
    let resolveLoad: (() => void) | undefined;
    class SlowFontFace {
      load() {
        return new Promise<this>((resolve) => {
          resolveLoad = () => resolve(this);
        });
      }
    }
    const fontsAdd = vi.fn();
    vi.stubGlobal('FontFace', SlowFontFace as unknown as typeof FontFace);
    const restore = stubDocumentFonts({ add: fontsAdd, delete: vi.fn() });
    const f = file('brand.woff2', 'font/woff2');
    const other = file('other.png', 'image/png');
    const { result, rerender } = renderHook(({ files }) => useFileDropzonePreviews(files), {
      initialProps: { files: [f] },
    });
    await waitFor(() => expect(result.current.previewUrls.get(f)).toBe('blob:mock-0'));
    rerender({ files: [other] });
    resolveLoad?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fontsAdd).not.toHaveBeenCalled();
    restore();
  });
});
