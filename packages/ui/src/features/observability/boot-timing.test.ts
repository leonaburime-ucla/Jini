import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function freshModule() {
  vi.resetModules();
  return import('./boot-timing.js');
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
    Reflect.deleteProperty(performance, 'timing');
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

  it('captures at most once per module instance, and both teardowns are safe to call', async () => {
    const { installBootTimingObserver } = await freshModule();
    const reporter = vi.fn();
    const teardown1 = installBootTimingObserver({ reporter });
    await vi.advanceTimersByTimeAsync(50);
    // Second install call after capture is already inert — exercises the
    // "captured" no-op teardown branch.
    const teardown2 = installBootTimingObserver({ reporter });
    await vi.advanceTimersByTimeAsync(50);

    expect(reporter).toHaveBeenCalledTimes(1);
    expect(() => teardown2()).not.toThrow();
    // The first (real) teardown still runs its removeEventListener body.
    expect(() => teardown1()).not.toThrow();
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

  it('guards against two pending installs both settling from the same load event', async () => {
    Object.defineProperty(document, 'readyState', { value: 'loading', configurable: true });
    const { installBootTimingObserver } = await freshModule();
    const reporterA = vi.fn();
    const reporterB = vi.fn();
    installBootTimingObserver({ reporter: reporterA });
    installBootTimingObserver({ reporter: reporterB });

    // Both installs are still pending (neither has captured yet), so both
    // register a 'load' listener. A single load event fires both handlers
    // in the same tick — the second one must see `captured` already true.
    window.dispatchEvent(new Event('load'));
    await vi.advanceTimersByTimeAsync(50);

    expect(reporterA).toHaveBeenCalledTimes(1);
    expect(reporterB).not.toHaveBeenCalled();
  });

  it('defaults to a no-op reporter when none is supplied', async () => {
    const { installBootTimingObserver } = await freshModule();
    expect(() => installBootTimingObserver()).not.toThrow();
    await vi.advanceTimersByTimeAsync(50);
  });

  it('returns an inert teardown when performance is unavailable', async () => {
    vi.stubGlobal('performance', undefined);
    const { installBootTimingObserver } = await freshModule();
    const teardown = installBootTimingObserver();

    expect(() => teardown()).not.toThrow();
  });

  it('uses requestIdleCallback for scheduling when the engine provides one', async () => {
    const requestIdleCallback = vi.fn((cb: () => void) => {
      cb();
      return 1;
    });
    vi.stubGlobal('requestIdleCallback', requestIdleCallback);
    const { installBootTimingObserver } = await freshModule();
    const reporter = vi.fn();
    installBootTimingObserver({ reporter });

    expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 2000 });
    expect(reporter).toHaveBeenCalledTimes(1);
  });

  it('omits transfer_size_bytes when the entry reports a zero or non-numeric size', async () => {
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

  it('omits a timing field that resolves to NaN', async () => {
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
      { ...FAKE_NAV_ENTRY, domInteractive: NaN } as unknown as PerformanceNavigationTiming,
    ]);
    const { installBootTimingObserver } = await freshModule();
    const reporter = vi.fn();
    installBootTimingObserver({ reporter });
    await vi.advanceTimersByTimeAsync(50);

    expect(reporter).toHaveBeenCalledWith(
      'client_boot_timing',
      expect.objectContaining({ dom_interactive_ms: undefined }),
    );
  });

  it('falls back to legacy performance.timing when no navigation entry exists', async () => {
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([]);
    const base = 1_000;
    Object.defineProperty(performance, 'timing', {
      value: {
        navigationStart: base,
        domInteractive: base + 120,
        domContentLoadedEventStart: base + 140,
        domComplete: base + 300,
        loadEventStart: base + 310,
      },
      configurable: true,
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
      }),
    );
  });
});
