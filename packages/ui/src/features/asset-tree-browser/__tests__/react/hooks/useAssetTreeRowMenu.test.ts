// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAssetTreeRowMenu } from '../../../react/hooks/useAssetTreeRowMenu.js';
import type { AssetTreeDomBridgePort } from '../../../ports.js';

function fakeDom(viewportHeight = 800): { dom: AssetTreeDomBridgePort; dismiss: () => void; subscribed: () => boolean } {
  let onDismiss: (() => void) | null = null;
  const dom: AssetTreeDomBridgePort = {
    subscribeOutsideDismiss: (_container, cb) => {
      onDismiss = cb;
      return () => {
        onDismiss = null;
      };
    },
    subscribeGlobalPaste: () => () => {},
    getViewportHeight: () => viewportHeight,
  };
  return {
    dom,
    dismiss: () => onDismiss?.(),
    subscribed: () => onDismiss !== null,
  };
}

describe('useAssetTreeRowMenu', () => {
  it('starts closed', () => {
    const { dom } = fakeDom();
    const { result } = renderHook(() => useAssetTreeRowMenu(dom));
    expect(result.current.menuPos).toBeNull();
  });

  it('openMenuFor computes a position below the anchor when there is room and opens for the given path', () => {
    const { dom } = fakeDom(800);
    const { result } = renderHook(() => useAssetTreeRowMenu(dom));
    act(() => result.current.openMenuFor('a.txt', { top: 100, bottom: 120, right: 300 }));
    expect(result.current.menuPos).toEqual({ path: 'a.txt', top: 124, left: 140 });
  });

  it('closeMenu clears the open menu', () => {
    const { dom } = fakeDom();
    const { result } = renderHook(() => useAssetTreeRowMenu(dom));
    act(() => result.current.openMenuFor('a.txt', { top: 0, bottom: 20, right: 200 }));
    act(() => result.current.closeMenu());
    expect(result.current.menuPos).toBeNull();
  });

  it('subscribes to outside-dismiss only while a menu is open, and dismissing closes it', () => {
    const { dom, dismiss, subscribed } = fakeDom();
    const { result } = renderHook(() => useAssetTreeRowMenu(dom));
    expect(subscribed()).toBe(false);
    act(() => result.current.openMenuFor('a.txt', { top: 0, bottom: 20, right: 200 }));
    expect(subscribed()).toBe(true);
    act(() => dismiss());
    expect(result.current.menuPos).toBeNull();
  });

  it('unsubscribes outside-dismiss once the menu closes', () => {
    const { dom, subscribed } = fakeDom();
    const { result } = renderHook(() => useAssetTreeRowMenu(dom));
    act(() => result.current.openMenuFor('a.txt', { top: 0, bottom: 20, right: 200 }));
    act(() => result.current.closeMenu());
    expect(subscribed()).toBe(false);
  });
});
