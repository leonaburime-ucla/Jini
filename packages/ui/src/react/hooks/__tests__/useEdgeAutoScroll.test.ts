// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEdgeAutoScroll, type EdgeAutoScroll } from '../useEdgeAutoScroll.js';

interface RafController {
  flush(times?: number): void;
  pendingCount(): number;
}

function mockRaf(): RafController {
  let nextId = 1;
  const callbacks = new Map<number, FrameRequestCallback>();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
    const id = nextId++;
    callbacks.set(id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number): void => {
    callbacks.delete(id);
  });
  return {
    flush(times = 1) {
      for (let i = 0; i < times; i++) {
        const entries = Array.from(callbacks.entries());
        callbacks.clear();
        entries.forEach(([, cb]) => cb(0));
      }
    },
    pendingCount() {
      return callbacks.size;
    },
  };
}

function attachScrollMetrics(
  el: HTMLDivElement,
  { clientWidth, scrollWidth, scrollLeft = 0 }: { clientWidth: number; scrollWidth: number; scrollLeft?: number },
) {
  let sl = scrollLeft;
  Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => clientWidth });
  Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => scrollWidth });
  Object.defineProperty(el, 'scrollLeft', {
    configurable: true,
    get: () => sl,
    set: (v: number) => {
      sl = v;
    },
  });
  el.scrollBy = vi.fn(({ left = 0 }: ScrollToOptions = {}) => {
    sl += left;
    el.dispatchEvent(new Event('scroll'));
  }) as typeof el.scrollBy;
  return {
    dispatchScroll(nextScrollLeft: number) {
      sl = nextScrollLeft;
      el.dispatchEvent(new Event('scroll'));
    },
  };
}

// `useEdgeAutoScroll` only ever attaches its ref via consumer JSX — a bare
// `renderHook` never mounts a DOM node — so a tiny host component is needed
// to get a real `scrollRef.current`.
function renderWithHost(initialKey?: unknown, attachRef = true) {
  let latest!: EdgeAutoScroll;
  function Host({ contentKey }: { contentKey?: unknown }) {
    latest = useEdgeAutoScroll(contentKey);
    return createElement('div', attachRef ? { ref: latest.scrollRef } : {});
  }
  const container = document.createElement('div');
  document.body.appendChild(container);
  const utils = render(createElement(Host, { contentKey: initialKey }), { container });
  return {
    unmount: utils.unmount,
    get current() {
      return latest;
    },
    rerenderWithKey(key: unknown) {
      utils.rerender(createElement(Host, { contentKey: key }));
    },
  };
}

