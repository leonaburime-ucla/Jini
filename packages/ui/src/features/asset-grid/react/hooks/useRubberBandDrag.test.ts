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
});
