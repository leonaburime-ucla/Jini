import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { classifyRunCloseStatus, createInactivityWatchdog, resolveTimeoutMs } from '../close-status.js';

describe('classifyRunCloseStatus', () => {
  it('classifies cancellation ahead of exit code, even when the code looks successful', () => {
    expect(classifyRunCloseStatus({ cancelRequested: true, code: 0 })).toBe('cancelled');
    expect(classifyRunCloseStatus({ cancelRequested: true, code: 1, signal: 'SIGTERM' })).toBe('cancelled');
  });

  it('classifies exit code 0 (no cancellation) as succeeded', () => {
    expect(classifyRunCloseStatus({ cancelRequested: false, code: 0 })).toBe('succeeded');
  });

  it('classifies any non-zero or null exit code (no cancellation) as failed', () => {
    expect(classifyRunCloseStatus({ cancelRequested: false, code: 1 })).toBe('failed');
    expect(classifyRunCloseStatus({ cancelRequested: false, code: null, signal: 'SIGKILL' })).toBe('failed');
  });
});

describe('resolveTimeoutMs', () => {
  it('prefers a valid env override over the agent default and kernel default', () => {
    const ms = resolveTimeoutMs({
      envVar: 'X_TIMEOUT_MS',
      agentDefaultMs: 5_000,
      defaultMs: 1_000,
      maxMs: 100_000,
      env: { X_TIMEOUT_MS: '20000' },
    });
    expect(ms).toBe(20_000);
  });

  it('falls back to the agent default when the env var is absent', () => {
    const ms = resolveTimeoutMs({ envVar: 'X_TIMEOUT_MS', agentDefaultMs: 5_000, defaultMs: 1_000, maxMs: 100_000, env: {} });
    expect(ms).toBe(5_000);
  });

  it('falls back to the kernel default when neither env nor agent default is set', () => {
    const ms = resolveTimeoutMs({ defaultMs: 1_000, maxMs: 100_000, env: {} });
    expect(ms).toBe(1_000);
  });

  it('treats a non-numeric or non-positive env value as absent rather than throwing', () => {
    expect(resolveTimeoutMs({ envVar: 'X', agentDefaultMs: 5_000, defaultMs: 1_000, maxMs: 100_000, env: { X: 'nope' } })).toBe(5_000);
    expect(resolveTimeoutMs({ envVar: 'X', agentDefaultMs: 5_000, defaultMs: 1_000, maxMs: 100_000, env: { X: '-5' } })).toBe(5_000);
    expect(resolveTimeoutMs({ envVar: 'X', agentDefaultMs: 5_000, defaultMs: 1_000, maxMs: 100_000, env: { X: '0' } })).toBe(5_000);
  });

  it('clamps the resolved value to maxMs regardless of source', () => {
    expect(resolveTimeoutMs({ envVar: 'X', defaultMs: 1_000, maxMs: 2_000, env: { X: '999999' } })).toBe(2_000);
  });
});

describe('createInactivityWatchdog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires onTimeout once after timeoutMs of no activity', () => {
    const onTimeout = vi.fn();
    createInactivityWatchdog({ timeoutMs: 1_000, onTimeout });
    vi.advanceTimersByTime(999);
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('noteActivity() resets the window so onTimeout only fires timeoutMs after the LAST activity', () => {
    const onTimeout = vi.fn();
    const watchdog = createInactivityWatchdog({ timeoutMs: 1_000, onTimeout });
    vi.advanceTimersByTime(700);
    watchdog.noteActivity();
    vi.advanceTimersByTime(700);
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('cancel() permanently disarms the watchdog', () => {
    const onTimeout = vi.fn();
    const watchdog = createInactivityWatchdog({ timeoutMs: 1_000, onTimeout });
    watchdog.cancel();
    vi.advanceTimersByTime(10_000);
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
