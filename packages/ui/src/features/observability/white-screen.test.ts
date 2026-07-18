import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function freshModule() {
  vi.resetModules();
  return import('./white-screen.js');
}

describe('installWhiteScreenDetector', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-app-mounted');
    document.body.innerHTML = '';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports client_white_screen when nothing mounts before the timeout', async () => {
    const { installWhiteScreenDetector } = await freshModule();
    const reporter = vi.fn();
    installWhiteScreenDetector({ reporter, timeoutMs: 1000 });

    vi.advanceTimersByTime(1000);

    expect(reporter).toHaveBeenCalledWith(
      'client_white_screen',
      expect.objectContaining({ reason: 'app_not_mounted_after_timeout', timeout_ms: 1000 }),
    );
  });

  it('does not report when the mounted attribute is present before the timeout', async () => {
    document.documentElement.setAttribute('data-app-mounted', '1');
    const { installWhiteScreenDetector } = await freshModule();
    const reporter = vi.fn();
    installWhiteScreenDetector({ reporter, timeoutMs: 1000 });

    vi.advanceTimersByTime(1000);

    expect(reporter).not.toHaveBeenCalled();
  });

  it('re-checks the mounted attribute at timeout expiry, so a late mount still suppresses the report', async () => {
    // The mounted-attribute signal lives on <html>, outside the <body>
    // subtree the MutationObserver watches, so a bare attribute set with no
    // accompanying body mutation is only caught by the timeout callback's
    // own re-check immediately before it would otherwise report — not by
    // the mutation observer path (that path is exercised by the
    // already-mounted-at-install case above and by the fallback text scan
    // below, both of which go through actual <body> mutations).
    const { installWhiteScreenDetector } = await freshModule();
    const reporter = vi.fn();
    installWhiteScreenDetector({ reporter, timeoutMs: 1000 });

    document.documentElement.setAttribute('data-app-mounted', '1');
    vi.advanceTimersByTime(1000);

    expect(reporter).not.toHaveBeenCalled();
  });

  it('falls back to scanning root text when the mounted attribute is absent', async () => {
    const child = document.createElement('div');
    child.textContent = 'Real rendered content here';
    document.body.appendChild(child);

    const { installWhiteScreenDetector } = await freshModule();
    const reporter = vi.fn();
    installWhiteScreenDetector({ reporter, timeoutMs: 1000, minVisibleText: 5 });

    vi.advanceTimersByTime(1000);

    expect(reporter).not.toHaveBeenCalled();
  });

  it('does not count a loading-shell-classed child as mounted content', async () => {
    const shell = document.createElement('div');
    shell.className = 'app-loading-shell';
    shell.textContent = 'Loading a very long placeholder message indeed';
    document.body.appendChild(shell);

    const { installWhiteScreenDetector } = await freshModule();
    const reporter = vi.fn();
    installWhiteScreenDetector({ reporter, timeoutMs: 1000 });

    vi.advanceTimersByTime(1000);

    expect(reporter).toHaveBeenCalledWith('client_white_screen', expect.anything());
  });

  it('cancels the timer once real content mounts into <body> after install', async () => {
    const { installWhiteScreenDetector } = await freshModule();
    const reporter = vi.fn();
    installWhiteScreenDetector({ reporter, timeoutMs: 1000, minVisibleText: 5 });

    const child = document.createElement('div');
    child.textContent = 'Mounted after install';
    document.body.appendChild(child);
    // Let the MutationObserver's microtask callback run.
    await Promise.resolve();

    vi.advanceTimersByTime(1000);
    expect(reporter).not.toHaveBeenCalled();
  });

  it('respects a custom mountedAttribute name', async () => {
    document.documentElement.setAttribute('data-custom-mount', 'ready');
    const { installWhiteScreenDetector } = await freshModule();
    const reporter = vi.fn();
    installWhiteScreenDetector({
      reporter,
      timeoutMs: 1000,
      mountedAttribute: 'data-custom-mount',
      mountedAttributeValue: 'ready',
    });

    vi.advanceTimersByTime(1000);

    expect(reporter).not.toHaveBeenCalled();
  });

  it('stops reporting after teardown', async () => {
    const { installWhiteScreenDetector } = await freshModule();
    const reporter = vi.fn();
    const teardown = installWhiteScreenDetector({ reporter, timeoutMs: 1000 });
    teardown();

    vi.advanceTimersByTime(1000);

    expect(reporter).not.toHaveBeenCalled();
  });
});