describe('useEdgeAutoScroll', () => {
  let raf: RafController;

  beforeEach(() => {
    raf = mockRaf();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('skips edge measurement entirely when the ref is never attached to an element', () => {
    const h = renderWithHost(undefined, false);
    expect(h.current.scrollRef.current).toBeNull();
    expect(h.current.edges).toEqual({ left: false, right: false });
    expect(() => h.unmount()).not.toThrow();
  });

  it('computes initial edges from the mounted element scroll metrics', () => {
    const h = renderWithHost();
    const el = h.current.scrollRef.current as HTMLDivElement;
    attachScrollMetrics(el, { clientWidth: 100, scrollWidth: 300 });
    // Metrics are attached after mount; re-run the measuring effect.
    h.rerenderWithKey('re-measure');
    expect(h.current.edges).toEqual({ left: false, right: true });
  });

  it('reflects a scrolled-to-the-middle position in both edges', () => {
    const h = renderWithHost();
    const el = h.current.scrollRef.current as HTMLDivElement;
    const metrics = attachScrollMetrics(el, { clientWidth: 100, scrollWidth: 300 });
    act(() => {
      metrics.dispatchScroll(150);
    });
    expect(h.current.edges).toEqual({ left: true, right: true });
  });

  it('reflects a scroll to the far right', () => {
    const h = renderWithHost();
    const el = h.current.scrollRef.current as HTMLDivElement;
    const metrics = attachScrollMetrics(el, { clientWidth: 100, scrollWidth: 300 });
    act(() => {
      metrics.dispatchScroll(200);
    });
    expect(h.current.edges).toEqual({ left: true, right: false });
  });

  it('nudges the scroll position by the click-jump distance in the given direction', () => {
    const h = renderWithHost();
    const el = h.current.scrollRef.current as HTMLDivElement;
    attachScrollMetrics(el, { clientWidth: 100, scrollWidth: 1000 });
    act(() => {
      h.current.nudge(1);
    });
    expect(el.scrollBy).toHaveBeenCalledWith({ left: 332, behavior: 'smooth' });
    act(() => {
      h.current.nudge(-1);
    });
    expect(el.scrollBy).toHaveBeenCalledWith({ left: -332, behavior: 'smooth' });
  });

  it('does nothing when nudge is called before the element is attached', () => {
    const h = renderWithHost();
    (h.current.scrollRef as { current: HTMLDivElement | null }).current = null;
    expect(() => h.current.nudge(1)).not.toThrow();
  });

  it('does nothing when startAutoScroll is called before the element is attached', () => {
    const h = renderWithHost();
    (h.current.scrollRef as { current: HTMLDivElement | null }).current = null;
    act(() => {
      h.current.startAutoScroll(1);
    });
    expect(() => raf.flush()).not.toThrow();
  });

  it('glides the scroll position forward one STEP_PX per frame until the max is reached', () => {
    const h = renderWithHost();
    const el = h.current.scrollRef.current as HTMLDivElement;
    attachScrollMetrics(el, { clientWidth: 100, scrollWidth: 118 }); // maxScroll = 18, 2 steps of 9
    act(() => {
      h.current.startAutoScroll(1);
    });
    act(() => raf.flush());
    expect(el.scrollLeft).toBe(9);
    expect(raf.pendingCount()).toBe(1); // not yet at max, re-armed
    act(() => raf.flush());
    expect(el.scrollLeft).toBe(18);
    expect(raf.pendingCount()).toBe(0); // reached max, stopped
  });

  it('glides backward and stops at 0', () => {
    const h = renderWithHost();
    const el = h.current.scrollRef.current as HTMLDivElement;
    attachScrollMetrics(el, { clientWidth: 100, scrollWidth: 200, scrollLeft: 9 });
    act(() => {
      h.current.startAutoScroll(-1);
    });
    act(() => raf.flush());
    expect(el.scrollLeft).toBe(0);
    expect(raf.pendingCount()).toBe(0);
  });

  it('cancels an in-flight glide via stopAutoScroll', () => {
    const h = renderWithHost();
    const el = h.current.scrollRef.current as HTMLDivElement;
    attachScrollMetrics(el, { clientWidth: 100, scrollWidth: 1000 });
    act(() => {
      h.current.startAutoScroll(1);
    });
    expect(raf.pendingCount()).toBe(1);
    act(() => {
      h.current.stopAutoScroll();
    });
    expect(raf.pendingCount()).toBe(0);
    act(() => raf.flush());
    expect(el.scrollLeft).toBe(0);
  });

  it('restarting startAutoScroll cancels the previous glide first', () => {
    const h = renderWithHost();
    const el = h.current.scrollRef.current as HTMLDivElement;
    attachScrollMetrics(el, { clientWidth: 100, scrollWidth: 1000 });
    act(() => {
      h.current.startAutoScroll(1);
    });
    act(() => {
      h.current.startAutoScroll(1);
    });
    expect(raf.pendingCount()).toBe(1);
  });

  it('cancels the in-flight glide on unmount', () => {
    const h = renderWithHost();
    const el = h.current.scrollRef.current as HTMLDivElement;
    attachScrollMetrics(el, { clientWidth: 100, scrollWidth: 1000 });
    act(() => {
      h.current.startAutoScroll(1);
    });
    expect(raf.pendingCount()).toBe(1);
    h.unmount();
    expect(raf.pendingCount()).toBe(0);
  });

  it('observes and disconnects a ResizeObserver when one is available', () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    class FakeResizeObserver {
      observe = observe;
      disconnect = disconnect;
      unobserve = vi.fn();
      constructor(_cb: ResizeObserverCallback) {}
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);

    const h = renderWithHost();
    const el = h.current.scrollRef.current as HTMLDivElement;
    attachScrollMetrics(el, { clientWidth: 100, scrollWidth: 300 });
    h.rerenderWithKey('re-observe');
    expect(observe).toHaveBeenCalledWith(el);
    h.unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it('skips ResizeObserver wiring when it is unavailable (jsdom default)', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const h = renderWithHost();
    const el = h.current.scrollRef.current as HTMLDivElement;
    expect(() => attachScrollMetrics(el, { clientWidth: 100, scrollWidth: 300 })).not.toThrow();
    expect(() => h.unmount()).not.toThrow();
  });

  it('re-measures edges when contentKey changes', () => {
    const h = renderWithHost('a');
    const el = h.current.scrollRef.current as HTMLDivElement;
    attachScrollMetrics(el, { clientWidth: 100, scrollWidth: 300 });
    h.rerenderWithKey('b');
    expect(h.current.edges).toEqual({ left: false, right: true });
  });

  it('removes the scroll listener on unmount without throwing', () => {
    const h = renderWithHost();
    const el = h.current.scrollRef.current as HTMLDivElement;
    const metrics = attachScrollMetrics(el, { clientWidth: 100, scrollWidth: 300 });
    h.unmount();
    expect(() => metrics.dispatchScroll(50)).not.toThrow();
  });
});
