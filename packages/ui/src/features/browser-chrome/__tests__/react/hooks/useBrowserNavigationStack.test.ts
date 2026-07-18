import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useBrowserNavigationStack } from '../../../react/hooks/useBrowserNavigationStack.js';
import { EMPTY_URL } from '../../../constants.js';

describe('useBrowserNavigationStack', () => {
  it('starts on the home entry with no initialUrl', () => {
    const { result } = renderHook(() => useBrowserNavigationStack());
    expect(result.current.currentEntry).toEqual({ title: 'New Tab', url: EMPTY_URL });
    expect(result.current.canGoBack).toBe(false);
    expect(result.current.canGoForward).toBe(false);
  });

  it('seeds from initialUrl/initialTitle', () => {
    const { result } = renderHook(() => useBrowserNavigationStack({ initialUrl: 'https://a.com', initialTitle: 'A' }));
    expect(result.current.currentEntry).toEqual({ title: 'A', url: 'https://a.com' });
    expect(result.current.addressValue).toBe('https://a.com');
  });

  it('recordNavigation pushes a new entry and updates canGoBack', () => {
    const { result } = renderHook(() => useBrowserNavigationStack());
    act(() => result.current.recordNavigation('https://a.com', 'A'));
    expect(result.current.currentEntry).toEqual({ title: 'A', url: 'https://a.com' });
    expect(result.current.canGoBack).toBe(true);
  });

  it('goBack/goForward move the index and return the landed entry', () => {
    const { result } = renderHook(() => useBrowserNavigationStack());
    act(() => result.current.recordNavigation('https://a.com', 'A'));
    act(() => result.current.recordNavigation('https://b.com', 'B'));

    let landed: unknown;
    act(() => {
      landed = result.current.goBack();
    });
    expect(landed).toEqual({ title: 'A', url: 'https://a.com' });
    expect(result.current.currentEntry).toEqual({ title: 'A', url: 'https://a.com' });
    expect(result.current.canGoForward).toBe(true);

    act(() => {
      landed = result.current.goForward();
    });
    expect(landed).toEqual({ title: 'B', url: 'https://b.com' });
  });

  it('goBack returns null and is a no-op at the start of the stack', () => {
    const { result } = renderHook(() => useBrowserNavigationStack());
    let landed: unknown = 'unset';
    act(() => {
      landed = result.current.goBack();
    });
    expect(landed).toBeNull();
  });

  it('updateCurrentTitle renames only the current entry', () => {
    const { result } = renderHook(() => useBrowserNavigationStack());
    act(() => result.current.recordNavigation('https://a.com', 'A'));
    act(() => result.current.updateCurrentTitle('A Renamed'));
    expect(result.current.currentEntry?.title).toBe('A Renamed');
  });

  it('reset re-seeds the stack from new initial values', () => {
    const { result } = renderHook(() => useBrowserNavigationStack());
    act(() => result.current.recordNavigation('https://a.com', 'A'));
    act(() => result.current.reset('https://b.com', 'B'));
    expect(result.current.navigationStack).toEqual([{ title: 'B', url: 'https://b.com' }]);
    expect(result.current.navigationIndex).toBe(0);
  });

  it('calls onNavigate whenever the current entry changes, and not redundantly for a no-op update', () => {
    const onNavigate = vi.fn();
    const { result, rerender } = renderHook(
      ({ onNavigate: cb }) => useBrowserNavigationStack({ onNavigate: cb }),
      { initialProps: { onNavigate } },
    );
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenLastCalledWith({ title: 'New Tab', url: EMPTY_URL });

    act(() => result.current.recordNavigation('https://a.com', 'A'));
    expect(onNavigate).toHaveBeenCalledTimes(2);
    expect(onNavigate).toHaveBeenLastCalledWith({ title: 'A', url: 'https://a.com' });

    // A fresh onNavigate identity with no state change should not refire.
    const secondCallback = vi.fn();
    rerender({ onNavigate: secondCallback });
    expect(secondCallback).not.toHaveBeenCalled();
  });

  it('calls onNavigate again when only the title changes for the same url', () => {
    const onNavigate = vi.fn();
    const { result } = renderHook(() => useBrowserNavigationStack({ onNavigate }));
    act(() => result.current.recordNavigation('https://a.com', 'A'));
    onNavigate.mockClear();

    // Same url, different title (e.g. the page's document.title arrived
    // after the initial navigation) — must still notify, not dedupe away.
    act(() => result.current.updateCurrentTitle('A (loaded)'));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenLastCalledWith({ title: 'A (loaded)', url: 'https://a.com' });
  });

  it('does not refire onNavigate for a re-recorded entry with identical url+title (dedupes by content, not just by object reference)', () => {
    const onNavigate = vi.fn();
    const { result } = renderHook(() => useBrowserNavigationStack({ onNavigate }));
    act(() => result.current.recordNavigation('https://a.com', 'A'));
    onNavigate.mockClear();

    // recordNavigation's in-place "same url" update path (rules.ts) always
    // builds a brand-new entry object, even when its content is identical —
    // so `currentEntry`'s object *reference* changes and the effect re-runs,
    // but the dedupe check must still catch that url+title didn't actually
    // change and skip notifying.
    act(() => result.current.recordNavigation('https://a.com', 'A'));
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('recordNavigation to EMPTY_URL clears addressValue and honors a custom homeEntry title', () => {
    const homeEntry = { title: 'Custom Home', url: EMPTY_URL };
    const { result } = renderHook(() => useBrowserNavigationStack({ homeEntry }));
    act(() => result.current.recordNavigation('https://a.com', 'A'));
    expect(result.current.addressValue).toBe('https://a.com');

    act(() => result.current.recordNavigation(EMPTY_URL));
    expect(result.current.addressValue).toBe('');
    expect(result.current.currentEntry).toEqual({ title: 'Custom Home', url: EMPTY_URL });
  });

  it('goBack lands on an EMPTY_URL home entry and clears addressValue', () => {
    const { result } = renderHook(() => useBrowserNavigationStack());
    act(() => result.current.recordNavigation('https://a.com', 'A'));
    expect(result.current.addressValue).toBe('https://a.com');

    act(() => {
      result.current.goBack();
    });
    expect(result.current.addressValue).toBe('');
    expect(result.current.currentEntry).toEqual({ title: 'New Tab', url: EMPTY_URL });
  });
});
