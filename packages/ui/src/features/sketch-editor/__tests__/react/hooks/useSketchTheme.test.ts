import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSketchTheme } from '../../../react/hooks/useSketchTheme.js';

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

/** jsdom ships no `matchMedia` implementation (`window.matchMedia` is
 *  `undefined`), so `window.matchMedia?.(...)` always short-circuits unless
 *  a test stubs it — this fake records the listener the hook registers so
 *  the test can fire a synthetic OS-theme-change event by hand. */
function stubMatchMedia(): { fireChange: () => void; removeEventListener: ReturnType<typeof vi.fn> } {
  const listeners = new Set<() => void>();
  const removeEventListener = vi.fn((_event: string, listener: () => void) => {
    listeners.delete(listener);
  });
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
      removeEventListener,
    }),
  );
  return { fireChange: () => listeners.forEach((listener) => listener()), removeEventListener };
}

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

  it('re-reads the theme when the OS prefers-color-scheme changes', async () => {
    const { fireChange } = stubMatchMedia();
    try {
      const { result } = renderHook(() => useSketchTheme());
      expect(result.current).toBe('light');

      await act(async () => {
        document.documentElement.setAttribute('data-theme', 'dark');
        fireChange();
      });
      expect(result.current).toBe('dark');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('unsubscribes the prefers-color-scheme listener on unmount', () => {
    const { removeEventListener } = stubMatchMedia();
    try {
      const { unmount } = renderHook(() => useSketchTheme());
      unmount();
      expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
