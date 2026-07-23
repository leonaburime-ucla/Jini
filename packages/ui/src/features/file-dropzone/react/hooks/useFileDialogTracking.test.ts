// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFileDialogTracking } from './useFileDialogTracking.js';
import {
  FILE_DIALOG_FOCUS_DELAY_MS,
  FILE_DIALOG_STALE_MS,
  FILE_DIALOG_WARMUP_MS,
  FILE_DROPZONE_PROCESSING_MIN_VISIBLE_MS,
} from '../../constants.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useFileDialogTracking', () => {
  it('prepareTracking is a no-op when no onProcessingStart is supplied', () => {
    const { result } = renderHook(() => useFileDialogTracking());
    act(() => result.current.prepareTracking());
    // No timers were armed — advancing time triggers nothing observable, and
    // completeTracking returns undefined (never entered the pending state).
    act(() => vi.advanceTimersByTime(FILE_DIALOG_WARMUP_MS));
    expect(result.current.completeTracking()).toBeUndefined();
  });

  it('a focus event before the focus-delay elapses is ignored (no loading shown)', () => {
    const onProcessingStart = vi.fn();
    const { result } = renderHook(() => useFileDialogTracking(onProcessingStart));
    act(() => result.current.prepareTracking());
    act(() => window.dispatchEvent(new Event('focus')));
    expect(onProcessingStart).not.toHaveBeenCalled();
  });

  it('a focus event after the focus-delay elapses starts the loading affordance', () => {
    const finish = vi.fn();
    const onProcessingStart = vi.fn(() => finish);
    const { result } = renderHook(() => useFileDialogTracking(onProcessingStart));
    act(() => result.current.prepareTracking());
    act(() => vi.advanceTimersByTime(FILE_DIALOG_FOCUS_DELAY_MS));
    act(() => window.dispatchEvent(new Event('focus')));
    expect(onProcessingStart).toHaveBeenCalledTimes(1);
  });

  it('force-starts the loading affordance via the warmup timer even with no focus event at all', () => {
    const finish = vi.fn();
    const onProcessingStart = vi.fn(() => finish);
    const { result } = renderHook(() => useFileDialogTracking(onProcessingStart));
    act(() => result.current.prepareTracking());
    act(() => vi.advanceTimersByTime(FILE_DIALOG_WARMUP_MS));
    expect(onProcessingStart).toHaveBeenCalledTimes(1);
  });

  it('a second focus event after loading already started does not start it twice', () => {
    const onProcessingStart = vi.fn(() => vi.fn());
    const { result } = renderHook(() => useFileDialogTracking(onProcessingStart));
    act(() => result.current.prepareTracking());
    act(() => vi.advanceTimersByTime(FILE_DIALOG_WARMUP_MS));
    act(() => window.dispatchEvent(new Event('focus')));
    expect(onProcessingStart).toHaveBeenCalledTimes(1);
  });

  it('completeTracking clears every timer and returns the in-flight finish callback undelayed', () => {
    const finish = vi.fn();
    const onProcessingStart = vi.fn(() => finish);
    const { result } = renderHook(() => useFileDialogTracking(onProcessingStart));
    act(() => result.current.prepareTracking());
    act(() => vi.advanceTimersByTime(FILE_DIALOG_WARMUP_MS));
    let returned: (() => void) | undefined;
    act(() => {
      returned = result.current.completeTracking();
    });
    expect(returned).toBe(finish);
    expect(finish).not.toHaveBeenCalled();
    // The stale timer was cleared by completeTracking — advancing well past
    // it must not fire a second, stray completion.
    act(() => vi.advanceTimersByTime(FILE_DIALOG_STALE_MS * 2));
    expect(finish).not.toHaveBeenCalled();
  });

  it('completeTracking after a prepareTracking that never showed loading returns undefined', () => {
    const onProcessingStart = vi.fn(() => vi.fn());
    const { result } = renderHook(() => useFileDialogTracking(onProcessingStart));
    act(() => result.current.prepareTracking());
    // Neither timer has fired yet — no loading affordance was ever shown.
    let returned: (() => void) | undefined;
    act(() => {
      returned = result.current.completeTracking();
    });
    expect(returned).toBeUndefined();
    expect(onProcessingStart).not.toHaveBeenCalled();
  });

  it('handleDialogCancelled schedules the finish callback after the minimum-visible delay (never flashes)', () => {
    const finish = vi.fn();
    const onProcessingStart = vi.fn(() => finish);
    const { result } = renderHook(() => useFileDialogTracking(onProcessingStart));
    act(() => result.current.prepareTracking());
    act(() => vi.advanceTimersByTime(FILE_DIALOG_WARMUP_MS));
    act(() => result.current.handleDialogCancelled());
    expect(finish).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(FILE_DROPZONE_PROCESSING_MIN_VISIBLE_MS - 1));
    expect(finish).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(finish).toHaveBeenCalledTimes(1);
  });

  it('handleDialogCancelled before any loading was shown is a safe no-op (no finish to schedule)', () => {
    const onProcessingStart = vi.fn(() => vi.fn());
    const { result } = renderHook(() => useFileDialogTracking(onProcessingStart));
    act(() => result.current.prepareTracking());
    act(() => result.current.handleDialogCancelled());
    act(() => vi.advanceTimersByTime(FILE_DROPZONE_PROCESSING_MIN_VISIBLE_MS));
    expect(onProcessingStart).not.toHaveBeenCalled();
  });

  it('the stale-timeout safety net force-clears a loading affordance that never resolves, scheduling its finish', () => {
    const finish = vi.fn();
    const onProcessingStart = vi.fn(() => finish);
    const { result } = renderHook(() => useFileDialogTracking(onProcessingStart));
    act(() => result.current.prepareTracking());
    act(() => vi.advanceTimersByTime(FILE_DIALOG_WARMUP_MS));
    expect(onProcessingStart).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(FILE_DIALOG_STALE_MS));
    // The stale timer fired `handleDialogCancelled` internally, which
    // schedules `finish` after the min-visible delay rather than calling it
    // immediately.
    expect(finish).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(FILE_DROPZONE_PROCESSING_MIN_VISIBLE_MS));
    expect(finish).toHaveBeenCalledTimes(1);
  });

  it('a second prepareTracking call while one is already pending finishes the previous cycle immediately', () => {
    const firstFinish = vi.fn();
    const secondFinish = vi.fn();
    const onProcessingStart = vi.fn().mockReturnValueOnce(firstFinish).mockReturnValueOnce(secondFinish);
    const { result } = renderHook(() => useFileDialogTracking(onProcessingStart));
    act(() => result.current.prepareTracking());
    act(() => vi.advanceTimersByTime(FILE_DIALOG_WARMUP_MS));
    expect(firstFinish).not.toHaveBeenCalled();
    act(() => result.current.prepareTracking());
    // Re-preparing calls the previous cycle's finish callback synchronously
    // (not scheduled) — it hands the first loading affordance's cleanup
    // straight to the host rather than leaving it dangling.
    expect(firstFinish).toHaveBeenCalledTimes(1);
    expect(secondFinish).not.toHaveBeenCalled();
  });

  it('a focus event with no tracking ever prepared is a safe no-op', () => {
    const onProcessingStart = vi.fn(() => vi.fn());
    renderHook(() => useFileDialogTracking(onProcessingStart));
    act(() => window.dispatchEvent(new Event('focus')));
    expect(onProcessingStart).not.toHaveBeenCalled();
  });

  it('a warmup firing after onProcessingStart was withdrawn mid-flight is a safe no-op', () => {
    const onProcessingStart = vi.fn(() => vi.fn());
    const { result, rerender } = renderHook(
      ({ cb }: { cb?: (() => () => void) | undefined }) => useFileDialogTracking(cb),
      { initialProps: { cb: onProcessingStart as (() => () => void) | undefined } },
    );
    act(() => result.current.prepareTracking());
    rerender({ cb: undefined });
    act(() => vi.advanceTimersByTime(FILE_DIALOG_WARMUP_MS));
    expect(onProcessingStart).not.toHaveBeenCalled();
  });

  it('removes the window focus listener when onProcessingStart becomes undefined and again on unmount', () => {
    const onProcessingStart = vi.fn(() => vi.fn());
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { rerender, unmount } = renderHook(
      ({ cb }: { cb?: (() => () => void) | undefined }) => useFileDialogTracking(cb),
      { initialProps: { cb: onProcessingStart as (() => () => void) | undefined } },
    );
    rerender({ cb: undefined });
    expect(removeSpy).toHaveBeenCalledWith('focus', expect.any(Function));
    removeSpy.mockClear();
    unmount();
    // Unmount cleanup fires from both the focus-listener effect (already
    // torn down above, since `cb` is undefined — no-op re-cleanup) and the
    // timer-cleanup effect; only asserting no timer survives matters here.
    removeSpy.mockRestore();
  });

  it('clears pending timers on unmount without invoking any stored finish callback', () => {
    const finish = vi.fn();
    const onProcessingStart = vi.fn(() => finish);
    const { result, unmount } = renderHook(() => useFileDialogTracking(onProcessingStart));
    act(() => result.current.prepareTracking());
    // Advance to the warmup timer so a loading affordance actually starts
    // (arming the stale-timeout too) before unmounting — otherwise there'd
    // be no in-flight `finish`/stale timer for the cleanup to actually prove
    // it clears.
    act(() => vi.advanceTimersByTime(FILE_DIALOG_WARMUP_MS));
    expect(onProcessingStart).toHaveBeenCalledTimes(1);
    unmount();
    act(() => vi.advanceTimersByTime(FILE_DIALOG_STALE_MS * 2));
    expect(finish).not.toHaveBeenCalled();
  });
});
