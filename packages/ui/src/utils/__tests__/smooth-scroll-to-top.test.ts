import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { smoothScrollToTop } from '../smooth-scroll-to-top.js';

function makeContainer(scrollTop: number): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'scrollTop', {
    value: scrollTop,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(el, 'scrollLeft', { value: 0, writable: true, configurable: true });
  document.body.appendChild(el);
  return el;
}

describe('smoothScrollToTop', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('is a no-op when already scrolled to the top', () => {
    const el = makeContainer(0);
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');
    smoothScrollToTop(el);
    expect(rafSpy).not.toHaveBeenCalled();
  });

  it('jumps instantly under prefers-reduced-motion', () => {
    const el = makeContainer(500);
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);

    smoothScrollToTop(el);

    expect(el.scrollTop).toBe(0);
  });

  it('jumps instantly when requestAnimationFrame is unavailable', () => {
    const el = makeContainer(500);
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);
    const original = window.requestAnimationFrame;
    // @ts-expect-error -- simulate an environment without rAF
    delete window.requestAnimationFrame;

    smoothScrollToTop(el);
    expect(el.scrollTop).toBe(0);

    window.requestAnimationFrame = original;
  });

  it('animates scrollTop toward 0 across frames, then settles at 0', () => {
    const el = makeContainer(120);
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);

    let now = 0;
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    smoothScrollToTop(el);
    expect(frames).toHaveLength(1);

    // Drive the tween to completion by advancing "now" past the duration
    // (MIN_DURATION_MS=260 + 120/6=20 => 280ms) and re-running the queued
    // frame callback each tick.
    for (let i = 0; i < 10 && frames.length > 0; i += 1) {
      now += 50;
      const cb = frames.shift()!;
      cb(now);
    }

    expect(el.scrollTop).toBe(0);
  });

  it('cancels an in-flight tween when the user scrolls (wheel)', () => {
    const el = makeContainer(120);
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    const cancelSpy = vi.fn();
    vi.stubGlobal('cancelAnimationFrame', cancelSpy);

    smoothScrollToTop(el);
    el.dispatchEvent(new Event('wheel'));

    expect(cancelSpy).toHaveBeenCalled();
  });

  it('retargets instead of running two competing tweens on the same container', () => {
    const el = makeContainer(120);
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);
    const rafCalls = vi.fn(() => 1);
    vi.stubGlobal('requestAnimationFrame', rafCalls);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    smoothScrollToTop(el);
    smoothScrollToTop(el);

    // Second call cancels the first tween's frame before scheduling its own.
    expect(rafCalls).toHaveBeenCalledTimes(2);
  });
});
