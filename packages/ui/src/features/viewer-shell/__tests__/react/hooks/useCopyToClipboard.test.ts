import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCopyToClipboard, useWiredCopyToClipboard } from '../../../react/hooks/useCopyToClipboard.js';
import type { ViewerClipboardPort } from '../../../ports.js';

function makeClipboard(result: boolean): ViewerClipboardPort {
  return { copyText: vi.fn().mockResolvedValue(result) };
}

describe('useCopyToClipboard', () => {
  it('starts uncopied', () => {
    const { result } = renderHook(() => useCopyToClipboard(makeClipboard(true)));
    expect(result.current.copied).toBe(false);
  });

  it('flips copied to true after a successful copy', async () => {
    const clipboard = makeClipboard(true);
    const { result } = renderHook(() => useCopyToClipboard(clipboard));
    await act(async () => {
      await result.current.copy('hello');
    });
    expect(clipboard.copyText).toHaveBeenCalledWith('hello');
    expect(result.current.copied).toBe(true);
  });

  it('resets copied back to false after the timeout', async () => {
    vi.useFakeTimers();
    const clipboard = makeClipboard(true);
    const { result } = renderHook(() => useCopyToClipboard(clipboard, 100));
    await act(async () => {
      await result.current.copy('hello');
    });
    expect(result.current.copied).toBe(true);
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current.copied).toBe(false);
    vi.useRealTimers();
  });

  it('leaves copied false when the copy fails', async () => {
    const clipboard = makeClipboard(false);
    const { result } = renderHook(() => useCopyToClipboard(clipboard));
    await act(async () => {
      await result.current.copy('hello');
    });
    expect(result.current.copied).toBe(false);
  });

  it('clears a pending reset timer on unmount without throwing', async () => {
    const clipboard = makeClipboard(true);
    const { result, unmount } = renderHook(() => useCopyToClipboard(clipboard, 1000));
    await act(async () => {
      await result.current.copy('hello');
    });
    expect(() => unmount()).not.toThrow();
  });

  it('supports a second copy re-arming the timer', async () => {
    const clipboard = makeClipboard(true);
    const { result } = renderHook(() => useCopyToClipboard(clipboard, 30));
    await act(async () => {
      await result.current.copy('one');
    });
    expect(result.current.copied).toBe(true);
    await waitFor(() => expect(result.current.copied).toBe(false));
    await act(async () => {
      await result.current.copy('two');
    });
    expect(result.current.copied).toBe(true);
  });
});

describe('useWiredCopyToClipboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('wires the real browser clipboard port end-to-end', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const { result } = renderHook(() => useWiredCopyToClipboard());
    expect(result.current.copied).toBe(false);
    await act(async () => {
      await result.current.copy('wired text');
    });
    expect(writeText).toHaveBeenCalledWith('wired text');
    expect(result.current.copied).toBe(true);
  });

  it('honors a custom resetMs like the underlying hook', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const { result } = renderHook(() => useWiredCopyToClipboard(50));
    await act(async () => {
      await result.current.copy('hello');
    });
    expect(result.current.copied).toBe(true);
    act(() => {
      vi.advanceTimersByTime(80);
    });
    expect(result.current.copied).toBe(false);
    vi.useRealTimers();
  });
});
