import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RefObject } from 'react';
import { DECK_NAVIGATE_MESSAGE_TYPE, DECK_STATE_MESSAGE_TYPE } from '../../constants.js';
import { useDeckNavigation } from './useDeckNavigation.js';

function makeFakeIframe(): HTMLIFrameElement {
  const postMessage = vi.fn();
  return { contentWindow: { postMessage } } as unknown as HTMLIFrameElement;
}

/** Dispatches the message inside `act()` — the listener's `setSlideState` triggers a re-render, and a raw `window.dispatchEvent` outside `act()` leaves `result.current` reading the stale pre-update snapshot. */
function reportSlideState(iframe: HTMLIFrameElement, active: number, count: number) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: DECK_STATE_MESSAGE_TYPE, active, count },
        source: iframe.contentWindow as Window,
      }),
    );
  });
}

describe('useDeckNavigation', () => {
  it('starts with no slide state, no counter, and both directions disabled', () => {
    const iframeRef: RefObject<HTMLIFrameElement | null> = { current: makeFakeIframe() };
    const { result } = renderHook(() => useDeckNavigation(iframeRef));
    expect(result.current.slideState).toBeNull();
    expect(result.current.counterLabel).toBeNull();
    expect(result.current.canGoPrev).toBe(false);
    expect(result.current.canGoNext).toBe(false);
  });

  it('tracks slide state reported by the sandboxed iframe', () => {
    const iframe = makeFakeIframe();
    const iframeRef: RefObject<HTMLIFrameElement | null> = { current: iframe };
    const { result } = renderHook(() => useDeckNavigation(iframeRef));

    reportSlideState(iframe, 1, 4);

    expect(result.current.slideState).toEqual({ active: 1, count: 4 });
    expect(result.current.counterLabel).toBe('2 / 4');
    expect(result.current.canGoPrev).toBe(true);
    expect(result.current.canGoNext).toBe(true);
  });

  it('ignores a malformed deck-state message', () => {
    const iframe = makeFakeIframe();
    const iframeRef: RefObject<HTMLIFrameElement | null> = { current: iframe };
    const { result } = renderHook(() => useDeckNavigation(iframeRef));

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: DECK_STATE_MESSAGE_TYPE, active: 'nope' },
          source: iframe.contentWindow as Window,
        }),
      );
    });

    expect(result.current.slideState).toBeNull();
  });

  it.each([
    ['goNext', 'next'],
    ['goPrev', 'prev'],
    ['goFirst', 'first'],
    ['goLast', 'last'],
  ] as const)('%s() posts a %s navigate message', (method, action) => {
    const iframe = makeFakeIframe();
    const iframeRef: RefObject<HTMLIFrameElement | null> = { current: iframe };
    const { result } = renderHook(() => useDeckNavigation(iframeRef));

    result.current[method]();

    expect(iframe.contentWindow!.postMessage).toHaveBeenCalledWith(
      { type: DECK_NAVIGATE_MESSAGE_TYPE, action },
      '*',
    );
  });

  it('goTo(index) posts a "go" navigate message with the index', () => {
    const iframe = makeFakeIframe();
    const iframeRef: RefObject<HTMLIFrameElement | null> = { current: iframe };
    const { result } = renderHook(() => useDeckNavigation(iframeRef));

    result.current.goTo(2);

    expect(iframe.contentWindow!.postMessage).toHaveBeenCalledWith(
      { type: DECK_NAVIGATE_MESSAGE_TYPE, action: 'go', index: 2 },
      '*',
    );
  });
});
