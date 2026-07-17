import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useSketchTheme } from './useSketchTheme.js';

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe('useSketchTheme', () => {
  it('starts by reading data-theme off <html>', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    const { result } = renderHook(() => useSketchTheme());
    expect(result.current).toBe('dark');
  });

  it('defaults to light when data-theme is unset', () => {
    const { result } = renderHook(() => useSketchTheme());
    expect(result.current).toBe('light');
  });

  it('re-reads the theme when data-theme mutates', async () => {
    const { result } = renderHook(() => useSketchTheme());
    expect(result.current).toBe('light');

    await act(async () => {
      document.documentElement.setAttribute('data-theme', 'dark');
      // MutationObserver callbacks fire as a microtask.
      await Promise.resolve();
    });

    expect(result.current).toBe('dark');
  });
});
