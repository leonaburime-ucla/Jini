import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePreviewCanvasSize } from './usePreviewCanvasSize.js';

function Harness({ onSize }: { onSize: (size: { width: number; height: number } | undefined) => void }) {
  const [ref, size] = usePreviewCanvasSize<HTMLDivElement>();
  onSize(size);
  return <div ref={ref} data-testid="measured" />;
}

/** Calls the hook without ever attaching its ref to an element. */
function UnattachedHarness() {
  usePreviewCanvasSize<HTMLDivElement>();
  return null;
}

describe('usePreviewCanvasSize', () => {
  const originalResizeObserver = globalThis.ResizeObserver;

  afterEach(() => {
    globalThis.ResizeObserver = originalResizeObserver;
    vi.restoreAllMocks();
  });

  it('measures the mounted element via getBoundingClientRect', () => {
    class FakeResizeObserver {
      observe() {}
      disconnect() {}
    }
    globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
    vi.spyOn(HTMLDivElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 640,
      height: 480,
      top: 0,
      left: 0,
      right: 640,
      bottom: 480,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const sizes: Array<{ width: number; height: number } | undefined> = [];
    render(<Harness onSize={(s) => sizes.push(s)} />);

    expect(sizes.at(-1)).toEqual({ width: 640, height: 480 });
  });

  it('observes the element via ResizeObserver when available', () => {
    const observeSpy = vi.fn();
    class FakeResizeObserver {
      observe = observeSpy;
      disconnect() {}
    }
    globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
    vi.spyOn(HTMLDivElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 100,
      height: 100,
      top: 0,
      left: 0,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    render(<Harness onSize={() => {}} />);
    expect(observeSpy).toHaveBeenCalledTimes(1);
  });

  it('re-measures when ResizeObserver fires its callback', () => {
    let observedCallback: (() => void) | null = null;
    let call = 0;
    class FakeResizeObserver {
      constructor(cb: () => void) {
        observedCallback = cb;
      }
      observe() {}
      disconnect() {}
    }
    globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
    vi.spyOn(HTMLDivElement.prototype, 'getBoundingClientRect').mockImplementation(() => {
      call += 1;
      const size = call === 1 ? 200 : 400;
      return {
        width: size,
        height: size,
        top: 0,
        left: 0,
        right: size,
        bottom: size,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };
    });

    const sizes: Array<{ width: number; height: number } | undefined> = [];
    render(<Harness onSize={(s) => sizes.push(s)} />);
    expect(sizes.at(-1)).toEqual({ width: 200, height: 200 });

    act(() => {
      observedCallback?.();
    });
    expect(sizes.at(-1)).toEqual({ width: 400, height: 400 });
  });

  it('re-measures on a window resize event when ResizeObserver is unavailable', () => {
    // @ts-expect-error -- simulate an environment without ResizeObserver
    delete globalThis.ResizeObserver;
    let call = 0;
    vi.spyOn(HTMLDivElement.prototype, 'getBoundingClientRect').mockImplementation(() => {
      call += 1;
      const size = call === 1 ? 50 : 75;
      return {
        width: size,
        height: size,
        top: 0,
        left: 0,
        right: size,
        bottom: size,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };
    });

    const sizes: Array<{ width: number; height: number } | undefined> = [];
    render(<Harness onSize={(s) => sizes.push(s)} />);
    expect(sizes.at(-1)).toEqual({ width: 50, height: 50 });

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(sizes.at(-1)).toEqual({ width: 75, height: 75 });
  });

  it('cleans up the observer and resize listener on unmount', () => {
    const disconnect = vi.fn();
    class FakeResizeObserver {
      observe() {}
      disconnect = disconnect;
    }
    globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
    vi.spyOn(HTMLDivElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 10,
      height: 10,
      top: 0,
      left: 0,
      right: 10,
      bottom: 10,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const { unmount } = render(<Harness onSize={() => {}} />);
    unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when the ref was never attached to an element', () => {
    const observeSpy = vi.fn();
    class FakeResizeObserver {
      observe = observeSpy;
      disconnect() {}
    }
    globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
    expect(() => render(<UnattachedHarness />)).not.toThrow();
    expect(observeSpy).not.toHaveBeenCalled();
  });
});
