import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePresentMode, useWiredPresentMode } from '../../../react/hooks/usePresentMode.js';
import type { HtmlViewerDependencies } from '../../../ports.js';

function makeFakeDependencies(initialFullscreenElement: Element | null = null): {
  deps: HtmlViewerDependencies;
  fireFullscreenChange(el: Element | null): void;
} {
  let current = initialFullscreenElement;
  let listener: (() => void) | null = null;
  const deps: HtmlViewerDependencies = {
    fullscreen: {
      requestFullscreen: vi.fn().mockResolvedValue(undefined),
      exitFullscreen: vi.fn().mockResolvedValue(undefined),
      fullscreenElement: () => current,
      subscribeFullscreenChange: (onChange) => {
        listener = onChange;
        return () => {
          listener = null;
        };
      },
    },
    newTabPreview: {
      openInNewTab: vi.fn(),
    },
  };
  return {
    deps,
    fireFullscreenChange(el) {
      current = el;
      listener?.();
    },
  };
}

describe('usePresentMode', () => {
  it('reflects the dependencies fullscreenElement at mount', () => {
    const fakeEl = {} as Element;
    const { deps } = makeFakeDependencies(fakeEl);
    const { result } = renderHook(() => usePresentMode(deps));
    expect(result.current.isFullscreen).toBe(true);
  });

  it('starts not fullscreen when nothing is fullscreen yet', () => {
    const { deps } = makeFakeDependencies(null);
    const { result } = renderHook(() => usePresentMode(deps));
    expect(result.current.isFullscreen).toBe(false);
  });

  it('updates isFullscreen when the browser reports a fullscreenchange', () => {
    const { deps, fireFullscreenChange } = makeFakeDependencies(null);
    const { result } = renderHook(() => usePresentMode(deps));

    act(() => fireFullscreenChange({} as Element));
    expect(result.current.isFullscreen).toBe(true);

    act(() => fireFullscreenChange(null));
    expect(result.current.isFullscreen).toBe(false);
  });

  it('presentFullscreen requests fullscreen on the given element', () => {
    const { deps } = makeFakeDependencies();
    const { result } = renderHook(() => usePresentMode(deps));
    const el = {} as HTMLElement;

    result.current.presentFullscreen(el);

    expect(deps.fullscreen.requestFullscreen).toHaveBeenCalledWith(el);
  });

  it('presentFullscreen is a no-op with a null element', () => {
    const { deps } = makeFakeDependencies();
    const { result } = renderHook(() => usePresentMode(deps));

    result.current.presentFullscreen(null);

    expect(deps.fullscreen.requestFullscreen).not.toHaveBeenCalled();
  });

  it('exitFullscreen calls the dependency', () => {
    const { deps } = makeFakeDependencies();
    const { result } = renderHook(() => usePresentMode(deps));

    result.current.exitFullscreen();

    expect(deps.fullscreen.exitFullscreen).toHaveBeenCalledTimes(1);
  });

  it('presentInNewTab delegates to the newTabPreview port', () => {
    const { deps } = makeFakeDependencies();
    const { result } = renderHook(() => usePresentMode(deps));

    result.current.presentInNewTab('<p>hi</p>', 'Title');

    expect(deps.newTabPreview.openInNewTab).toHaveBeenCalledWith('<p>hi</p>', 'Title');
  });
});

describe('useWiredPresentMode', () => {
  it('binds the real default dependencies and exposes the same controller shape', () => {
    const { result } = renderHook(() => useWiredPresentMode());
    expect(typeof result.current.isFullscreen).toBe('boolean');
    expect(typeof result.current.presentFullscreen).toBe('function');
    expect(typeof result.current.exitFullscreen).toBe('function');
    // Exercises the real openSandboxedPreviewInNewTab path (safely a no-op
    // under jsdom, which has no real Blob-URL/window.open support) rather
    // than asserting nothing about the wired binding at all.
    expect(() => result.current.presentInNewTab('<p>hi</p>', 'Title')).not.toThrow();
  });
});
