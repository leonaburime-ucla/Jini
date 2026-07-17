import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createFakeSketchEditorEngine } from '../dependencies-fake.js';
import { emptySketchScene } from '../../rules.js';
import { useSketchSaveWorkflow } from './useSketchSaveWorkflow.js';

const t = (key: string) => key;

function baseParams(overrides: Partial<Parameters<typeof useSketchSaveWorkflow>[0]> = {}) {
  return {
    dirty: false,
    saving: false,
    fileName: 'diagram.excalidraw',
    currentScene: () => emptySketchScene('diagram.excalidraw'),
    onSave: vi.fn(async () => true),
    engine: createFakeSketchEditorEngine(),
    t,
    ...overrides,
  };
}

describe('useSketchSaveWorkflow', () => {
  it('shows the saved indicator once savedAt is set (while not dirty/saving), then hides it after the TTL', () => {
    vi.useFakeTimers();
    try {
      const { result, rerender } = renderHook((props) => useSketchSaveWorkflow(props), { initialProps: baseParams({ savedAt: undefined }) });
      expect(result.current.showSaved).toBe(false);

      rerender(baseParams({ savedAt: 1 }));
      expect(result.current.showSaved).toBe(true);

      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(result.current.showSaved).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('hides the saved indicator immediately once dirty becomes true', () => {
    const { result, rerender } = renderHook((props) => useSketchSaveWorkflow(props), { initialProps: baseParams({ savedAt: 1 }) });
    expect(result.current.showSaved).toBe(true);
    rerender(baseParams({ savedAt: 1, dirty: true }));
    expect(result.current.showSaved).toBe(false);
  });

  it('handleSave calls onSave with the current scene and shows a "Saved" toast', async () => {
    const onSave = vi.fn(async () => true);
    const scene = emptySketchScene('a');
    const { result } = renderHook(() => useSketchSaveWorkflow(baseParams({ onSave, currentScene: () => scene })));
    await act(async () => {
      await result.current.handleSave();
    });
    expect(onSave).toHaveBeenCalledWith(scene);
    expect(result.current.showSaved).toBe(true);
    expect(result.current.toast).toEqual({ message: 'Saved', tone: 'success' });
  });

  it('handleSave does not show "Saved" when the host explicitly rejects (returns false)', async () => {
    const onSave = vi.fn(async () => false);
    const { result } = renderHook(() => useSketchSaveWorkflow(baseParams({ onSave })));
    await act(async () => {
      await result.current.handleSave();
    });
    expect(result.current.showSaved).toBe(false);
    expect(result.current.toast).toBeNull();
  });

  it('handleExportImage exports via the engine, calls onExportImage, and shows an actionable toast', async () => {
    const onExportImage = vi.fn(async (_base64: string, fileName: string) => ({ fileName }));
    const engine = createFakeSketchEditorEngine();
    const { result } = renderHook(() => useSketchSaveWorkflow(baseParams({ onExportImage, engine, fileName: 'diagram.excalidraw' })));
    await act(async () => {
      await result.current.handleExportImage();
    });
    expect(onExportImage).toHaveBeenCalledTimes(1);
    const [base64, requestedFileName] = onExportImage.mock.calls[0]!;
    expect(typeof base64).toBe('string');
    expect(requestedFileName).toBe('diagram.png');
    expect(result.current.toast).toEqual({
      message: 'Image exported',
      details: 'diagram.png',
      tone: 'success',
      actionFileName: 'diagram.png',
    });
  });

  it('handleExportImage is a no-op without an onExportImage handler', async () => {
    const engine = createFakeSketchEditorEngine();
    const exportToBlob = vi.spyOn(engine, 'exportToBlob');
    const { result } = renderHook(() => useSketchSaveWorkflow(baseParams({ engine, onExportImage: undefined })));
    await act(async () => {
      await result.current.handleExportImage();
    });
    expect(exportToBlob).not.toHaveBeenCalled();
  });

  it('handleExportImage surfaces an error toast when export fails', async () => {
    const engine = createFakeSketchEditorEngine({
      exportToBlob: async () => {
        throw new Error('boom');
      },
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onExportImage = vi.fn();
    const { result } = renderHook(() => useSketchSaveWorkflow(baseParams({ engine, onExportImage })));
    await act(async () => {
      await result.current.handleExportImage();
    });
    expect(result.current.toast).toEqual({ message: 'Could not export image', tone: 'error' });
    expect(onExportImage).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('handleToastAction opens the exported file and clears the toast', async () => {
    const onOpenExportedImage = vi.fn();
    const onExportImage = vi.fn(async (_b: string, fileName: string) => ({ fileName }));
    const { result } = renderHook(() => useSketchSaveWorkflow(baseParams({ onExportImage, onOpenExportedImage })));
    await act(async () => {
      await result.current.handleExportImage();
    });
    act(() => {
      result.current.handleToastAction();
    });
    expect(onOpenExportedImage).toHaveBeenCalledWith('diagram.png');
    expect(result.current.toast).toBeNull();
  });

  it('dismissToast clears the toast', async () => {
    const onSave = vi.fn(async () => true);
    const { result } = renderHook(() => useSketchSaveWorkflow(baseParams({ onSave })));
    await act(async () => {
      await result.current.handleSave();
    });
    expect(result.current.toast).not.toBeNull();
    act(() => {
      result.current.dismissToast();
    });
    expect(result.current.toast).toBeNull();
  });
});
