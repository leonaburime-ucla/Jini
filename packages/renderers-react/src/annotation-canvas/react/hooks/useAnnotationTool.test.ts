import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAnnotationTool } from './useAnnotationTool.js';

describe('useAnnotationTool', () => {
  it('defaults to the box tool with the menu closed', () => {
    const { result } = renderHook(() => useAnnotationTool());
    expect(result.current.tool).toBe('box');
    expect(result.current.menuOpen).toBe(false);
  });

  it('selectTool switches tools, closes the menu, and reports the mapped toolbar element', () => {
    const onToolbarClick = vi.fn();
    const { result } = renderHook(() => useAnnotationTool(onToolbarClick));
    act(() => result.current.toggleMenu());
    expect(result.current.menuOpen).toBe(true);

    act(() => result.current.selectTool('text'));
    expect(result.current.tool).toBe('text');
    expect(result.current.menuOpen).toBe(false);
    expect(onToolbarClick).toHaveBeenCalledWith('text');

    act(() => result.current.selectTool('box'));
    expect(onToolbarClick).toHaveBeenCalledWith('rect');

    act(() => result.current.selectTool('pen'));
    expect(onToolbarClick).toHaveBeenCalledWith('pen');
  });

  // The outside-pointer-down close depends on `menuRef` being attached to a
  // real rendered element — renderHook mounts no JSX, so `menuRef.current`
  // stays null here. That path is covered at the component level instead
  // (MarkToolControl / AnnotationCanvas), where the ref is really attached.

  it('closes the menu on Escape without throwing', () => {
    const { result } = renderHook(() => useAnnotationTool());
    act(() => result.current.toggleMenu());
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(result.current.menuOpen).toBe(false);
  });
});
