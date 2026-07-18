import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const longTaskTeardown = vi.fn();
const resourceErrorTeardown = vi.fn();
const bootTimingTeardown = vi.fn();
const visibilityTeardown = vi.fn();
const whiteScreenTeardown = vi.fn(() => {
  throw new Error('teardown boom');
});

const installLongTaskObserver = vi.fn(() => longTaskTeardown);
const installResourceErrorObserver = vi.fn(() => resourceErrorTeardown);
const installBootTimingObserver = vi.fn(() => bootTimingTeardown);
const installVisibilityObserver = vi.fn(() => visibilityTeardown);
const installWhiteScreenDetector = vi.fn(() => whiteScreenTeardown);

vi.mock('../long-task.js', () => ({ installLongTaskObserver }));
vi.mock('../resource-error.js', () => ({ installResourceErrorObserver }));
vi.mock('../boot-timing.js', () => ({ installBootTimingObserver }));
vi.mock('../visibility.js', () => ({ installVisibilityObserver }));
vi.mock('../white-screen.js', () => ({ installWhiteScreenDetector }));

async function freshModule() {
  vi.resetModules();
  return import('../install.js');
}

describe('installWebObservability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    longTaskTeardown.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('installs every observer with the shared reporter merged into per-observer options', async () => {
    const { installWebObservability } = await freshModule();
    const reporter = vi.fn();
    installWebObservability({ reporter, longTask: { minDurationMs: 250 } });

    expect(installLongTaskObserver).toHaveBeenCalledWith({ minDurationMs: 250, reporter });
    expect(installResourceErrorObserver).toHaveBeenCalledWith({ reporter });
    expect(installBootTimingObserver).toHaveBeenCalledWith({ reporter });
    expect(installVisibilityObserver).toHaveBeenCalledWith({ reporter });
    expect(installWhiteScreenDetector).toHaveBeenCalledWith({ reporter });
  });

  it('is idempotent: a second call installs nothing further', async () => {
    const { installWebObservability } = await freshModule();
    installWebObservability();
    installWebObservability();

    expect(installLongTaskObserver).toHaveBeenCalledTimes(1);
  });

  it('tears down every observer even when one teardown throws', async () => {
    const { installWebObservability } = await freshModule();
    const teardown = installWebObservability();

    expect(() => teardown()).not.toThrow();
    expect(longTaskTeardown).toHaveBeenCalledTimes(1);
    expect(resourceErrorTeardown).toHaveBeenCalledTimes(1);
    expect(bootTimingTeardown).toHaveBeenCalledTimes(1);
    expect(visibilityTeardown).toHaveBeenCalledTimes(1);
    expect(whiteScreenTeardown).toHaveBeenCalledTimes(1);
  });

  it('allows re-installing after teardown', async () => {
    const { installWebObservability } = await freshModule();
    const teardown = installWebObservability();
    teardown();
    installWebObservability();

    expect(installLongTaskObserver).toHaveBeenCalledTimes(2);
  });
});
