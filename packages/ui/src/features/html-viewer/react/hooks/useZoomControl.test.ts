import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useZoomControl } from './useZoomControl.js';

describe('useZoomControl', () => {
  it('defaults to 100% zoom, closed menu, and the default preset levels', () => {
    const { result } = renderHook(() => useZoomControl());
    expect(result.current.zoom).toBe(100);
    expect(result.current.scale).toBe(1);
    expect(result.current.isMenuOpen).toBe(false);
    expect(result.current.levels).toEqual([50, 75, 100, 125, 150, 200]);
  });

  it('accepts a custom level set and initial zoom', () => {
    const { result } = renderHook(() => useZoomControl([25, 50], 25));
    expect(result.current.zoom).toBe(25);
    expect(result.current.levels).toEqual([25, 50]);
  });

  it('toggles and closes the menu', () => {
    const { result } = renderHook(() => useZoomControl());
    act(() => result.current.toggleMenu());
    expect(result.current.isMenuOpen).toBe(true);
    act(() => result.current.toggleMenu());
    expect(result.current.isMenuOpen).toBe(false);
    act(() => result.current.toggleMenu());
    act(() => result.current.closeMenu());
    expect(result.current.isMenuOpen).toBe(false);
  });

  it('setZoom updates the zoom, recomputes scale, and closes the menu', () => {
    const { result } = renderHook(() => useZoomControl());
    act(() => result.current.toggleMenu());
    act(() => result.current.setZoom(150));
    expect(result.current.zoom).toBe(150);
    expect(result.current.scale).toBe(1.5);
    expect(result.current.isMenuOpen).toBe(false);
  });
});
