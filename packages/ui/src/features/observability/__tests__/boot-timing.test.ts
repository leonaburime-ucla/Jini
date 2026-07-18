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

  it('captures at most once per module instance', async () => {
    const { installBootTimingObserver } = await freshModule();
    const reporter = vi.fn();
    installBootTimingObserver({ reporter });
    await vi.advanceTimersByTimeAsync(50);
    installBootTimingObserver({ reporter });
    await vi.advanceTimersByTimeAsync(50);

    expect(reporter).toHaveBeenCalledTimes(1);
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
});
