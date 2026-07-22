import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function freshModule() {
  vi.resetModules();
  return import('../boot-timing.js');
}

const FAKE_NAV_ENTRY = {
  startTime: 0,
  domInteractive: 120,
  domContentLoadedEventStart: 140,
  domComplete: 300,
  loadEventStart: 310,
  transferSize: 45_000,
} as unknown as PerformanceNavigationTiming;

describe('installBootTimingObserver', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([FAKE_NAV_ENTRY]);
    // jsdom has no requestIdleCallback — force the setTimeout(fn, 50) path
    // deterministically regardless of host environment.
    vi.stubGlobal('requestIdleCallback', undefined);
    Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('reports client_boot_timing derived from the navigation timing entry', async () => {
    const { installBootTimingObserver } = await freshModule();
    const reporter = vi.fn();
    installBootTimingObserver({ reporter });

    await vi.advanceTimersByTimeAsync(50);

    expect(reporter).toHaveBeenCalledWith(
      'client_boot_timing',
      expect.objectContaining({
        dom_interactive_ms: 120,
        dom_content_loaded_ms: 140,
        dom_complete_ms: 300,
        load_event_ms: 310,
        transfer_size_bytes: 45_000,
      }),
    );
  });

  it('captures at most once per module instance, returning a callable no-op teardown thereafter', async () => {
    const { installBootTimingObserver } = await freshModule();
    const reporter = vi.fn();
    installBootTimingObserver({ reporter });
    await vi.advanceTimersByTimeAsync(50);
    const secondTeardown = installBootTimingObserver({ reporter });
    await vi.advanceTimersByTimeAsync(50);

    expect(reporter).toHaveBeenCalledTimes(1);
    expect(() => secondTeardown()).not.toThrow();
  });

  it('does not report when there is no navigation timing entry available', async () => {
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([]);
    const { installBootTimingObserver } = await freshModule();
    const reporter = vi.fn();
    installBootTimingObserver({ reporter });
    await vi.advanceTimersByTimeAsync(50);

    expect(reporter).not.toHaveBeenCalled();
  });

  it('waits for the load event when the document is still loading at install time', async () => {
    Object.defineProperty(document, 'readyState', { value: 'loading', configurable: true });
    const { installBootTimingObserver } = await freshModule();
    const reporter = vi.fn();
    installBootTimingObserver({ reporter });

    await vi.advanceTimersByTimeAsync(50);
    expect(reporter).not.toHaveBeenCalled();

    window.dispatchEvent(new Event('load'));
    await vi.advanceTimersByTimeAsync(50);
    expect(reporter).toHaveBeenCalledTimes(1);
  });

  it('ignores a second load event firing after the first has already captured', async () => {
    Object.defineProperty(document, 'readyState', { value: 'loading', configurable: true });
    const { installBootTimingObserver } = await freshModule();
    const reporter = vi.fn();
    installBootTimingObserver({ reporter });

    window.dispatchEvent(new Event('load'));
    await vi.advanceTimersByTimeAsync(50);
    expect(reporter).toHaveBeenCalledTimes(1);

    // `{ once: true }` means the browser itself wouldn't normally re-fire
    // this listener, but `onReady`'s own `captured` guard is a second,
    // independent line of defense — invoke the handler path again directly
    // via a second load dispatch to prove it too, not just addEventListener's
    // `once` semantics.
    window.dispatchEvent(new Event('load'));
    await vi.advanceTimersByTimeAsync(50);
    expect(reporter).toHaveBeenCalledTimes(1);
  });

  it('does nothing (and does not throw) when window is unavailable (SSR-style)', async () => {
    vi.stubGlobal('window', undefined);
    try {
      const { installBootTimingObserver } = await freshModule();
      const reporter = vi.fn();
      const teardown = installBootTimingObserver({ reporter });
      expect(() => teardown()).not.toThrow();
      expect(reporter).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('does nothing (and does not throw) when performance is unavailable', async () => {
    const originalPerformance = window.performance;
    // @ts-expect-error -- simulate an environment without the Performance API
    delete window.performance;
    try {
      const { installBootTimingObserver } = await freshModule();
      const reporter = vi.fn();
      const teardown = installBootTimingObserver({ reporter });
      expect(() => teardown()).not.toThrow();
      expect(reporter).not.toHaveBeenCalled();
    } finally {
      window.performance = originalPerformance;
    }
  });

  it('schedules via requestIdleCallback when available instead of setTimeout', async () => {
    const idleCallbacks: Array<() => void> = [];
    vi.stubGlobal(
      'requestIdleCallback',
      vi.fn((cb: () => void) => {
        idleCallbacks.push(cb);
        return 1;
      }),
    );
    const { installBootTimingObserver } = await freshModule();
    const reporter = vi.fn();
    installBootTimingObserver({ reporter });

    expect(idleCallbacks).toHaveLength(1);
    idleCallbacks[0]!();
    expect(reporter).toHaveBeenCalledTimes(1);
  });

  it('falls back to legacy performance.timing when no navigation-timing entry exists', async () => {
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([]);
    vi.stubGlobal('performance', {
      ...performance,
      getEntriesByType: () => [],
      timing: {
        navigationStart: 1000,
        domInteractive: 1120,
        domContentLoadedEventStart: 1140,
        domComplete: 1300,
        loadEventStart: 1310,
      },
    });
    const { installBootTimingObserver } = await freshModule();
    const reporter = vi.fn();
    installBootTimingObserver({ reporter });
    await vi.advanceTimersByTimeAsync(50);

    expect(reporter).toHaveBeenCalledWith(
      'client_boot_timing',
      expect.objectContaining({
        navigation_start_offset_ms: 0,
        dom_interactive_ms: 120,
        dom_content_loaded_ms: 140,
        dom_complete_ms: 300,
        load_event_ms: 310,
        transfer_size_bytes: undefined,
      }),
    );
  });

  it('reports nothing when neither a navigation-timing entry nor legacy performance.timing exists', async () => {
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([]);
    const { installBootTimingObserver } = await freshModule();
    const reporter = vi.fn();
    installBootTimingObserver({ reporter });
    await vi.advanceTimersByTimeAsync(50);

    expect(reporter).not.toHaveBeenCalled();
  });

  it('omits transfer_size_bytes when the entry reports a non-positive transferSize', async () => {
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
      { ...FAKE_NAV_ENTRY, transferSize: 0 } as unknown as PerformanceNavigationTiming,
    ]);
    const { installBootTimingObserver } = await freshModule();
    const reporter = vi.fn();
    installBootTimingObserver({ reporter });
    await vi.advanceTimersByTimeAsync(50);

    expect(reporter).toHaveBeenCalledWith(
      'client_boot_timing',
      expect.objectContaining({ transfer_size_bytes: undefined }),
    );
  });

  it('rounds a NaN/non-numeric timing value to undefined instead of propagating NaN', async () => {
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
      { ...FAKE_NAV_ENTRY, domComplete: Number.NaN } as unknown as PerformanceNavigationTiming,
    ]);
    const { installBootTimingObserver } = await freshModule();
    const reporter = vi.fn();
    installBootTimingObserver({ reporter });
    await vi.advanceTimersByTimeAsync(50);

    expect(reporter).toHaveBeenCalledWith(
      'client_boot_timing',
      expect.objectContaining({ dom_complete_ms: undefined }),
    );
  });

  it('falls back to the no-op reporter when none is supplied', async () => {
    const { installBootTimingObserver } = await freshModule();
    expect(() => installBootTimingObserver()).not.toThrow();
    await vi.advanceTimersByTimeAsync(50);
  });

  it("onReady's own captured guard is hit when a second install's listener fires after the first already captured", async () => {
    // Two installs before 'load' fires register two independent `onReady`
    // closures on the same `window` target (module-level `captured` is
    // still false when the second install runs, since it only flips
    // inside `onReady` itself). When 'load' fires once, both listeners run
    // in registration order: the first sets `captured` and schedules; the
    // second then hits its own `if (captured) return;` guard.
    Object.defineProperty(document, 'readyState', { value: 'loading', configurable: true });
    const { installBootTimingObserver } = await freshModule();
    const reporterA = vi.fn();
    const reporterB = vi.fn();
    installBootTimingObserver({ reporter: reporterA });
    installBootTimingObserver({ reporter: reporterB });

    window.dispatchEvent(new Event('load'));
    await vi.advanceTimersByTimeAsync(50);

    expect(reporterA).toHaveBeenCalledTimes(1);
    expect(reporterB).not.toHaveBeenCalled();
  });

  it('the teardown function removes the load listener and marks captured without throwing', async () => {
    Object.defineProperty(document, 'readyState', { value: 'loading', configurable: true });
    const { installBootTimingObserver } = await freshModule();
    const reporter = vi.fn();
    const teardown = installBootTimingObserver({ reporter });

    expect(() => teardown()).not.toThrow();

    window.dispatchEvent(new Event('load'));
    await vi.advanceTimersByTimeAsync(50);
    expect(reporter).not.toHaveBeenCalled();
  });
});
