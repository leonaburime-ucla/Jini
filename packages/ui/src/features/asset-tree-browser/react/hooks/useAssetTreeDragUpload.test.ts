// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { DragEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useAssetTreeDragUpload } from './useAssetTreeDragUpload.js';

/** Flushes pending microtasks (a macrotask tick runs after every queued microtask) — more robust than guessing the exact number of `await Promise.resolve()` hops through nested async functions. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

interface FakeDataTransfer {
  items: unknown[];
  files: File[];
  dropEffect: string;
}

function dragEvent(
  overrides: Partial<Omit<DragEvent<Element>, 'dataTransfer'>> & { dataTransfer?: Partial<FakeDataTransfer> } = {},
): DragEvent<Element> {
  const currentTarget = { contains: () => false } as unknown as EventTarget & Element;
  const { dataTransfer, ...rest } = overrides;
  return {
    preventDefault: vi.fn(),
    dataTransfer: { items: [], files: [], dropEffect: 'none', ...dataTransfer } as unknown as DataTransfer,
    currentTarget,
    relatedTarget: null,
    ...rest,
  } as unknown as DragEvent<Element>;
}

describe('useAssetTreeDragUpload', () => {
  it('starts with no drag-over state and no error', () => {
    const { result } = renderHook(() => useAssetTreeDragUpload(vi.fn()));
    expect(result.current.draggingFiles).toBe(false);
    expect(result.current.dropReadError).toBeNull();
  });

  it('shows the drag overlay on enter and hides it once depth returns to zero on leave', () => {
    // `contains: () => true` models a `dragleave` whose `relatedTarget` is
    // still somewhere inside the drop container (e.g. the pointer moved from
    // one child row to another) — the depth counter is exactly what
    // distinguishes that from a real exit, since `dragenter`/`dragleave`
    // fire for every descendant, not just the container's own boundary.
    const nestedLeave = dragEvent({ currentTarget: { contains: () => true } as unknown as EventTarget & Element });
    const { result } = renderHook(() => useAssetTreeDragUpload(vi.fn()));
    act(() => result.current.onDragEnter(dragEvent()));
    expect(result.current.draggingFiles).toBe(true);
    act(() => result.current.onDragEnter(dragEvent())); // nested child dragenter, depth 2
    act(() => result.current.onDragLeave(nestedLeave)); // depth 2 -> 1, still dragging
    expect(result.current.draggingFiles).toBe(true);
    act(() => result.current.onDragLeave(nestedLeave)); // depth 1 -> 0
    expect(result.current.draggingFiles).toBe(false);
  });

  it('onDragLeave to a relatedTarget truly outside the container resets immediately, ignoring any remaining depth', () => {
    // The default `dragEvent()`'s `currentTarget.contains` returns `false`,
    // modeling a `relatedTarget` (or `null`) genuinely outside the
    // container — a real exit, which must reset immediately even mid-nested-drag.
    const { result } = renderHook(() => useAssetTreeDragUpload(vi.fn()));
    act(() => result.current.onDragEnter(dragEvent()));
    act(() => result.current.onDragEnter(dragEvent())); // depth 2
    act(() => result.current.onDragLeave(dragEvent()));
    expect(result.current.draggingFiles).toBe(false);
  });

  it('onDragOver sets the copy drop effect', () => {
    const { result } = renderHook(() => useAssetTreeDragUpload(vi.fn()));
    const event = dragEvent();
    act(() => result.current.onDragOver(event));
    expect(event.dataTransfer.dropEffect).toBe('copy');
  });

  it('onDrop with dropped files calls onUploadFiles and clears drag state', async () => {
    const onUploadFiles = vi.fn();
    const { result } = renderHook(() => useAssetTreeDragUpload(onUploadFiles));
    const file = new File(['x'], 'x.txt');
    const event = dragEvent({ dataTransfer: { items: [], files: [file] } });
    await act(async () => {
      result.current.onDrop(event);
      await flush();
    });
    expect(onUploadFiles).toHaveBeenCalledWith([file]);
    expect(result.current.draggingFiles).toBe(false);
  });

  it('onDrop with zero resolved files does not call onUploadFiles', async () => {
    const onUploadFiles = vi.fn();
    const { result } = renderHook(() => useAssetTreeDragUpload(onUploadFiles));
    const event = dragEvent();
    await act(async () => {
      result.current.onDrop(event);
      await flush();
    });
    expect(onUploadFiles).not.toHaveBeenCalled();
  });

  it('onDrop surfaces a dropReadError when reading a dropped entry fails', async () => {
    const onUploadFiles = vi.fn();
    const { result } = renderHook(() => useAssetTreeDragUpload(onUploadFiles));
    const failingEntry = {
      isFile: false,
      isDirectory: true,
      createReader: () => ({
        readEntries: (_success: (entries: FileSystemEntry[]) => void, error: (err: DOMException) => void) => {
          error(new DOMException('boom'));
        },
      }),
    } as unknown as FileSystemEntry;
    const item = {
      kind: 'file',
      webkitGetAsEntry: () => failingEntry,
    } as unknown as DataTransferItem;
    const event = dragEvent({ dataTransfer: { items: [item], files: [] } });
    await act(async () => {
      result.current.onDrop(event);
      await flush();
    });
    expect(result.current.dropReadError).toMatch(/Could not read/);
    expect(onUploadFiles).not.toHaveBeenCalled();
  });

  it('clearDropReadError resets the error', async () => {
    const { result } = renderHook(() => useAssetTreeDragUpload(vi.fn()));
    const failingEntry = {
      isFile: false,
      isDirectory: true,
      createReader: () => ({
        readEntries: (_success: (entries: FileSystemEntry[]) => void, error: (err: DOMException) => void) => {
          error(new DOMException('boom'));
        },
      }),
    } as unknown as FileSystemEntry;
    const item = { kind: 'file', webkitGetAsEntry: () => failingEntry } as unknown as DataTransferItem;
    await act(async () => {
      result.current.onDrop(dragEvent({ dataTransfer: { items: [item], files: [] } }));
      await flush();
    });
    expect(result.current.dropReadError).not.toBeNull();
    act(() => result.current.clearDropReadError());
    expect(result.current.dropReadError).toBeNull();
  });

  it('calling the latest onUploadFiles identity without resubscribing (ref-based)', async () => {
    const first = vi.fn();
    const { result, rerender } = renderHook(({ cb }) => useAssetTreeDragUpload(cb), {
      initialProps: { cb: first },
    });
    const second = vi.fn();
    rerender({ cb: second });
    const file = new File(['x'], 'x.txt');
    const event = dragEvent({ dataTransfer: { items: [], files: [file] } });
    await act(async () => {
      result.current.onDrop(event);
      await flush();
    });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith([file]);
  });
});
