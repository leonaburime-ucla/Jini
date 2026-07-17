import { describe, expect, it } from 'vitest';
import { defaultSketchEditorDependencies, realSketchEditorEngine } from './dependencies.js';

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
});
