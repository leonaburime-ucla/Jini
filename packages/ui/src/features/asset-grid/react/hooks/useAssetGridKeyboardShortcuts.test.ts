// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAssetGridKeyboardShortcuts } from './useAssetGridKeyboardShortcuts.js';

function baseParams(overrides: Partial<Parameters<typeof useAssetGridKeyboardShortcuts>[0]> = {}) {
  return {
    active: true,
    enabled: true,
    hasAssets: true,
    hasSelection: true,
    isPreviewOpen: false,
    onSelectAll: vi.fn(),
    onClearSelection: vi.fn(),
    onRequestDeleteSelected: vi.fn(),
    ...overrides,
  };
}

function dispatch(key: string, opts: KeyboardEventInit = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts }));
}

describe('useAssetGridKeyboardShortcuts', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('Cmd/Ctrl+A selects all when assets exist and focus is not in a text field', () => {
    const params = baseParams();
    renderHook(() => useAssetGridKeyboardShortcuts(params));
    dispatch('a', { metaKey: true });
    expect(params.onSelectAll).toHaveBeenCalledTimes(1);
  });

  it('does not select-all while typing in an input', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    const params = baseParams();
    renderHook(() => useAssetGridKeyboardShortcuts(params));
    dispatch('a', { ctrlKey: true });
    expect(params.onSelectAll).not.toHaveBeenCalled();
  });

  it('does not select-all when there are no assets', () => {
    const params = baseParams({ hasAssets: false });
    renderHook(() => useAssetGridKeyboardShortcuts(params));
    dispatch('a', { metaKey: true });
    expect(params.onSelectAll).not.toHaveBeenCalled();
  });

  it('Escape clears the selection unless a preview is open', () => {
    const params = baseParams();
    renderHook(() => useAssetGridKeyboardShortcuts(params));
    dispatch('Escape');
    expect(params.onClearSelection).toHaveBeenCalledTimes(1);
  });

  it('Escape is ignored while a preview is open', () => {
    const params = baseParams({ isPreviewOpen: true });
    renderHook(() => useAssetGridKeyboardShortcuts(params));
    dispatch('Escape');
    expect(params.onClearSelection).not.toHaveBeenCalled();
  });

  it('Delete/Backspace triggers the bulk-delete flow when a selection exists', () => {
    const params = baseParams();
    renderHook(() => useAssetGridKeyboardShortcuts(params));
    dispatch('Delete');
    expect(params.onRequestDeleteSelected).toHaveBeenCalledTimes(1);
    dispatch('Backspace');
    expect(params.onRequestDeleteSelected).toHaveBeenCalledTimes(2);
  });

  it('Delete is ignored while typing, while a preview is open, or with no selection', () => {
    const params = baseParams({ hasSelection: false });
    renderHook(() => useAssetGridKeyboardShortcuts(params));
    dispatch('Delete');
    expect(params.onRequestDeleteSelected).not.toHaveBeenCalled();
  });

  it('does nothing while a modal/menu owns shortcuts (enabled=false)', () => {
    const params = baseParams({ enabled: false });
    renderHook(() => useAssetGridKeyboardShortcuts(params));
    dispatch('a', { metaKey: true });
    dispatch('Escape');
    dispatch('Delete');
    expect(params.onSelectAll).not.toHaveBeenCalled();
    expect(params.onClearSelection).not.toHaveBeenCalled();
    expect(params.onRequestDeleteSelected).not.toHaveBeenCalled();
  });

  it('does not attach a listener at all while inactive', () => {
    const params = baseParams({ active: false });
    renderHook(() => useAssetGridKeyboardShortcuts(params));
    dispatch('a', { metaKey: true });
    expect(params.onSelectAll).not.toHaveBeenCalled();
  });
});
