import { describe, expect, it, vi } from 'vitest';

// `realSketchEditorEngine.exportToBlob` is a one-line adapter that forwards
// to `@excalidraw/excalidraw`'s own `exportToBlob` (with a type cast) — real
// Excalidraw's implementation does actual canvas rendering, which jsdom
// can't do (see `vitest.setup.ts`'s canvas-stub note), so it's mocked at the
// module boundary here rather than invoked for real: this test's job is
// proving *our* adapter forwards the call/args, not exercising a
// third-party library's internals.
const exportToBlobMock = vi.fn(async () => new Blob(['mock'], { type: 'image/png' }));
vi.mock('@excalidraw/excalidraw', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@excalidraw/excalidraw')>();
  return { ...actual, exportToBlob: exportToBlobMock };
});

const { defaultSketchEditorDependencies, realSketchEditorEngine } = await import('./dependencies.js');

describe('realSketchEditorEngine', () => {
  it('binds the real @excalidraw/excalidraw exports', () => {
    expect(typeof realSketchEditorEngine.Excalidraw).toBe('object'); // React.memo wrapper
    expect(typeof realSketchEditorEngine.MainMenu).toBe('function');
    expect(typeof realSketchEditorEngine.MainMenu.Item).toBe('function');
    expect(typeof realSketchEditorEngine.MainMenu.Separator).toBe('function');
    expect(typeof realSketchEditorEngine.MainMenu.DefaultItems.SearchMenu).toBeDefined();
    expect(typeof realSketchEditorEngine.exportToBlob).toBe('function');
  });

  it('is the default engine bound in defaultSketchEditorDependencies', () => {
    expect(defaultSketchEditorDependencies.engine).toBe(realSketchEditorEngine);
  });

  it('exportToBlob forwards its options to the real @excalidraw/excalidraw export', async () => {
    const opts = { elements: [], appState: {}, files: {} };
    const blob = await realSketchEditorEngine.exportToBlob(opts as never);
    expect(exportToBlobMock).toHaveBeenCalledWith(opts);
    expect(blob).toBeInstanceOf(Blob);
  });
});
