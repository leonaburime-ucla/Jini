// Unit tests for the transient confirmation-pill hook. Pure UI state with a
// single timer effect: fire sets the pill, ~1.8s later it auto-clears, a new
// fire before that timeout replaces the pill and resets the clock, and
// unmounting mid-timeout must clear the pending timer without throwing.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useMemoryFlash } from '../../../react/hooks/useMemoryFlash.hooks.js';

describe('useMemoryFlash', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with no pill showing', () => {
    const { result } = renderHook(() => useMemoryFlash());
    expect(result.current.flash).toBeNull();
  });

  it('fireFlash shows a pill of the given kind', () => {
    const { result } = renderHook(() => useMemoryFlash());

    act(() => result.current.fireFlash('created'));

    expect(result.current.flash?.kind).toBe('created');
  });

  it('auto-clears the pill after ~1.8s', () => {
    const { result } = renderHook(() => useMemoryFlash());

    act(() => result.current.fireFlash('saved'));
    expect(result.current.flash?.kind).toBe('saved');

    act(() => vi.advanceTimersByTime(1799));
    expect(result.current.flash).not.toBeNull();

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.flash).toBeNull();
  });

  it('a new fire before the timeout elapses replaces the pill and resets the clock', () => {
    const { result } = renderHook(() => useMemoryFlash());

    act(() => result.current.fireFlash('created'));
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.flash?.kind).toBe('created');

    // Re-fire with 800ms left on the first pill's clock. The second pill's
    // own 1.8s window must start over, not inherit the first's remaining time.
    act(() => result.current.fireFlash('deleted'));
    expect(result.current.flash?.kind).toBe('deleted');

    // The original timer's remaining ~800ms elapses; the new pill must survive
    // because its own clock only just started.
    act(() => vi.advanceTimersByTime(800));
    expect(result.current.flash?.kind).toBe('deleted');

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.flash).toBeNull();
  });

  it('each fire gets a distinct key even for the same kind', () => {
    const { result } = renderHook(() => useMemoryFlash());

    act(() => result.current.fireFlash('created'));
    const firstKey = result.current.flash?.key;

    act(() => vi.advanceTimersByTime(10));
    act(() => result.current.fireFlash('created'));
    const secondKey = result.current.flash?.key;

    expect(firstKey).toBeDefined();
    expect(secondKey).toBeDefined();
    expect(secondKey).not.toBe(firstKey);
  });

  it('unmounting while a pill is pending clears the timeout without error', () => {
    const { result, unmount } = renderHook(() => useMemoryFlash());

    act(() => result.current.fireFlash('indexSaved'));
    expect(result.current.flash).not.toBeNull();

    expect(() => unmount()).not.toThrow();

    // No pending timer should fire and touch unmounted state.
    expect(() => act(() => vi.advanceTimersByTime(5000))).not.toThrow();
  });

  it('fireFlash keeps a stable identity across renders', () => {
    const { result, rerender } = renderHook(() => useMemoryFlash());
    const first = result.current.fireFlash;
    rerender();
    expect(result.current.fireFlash).toBe(first);
  });
});
