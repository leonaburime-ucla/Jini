import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DragEvent as ReactDragEvent } from 'react';
import { useCommentReorder } from './useCommentReorder.js';
import { COMMENT_SIDE_DRAG_MIME } from '../../constants.js';

function makeDataTransfer(initial: Record<string, string> = {}) {
  const store = { ...initial };
  return {
    effectAllowed: '',
    dropEffect: '',
    setData: vi.fn((type: string, value: string) => {
      store[type] = value;
    }),
    getData: vi.fn((type: string) => store[type] ?? ''),
  };
}

function makeDragEvent(overrides: Partial<{ clientY: number; rect: { top: number; height: number }; dataTransfer: ReturnType<typeof makeDataTransfer>; relatedTarget: unknown; contains: (n: unknown) => boolean }> = {}) {
  const rect = overrides.rect ?? { top: 0, height: 100 };
  const dataTransfer = overrides.dataTransfer ?? makeDataTransfer();
  const contains = overrides.contains ?? (() => false);
  return {
    clientY: overrides.clientY ?? 10,
    dataTransfer,
    relatedTarget: overrides.relatedTarget ?? null,
    preventDefault: vi.fn(),
    currentTarget: {
      getBoundingClientRect: () => rect,
      contains,
    },
  } as unknown as ReactDragEvent<HTMLElement>;
}

describe('useCommentReorder', () => {
  it('reports canReorder false with fewer than 2 ids or no onReorder', () => {
    const { result: noCallback } = renderHook(() => useCommentReorder(['a', 'b'], undefined));
    expect(noCallback.current.canReorder).toBe(false);

    const onReorder = vi.fn();
    const { result: tooFew } = renderHook(() => useCommentReorder(['a'], onReorder));
    expect(tooFew.current.canReorder).toBe(false);

    const { result: ok } = renderHook(() => useCommentReorder(['a', 'b'], onReorder));
    expect(ok.current.canReorder).toBe(true);
  });

  it('drives a full drag/dragover/drop reorder', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() => useCommentReorder(['a', 'b', 'c'], onReorder));

    const dataTransfer = makeDataTransfer();

    act(() => {
      result.current.onDragStart(makeDragEvent({ dataTransfer }), 'c');
    });
    expect(result.current.dragState).toEqual({ draggingId: 'c', overId: 'c', edge: null });
    expect(dataTransfer.setData).toHaveBeenCalledWith(COMMENT_SIDE_DRAG_MIME, 'c');

    act(() => {
      // clientY 10 with rect {top:0,height:100} -> midpoint 50 -> 'before'
      result.current.onDragOver(makeDragEvent({ dataTransfer, clientY: 10 }), 'a');
    });
    expect(result.current.dragState).toEqual({ draggingId: 'c', overId: 'a', edge: 'before' });

    act(() => {
      result.current.onDrop(makeDragEvent({ dataTransfer, clientY: 10 }), 'a');
    });
    expect(onReorder).toHaveBeenCalledWith(['c', 'a', 'b']);
    expect(result.current.dragState).toBeNull();
  });

  it('does nothing when reordering is disabled', () => {
    const { result } = renderHook(() => useCommentReorder(['a'], undefined));
    act(() => {
      result.current.onDragStart(makeDragEvent(), 'a');
    });
    expect(result.current.dragState).toBeNull();
  });

  it('no-ops a drop onto the same id', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() => useCommentReorder(['a', 'b'], onReorder));
    act(() => {
      result.current.onDragStart(makeDragEvent(), 'a');
    });
    act(() => {
      result.current.onDrop(makeDragEvent(), 'a');
    });
    expect(onReorder).not.toHaveBeenCalled();
    expect(result.current.dragState).toBeNull();
  });

  it('clears drag state on drag-leave once outside the container', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() => useCommentReorder(['a', 'b'], onReorder));
    act(() => {
      result.current.onDragStart(makeDragEvent(), 'a');
    });
    const outsideNode = document.createElement('div');
    act(() => {
      result.current.onDragLeaveContainer(makeDragEvent({ relatedTarget: outsideNode, contains: () => false }));
    });
    expect(result.current.dragState).toBeNull();
  });

  it('keeps drag state when drag-leave lands on a child of the container', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() => useCommentReorder(['a', 'b'], onReorder));
    act(() => {
      result.current.onDragStart(makeDragEvent(), 'a');
    });
    const childNode = document.createElement('div');
    act(() => {
      result.current.onDragLeaveContainer(makeDragEvent({ relatedTarget: childNode, contains: () => true }));
    });
    expect(result.current.dragState).not.toBeNull();
  });

  it('clear() resets drag state directly', () => {
    const onReorder = vi.fn();
    const { result } = renderHook(() => useCommentReorder(['a', 'b'], onReorder));
    act(() => {
      result.current.onDragStart(makeDragEvent(), 'a');
    });
    act(() => {
      result.current.clear();
    });
    expect(result.current.dragState).toBeNull();
  });
});
