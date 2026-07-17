import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAnnotationKeyboardShortcuts } from './useAnnotationKeyboardShortcuts.js';

function fireKey(key: string, opts: Partial<KeyboardEventInit> = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts }));
}

describe('useAnnotationKeyboardShortcuts', () => {
  it('does nothing while inactive', () => {
    const onDeactivate = vi.fn();
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    renderHook(() => useAnnotationKeyboardShortcuts({ active: false, onDeactivate, onUndo, onRedo }));
    fireKey('Escape');
    fireKey('z', { metaKey: true });
    expect(onDeactivate).not.toHaveBeenCalled();
    expect(onUndo).not.toHaveBeenCalled();
  });

  it('Escape deactivates the overlay', () => {
    const onDeactivate = vi.fn();
    renderHook(() =>
      useAnnotationKeyboardShortcuts({ active: true, onDeactivate, onUndo: vi.fn(), onRedo: vi.fn() }),
    );
    fireKey('Escape');
    expect(onDeactivate).toHaveBeenCalledWith(false);
  });

  it('Cmd/Ctrl+Z undoes', () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    renderHook(() => useAnnotationKeyboardShortcuts({ active: true, onUndo, onRedo }));
    fireKey('z', { metaKey: true });
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onRedo).not.toHaveBeenCalled();

    fireKey('z', { ctrlKey: true });
    expect(onUndo).toHaveBeenCalledTimes(2);
  });

  it('Cmd/Ctrl+Shift+Z redoes (not undo)', () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    renderHook(() => useAnnotationKeyboardShortcuts({ active: true, onUndo, onRedo }));
    fireKey('z', { metaKey: true, shiftKey: true });
    expect(onRedo).toHaveBeenCalledTimes(1);
    expect(onUndo).not.toHaveBeenCalled();
  });

  it('is case-insensitive for the Z key', () => {
    const onUndo = vi.fn();
    renderHook(() => useAnnotationKeyboardShortcuts({ active: true, onUndo, onRedo: vi.fn() }));
    fireKey('Z', { metaKey: true });
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('ignores a bare Z without a modifier', () => {
    const onUndo = vi.fn();
    renderHook(() => useAnnotationKeyboardShortcuts({ active: true, onUndo, onRedo: vi.fn() }));
    fireKey('z');
    expect(onUndo).not.toHaveBeenCalled();
  });
});
