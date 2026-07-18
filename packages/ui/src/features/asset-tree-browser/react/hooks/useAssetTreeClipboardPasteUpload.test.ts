// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAssetTreeClipboardPasteUpload } from './useAssetTreeClipboardPasteUpload.js';
import type { AssetTreeDomBridgePort } from '../../ports.js';

function fakeDom(): { dom: AssetTreeDomBridgePort; paste: (files: File[]) => void; unsubscribed: () => boolean } {
  let handler: ((files: File[]) => void) | null = null;
  let unsubscribed = false;
  const dom: AssetTreeDomBridgePort = {
    subscribeOutsideDismiss: () => () => {},
    subscribeGlobalPaste: (onFiles) => {
      handler = onFiles;
      unsubscribed = false;
      return () => {
        unsubscribed = true;
      };
    },
    getViewportHeight: () => 800,
  };
  return {
    dom,
    paste: (files) => {
      if (!handler) throw new Error('not subscribed');
      handler(files);
    },
    unsubscribed: () => unsubscribed,
  };
}

describe('useAssetTreeClipboardPasteUpload', () => {
  it('forwards pasted files to onUploadFiles', () => {
    const { dom, paste } = fakeDom();
    const onUploadFiles = vi.fn();
    renderHook(() => useAssetTreeClipboardPasteUpload({ dom, onUploadFiles }));
    const file = new File(['x'], 'x.png');
    act(() => paste([file]));
    expect(onUploadFiles).toHaveBeenCalledWith([file]);
  });

  it('calls onBeforeUpload before onUploadFiles', () => {
    const { dom, paste } = fakeDom();
    const calls: string[] = [];
    const onUploadFiles = vi.fn(() => calls.push('upload'));
    const onBeforeUpload = vi.fn(() => calls.push('before'));
    renderHook(() => useAssetTreeClipboardPasteUpload({ dom, onUploadFiles, onBeforeUpload }));
    act(() => paste([new File(['x'], 'x.png')]));
    expect(calls).toEqual(['before', 'upload']);
  });

  it('works with no onBeforeUpload supplied', () => {
    const { dom, paste } = fakeDom();
    const onUploadFiles = vi.fn();
    renderHook(() => useAssetTreeClipboardPasteUpload({ dom, onUploadFiles }));
    expect(() => act(() => paste([new File(['x'], 'x.png')]))).not.toThrow();
  });

  it('picks up the latest onUploadFiles identity without resubscribing', () => {
    const { dom, paste, unsubscribed } = fakeDom();
    const first = vi.fn();
    const { rerender } = renderHook(({ cb }) => useAssetTreeClipboardPasteUpload({ dom, onUploadFiles: cb }), {
      initialProps: { cb: first },
    });
    const second = vi.fn();
    rerender({ cb: second });
    expect(unsubscribed()).toBe(false);
    const file = new File(['x'], 'x.png');
    act(() => paste([file]));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith([file]);
  });

  it('unsubscribes on unmount', () => {
    const { dom, unsubscribed } = fakeDom();
    const { unmount } = renderHook(() => useAssetTreeClipboardPasteUpload({ dom, onUploadFiles: vi.fn() }));
    expect(unsubscribed()).toBe(false);
    unmount();
    expect(unsubscribed()).toBe(true);
  });
});
