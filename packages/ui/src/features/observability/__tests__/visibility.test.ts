import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function freshModule() {
  vi.resetModules();
  return import('../visibility.js');
}

describe('installVisibilityObserver', () => {
  let visibilityState: DocumentVisibilityState = 'visible';

  beforeEach(() => {
    visibilityState = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibilityState);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('reports client_visibility_change with elapsed time in the previous state', async () => {
    const { installVisibilityObserver } = await freshModule();
    const reporter = vi.fn();
    installVisibilityObserver({ reporter });

    vi.advanceTimersByTime(1000);
    visibilityState = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));

    expect(reporter).toHaveBeenCalledWith(
      'client_visibility_change',
      expect.objectContaining({ to_state: 'hidden', previous_state_duration_ms: 1000 }),
    );
  });

  it('reports client_session_summary on pagehide with accumulated foreground time', async () => {
    const { installVisibilityObserver } = await freshModule();
    const reporter = vi.fn();
    installVisibilityObserver({ reporter });

    vi.advanceTimersByTime(2000);
    window.dispatchEvent(new Event('pagehide'));

    expect(reporter).toHaveBeenCalledWith(
      'client_session_summary',
      expect.objectContaining({ page_lifetime_ms: 2000, foreground_ms: 2000 }),
    );
  });

  it('does not accumulate foreground time while hidden', async () => {
    const { installVisibilityObserver } = await freshModule();
    const reporter = vi.fn();
    installVisibilityObserver({ reporter });

    vi.advanceTimersByTime(500);
    visibilityState = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));

    vi.advanceTimersByTime(5000); // time passes while hidden — should not count
    window.dispatchEvent(new Event('pagehide'));

    const summaryCall = reporter.mock.calls.find(([name]) => name === 'client_session_summary');
    expect(summaryCall?.[1]).toMatchObject({ foreground_ms: 500 });
  });

  it('stops listening after teardown', async () => {
    const { installVisibilityObserver } = await freshModule();
    const reporter = vi.fn();
    const teardown = installVisibilityObserver({ reporter });
    teardown();

    document.dispatchEvent(new Event('visibilitychange'));
    expect(reporter).not.toHaveBeenCalled();
  });
});
