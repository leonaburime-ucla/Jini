import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ObserverCallback = (list: { getEntries: () => unknown[] }) => void;

type ObserveBehavior = 'ok' | 'throw-on-buffered' | 'always-throw';

class FakePerformanceObserver {
  static supportedEntryTypes: readonly string[] = ['longtask'];
  static instances: FakePerformanceObserver[] = [];
  /** Controls observe()'s failure mode for the older-engine fallback tests. */
  static observeBehavior: ObserveBehavior = 'ok';
  callback: ObserverCallback;
  observed: unknown[] = [];
  disconnected = false;

  constructor(callback: ObserverCallback) {
    this.callback = callback;
    FakePerformanceObserver.instances.push(this);
  }

  observe(options: { buffered?: boolean }): void {
    const behavior = FakePerformanceObserver.observeBehavior;
    if (behavior === 'always-throw' || (behavior === 'throw-on-buffered' && options.buffered)) {
      throw new Error('observe() unsupported');
    }
    this.observed.push(options);
  }

  disconnect(): void {
    this.disconnected = true;
  }

  emit(entries: unknown[]): void {
    this.callback({ getEntries: () => entries });
  }
}

async function freshModule() {
  vi.resetModules();
  return import('./long-task.js');
}

describe('installLongTaskObserver', () => {
  beforeEach(() => {
    FakePerformanceObserver.instances = [];
    FakePerformanceObserver.supportedEntryTypes = ['longtask'];
    FakePerformanceObserver.observeBehavior = 'ok';
    vi.stubGlobal('PerformanceObserver', FakePerformanceObserver as unknown as typeof PerformanceObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports entries at or above the duration threshold, and skips shorter ones', async () => {
    const { installLongTaskObserver } = await freshModule();
    const reporter = vi.fn();
    installLongTaskObserver({ reporter });

    const [instance] = FakePerformanceObserver.instances;
    instance!.emit([
      { duration: 250, startTime: 10 },
      { duration: 40, startTime: 20 }, // below default 100ms threshold
    ]);

    expect(reporter).toHaveBeenCalledTimes(1);
    expect(reporter).toHaveBeenCalledWith(
      'client_long_task',
      expect.objectContaining({ duration_ms: 250, start_time_ms: 10 }),
    );
  });

  it('honors a custom minDurationMs', async () => {
    const { installLongTaskObserver } = await freshModule();
    const reporter = vi.fn();
    installLongTaskObserver({ reporter, minDurationMs: 10 });

    const [instance] = FakePerformanceObserver.instances;
    instance!.emit([{ duration: 15, startTime: 0 }]);

    expect(reporter).toHaveBeenCalledTimes(1);
  });

  it('includes attribution fields, stripping query strings from containerSrc', async () => {
    const { installLongTaskObserver } = await freshModule();
    const reporter = vi.fn();
    installLongTaskObserver({ reporter });

    const [instance] = FakePerformanceObserver.instances;
    instance!.emit([
      {
        duration: 200,
        startTime: 5,
        attribution: [
          { containerType: 'iframe', containerName: 'preview', containerSrc: 'https://a.test/x?y=1' },
        ],
      },
    ]);

    expect(reporter).toHaveBeenCalledWith(
      'client_long_task',
      expect.objectContaining({
        container_type: 'iframe',
        container_name: 'preview',
        container_src_origin: 'https://a.test/x',
      }),
    );
  });

  it('no-ops without reporting when PerformanceObserver is unsupported', async () => {
    FakePerformanceObserver.supportedEntryTypes = [];
    const { installLongTaskObserver } = await freshModule();
    const teardown = installLongTaskObserver();
    expect(FakePerformanceObserver.instances).toHaveLength(0);
    expect(() => teardown()).not.toThrow();
  });

  it('disconnects the observer on teardown', async () => {
    const { installLongTaskObserver } = await freshModule();
    const teardown = installLongTaskObserver();
    const [instance] = FakePerformanceObserver.instances;
    teardown();
    expect(instance!.disconnected).toBe(true);
  });

  it('defaults to a no-op reporter when none is supplied', async () => {
    const { installLongTaskObserver } = await freshModule();
    expect(() => {
      installLongTaskObserver();
      const [instance] = FakePerformanceObserver.instances;
      instance!.emit([{ duration: 999, startTime: 0 }]);
    }).not.toThrow();
  });

  it('returns an inert teardown when PerformanceObserver does not exist', async () => {
    vi.stubGlobal('PerformanceObserver', undefined);
    const { installLongTaskObserver } = await freshModule();
    const teardown = installLongTaskObserver();

    expect(() => teardown()).not.toThrow();
  });

  it('reuses the existing observer when already installed in this module instance', async () => {
    const { installLongTaskObserver } = await freshModule();
    installLongTaskObserver();
    expect(FakePerformanceObserver.instances).toHaveLength(1);

    // A second call before teardown must not construct a second observer —
    // it reuses (and disconnects) the existing one on teardown.
    const secondTeardown = installLongTaskObserver();
    expect(FakePerformanceObserver.instances).toHaveLength(1);

    secondTeardown();
    expect(FakePerformanceObserver.instances[0]!.disconnected).toBe(true);
  });

  it('falls back to observing without `buffered` when the engine rejects it', async () => {
    FakePerformanceObserver.observeBehavior = 'throw-on-buffered';
    const { installLongTaskObserver } = await freshModule();
    const reporter = vi.fn();
    installLongTaskObserver({ reporter });

    const [instance] = FakePerformanceObserver.instances;
    expect(instance!.observed).toEqual([{ type: 'longtask' }]);

    instance!.emit([{ duration: 200, startTime: 0 }]);
    expect(reporter).toHaveBeenCalledTimes(1);
  });

  it('returns an inert teardown when both observe() attempts throw', async () => {
    FakePerformanceObserver.observeBehavior = 'always-throw';
    const { installLongTaskObserver } = await freshModule();
    const teardown = installLongTaskObserver();

    expect(() => teardown()).not.toThrow();
  });

  it('keeps an unparseable containerSrc as-is instead of stripping its query string', async () => {
    const { installLongTaskObserver } = await freshModule();
    const reporter = vi.fn();
    installLongTaskObserver({ reporter });

    const [instance] = FakePerformanceObserver.instances;
    instance!.emit([
      {
        duration: 200,
        startTime: 0,
        attribution: [{ containerSrc: 'not a valid url' }],
      },
    ]);

    expect(reporter).toHaveBeenCalledWith(
      'client_long_task',
      expect.objectContaining({ container_src_origin: 'not a valid url' }),
    );
  });
});
