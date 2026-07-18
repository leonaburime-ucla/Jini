// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCoalescedCallback } from '../useCoalescedCallback.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useCoalescedCallback', () => {
  it('coalesces a burst of triggers into a single trailing call', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useCoalescedCallback(callback, { wait: 100 }));

    result.current();
    vi.advanceTimersByTime(30);
    result.current();
    vi.advanceTimersByTime(30);
    result.current();

    // Still inside the quiet window from the last trigger.
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('resets the quiet window on every new trigger', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useCoalescedCallback(callback, { wait: 100 }));

    result.current();
    vi.advanceTimersByTime(90);
    expect(callback).not.toHaveBeenCalled();

    // Reset the timer just before it would have fired.
    result.current();
    vi.advanceTimersByTime(90);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('flushes immediately once maxWait elapses mid-burst', () => {
    const callback = vi.fn();
    const { result } = renderHook(() =>
      useCoalescedCallback(callback, { wait: 100, maxWait: 250 }),
    );

    result.current(); // t=0, arms wait=100, firstSeenAt=0
    vi.advanceTimersByTime(80);
    result.current(); // t=80, resets wait timer
    vi.advanceTimersByTime(80);
    result.current(); // t=160, resets wait timer
    vi.advanceTimersByTime(80);
    // t=240: still under maxWait=250, resets again
    result.current();
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(20); // t=260, >= maxWait(250) since firstSeenAt=0
    result.current(); // this trigger should flush immediately, not schedule
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not call a stale callback after unmount', () => {
    const callback = vi.fn();
    const { result, unmount } = renderHook(() => useCoalescedCallback(callback, { wait: 100 }));

    result.current();
    unmount();
    vi.advanceTimersByTime(200);

    expect(callback).not.toHaveBeenCalled();
  });

  it('always invokes the latest callback identity, not a stale closure', () => {
    let callback = vi.fn();
    const { result, rerender } = renderHook(
      ({ cb }: { cb: () => void }) => useCoalescedCallback(cb, { wait: 100 }),
      { initialProps: { cb: callback } },
    );

    const trigger = result.current;
    trigger();

    const newCallback = vi.fn();
    callback = newCallback;
    rerender({ cb: newCallback });

    vi.advanceTimersByTime(100);

    expect(newCallback).toHaveBeenCalledTimes(1);
  });
});
