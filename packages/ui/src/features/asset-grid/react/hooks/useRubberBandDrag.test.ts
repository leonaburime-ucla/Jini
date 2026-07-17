// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useRubberBandDrag } from './useRubberBandDrag.js';
import { ASSET_ID_ATTR } from '../../constants.js';

function makeCard(id: string, rect: { left: number; top: number; right: number; bottom: number }): HTMLElement {
  const card = document.createElement('div');
  card.setAttribute(ASSET_ID_ATTR, id);
  card.getBoundingClientRect = () => ({ ...rect, width: 0, height: 0, x: rect.left, y: rect.top, toJSON() {} }) as DOMRect;
  return card;
}

function useHarness(containerRef: React.RefObject<HTMLElement | null>) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const drag = useRubberBandDrag({ containerRef, selectedIds, setSelectedIds });
  return { ...drag, selectedIds, setSelectedIds };
}

function fireMouseDown(onMouseDown: (e: React.MouseEvent) => void, opts: Partial<React.MouseEvent> & { target: EventTarget }) {
  onMouseDown({ button: 0, clientX: 0, clientY: 0, metaKey: false, ctrlKey: false, shiftKey: false, ...opts } as React.MouseEvent);
}

describe('useRubberBandDrag', () => {
  let container: HTMLElement;
  let cardA: HTMLElement;
  let cardB: HTMLElement;
  let cardC: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    cardA = makeCard('a', { left: 0, top: 0, right: 10, bottom: 10 });
    cardB = makeCard('b', { left: 20, top: 20, right: 30, bottom: 30 });
    cardC = makeCard('c', { left: 100, top: 100, right: 110, bottom: 110 });
    container.append(cardA, cardB, cardC);
    document.body.appendChild(container);
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;
  });

  afterEach(() => {
    container.remove();
  });

  it('drags a band that selects every card it intersects', () => {
    const containerRef = { current: container };
    const { result } = renderHook(() => useHarness(containerRef));

    act(() => fireMouseDown(result.current.onMouseDown, { target: container }));
    expect(result.current.dragging).toBe(true);

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 25, clientY: 25 }));
    });
    expect([...result.current.selectedIds].sort()).toEqual(['a', 'b']);

    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup'));
    });
    expect(result.current.dragging).toBe(false);
    expect(result.current.band).toBeNull();
    // A real drag (moved) leaves the selection as-is on mouseup.
    expect([...result.current.selectedIds].sort()).toEqual(['a', 'b']);
  });

  it('starting the drag on a card is not a box-select (mousedown is ignored)', () => {
    const containerRef = { current: container };
    const { result } = renderHook(() => useHarness(containerRef));
    act(() => fireMouseDown(result.current.onMouseDown, { target: cardA }));
    expect(result.current.dragging).toBe(false);
  });

  it('a plain click on empty space (no movement) clears the selection', () => {
    const containerRef = { current: container };
    const { result } = renderHook(() => useHarness(containerRef));
    act(() => result.current.setSelectedIds(new Set(['a'])));

    act(() => fireMouseDown(result.current.onMouseDown, { target: container }));
    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup'));
    });
    expect(result.current.selectedIds.size).toBe(0);
  });

  it('an additive drag (shift-held) keeps the prior selection as its base', () => {
    const containerRef = { current: container };
    const { result } = renderHook(() => useHarness(containerRef));
    act(() => result.current.setSelectedIds(new Set(['c'])));

    act(() => fireMouseDown(result.current.onMouseDown, { target: container, shiftKey: true }));
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 25, clientY: 25 }));
    });
    expect([...result.current.selectedIds].sort()).toEqual(['a', 'b', 'c']);
  });

  it('a non-primary-button mousedown (e.g. right-click) does not start a box-select', () => {
    const containerRef = { current: container };
    const { result } = renderHook(() => useHarness(containerRef));
    act(() => fireMouseDown(result.current.onMouseDown, { target: container, button: 2 }));
    expect(result.current.dragging).toBe(false);
  });

  it('scrolling during an active drag re-snapshots card rects so the band tracks scrolled content', () => {
    const containerRef = { current: container };
    const { result } = renderHook(() => useHarness(containerRef));

    act(() => fireMouseDown(result.current.onMouseDown, { target: container }));
    // Card B moves into the drag's path only after the "scroll".
    cardB.getBoundingClientRect = () => ({ left: 0, top: 0, right: 5, bottom: 5, width: 5, height: 5, x: 0, y: 0, toJSON() {} }) as DOMRect;
    act(() => {
      window.dispatchEvent(new MouseEvent('scroll'));
    });
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 3, clientY: 3 }));
    });
    expect([...result.current.selectedIds].sort()).toEqual(['a', 'b']);
  });

  it('move/scroll events that arrive immediately after mouseup no-op (drag ref already cleared, listeners not yet detached)', () => {
    const containerRef = { current: container };
    const { result } = renderHook(() => useHarness(containerRef));
    act(() => fireMouseDown(result.current.onMouseDown, { target: container }));
    expect(() => {
      act(() => {
        // Dispatched inside the same act() batch as mouseup: `up()` already
        // ran synchronously and nulled the drag ref, but this effect's
        // mousemove/scroll listeners aren't detached until the *next*
        // commit's cleanup -- exercising `move`'s/`onScroll`'s own
        // `if (!d) return` guards for that real interleaving.
        window.dispatchEvent(new MouseEvent('mouseup'));
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: 5, clientY: 5 }));
        window.dispatchEvent(new MouseEvent('scroll'));
      });
    }).not.toThrow();
    expect(result.current.dragging).toBe(false);
  });

  it("a queued rAF apply() no-ops if the drag ends before its frame fires (mouseup races an in-flight rAF)", () => {
    const rafCallbacks: FrameRequestCallback[] = [];
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;

    const containerRef = { current: container };
    const { result } = renderHook(() => useHarness(containerRef));
    act(() => fireMouseDown(result.current.onMouseDown, { target: container }));
    act(() => {
      // Schedules (but, with the manual rAF queue above, does not yet run) apply().
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 25, clientY: 25 }));
    });
    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup'));
    });
    const selectionAfterMouseUp = new Set(result.current.selectedIds);
    // Flush the rAF callback that was queued *before* mouseup -- in a real
    // browser this frame can still fire after the drag ends but before
    // `cancelAnimationFrame` (called from this effect's cleanup) takes
    // effect; our test's `cancelAnimationFrame` stub is a no-op, standing in
    // for that race.
    expect(() => rafCallbacks.forEach((cb) => cb(0))).not.toThrow();
    expect(result.current.selectedIds).toEqual(selectionAfterMouseUp);
  });
});
