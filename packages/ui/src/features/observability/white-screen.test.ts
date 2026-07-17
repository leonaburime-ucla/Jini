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

  it('ignores a mutation record already queued when teardown disconnects the observer', async () => {
    const { installWhiteScreenDetector } = await freshModule();
    const reporter = vi.fn();
    const teardown = installWhiteScreenDetector({ reporter, timeoutMs: 1000, minVisibleText: 5 });

    const child = document.createElement('div');
    child.textContent = 'Mounted right before teardown';
    document.body.appendChild(child); // queues a MutationObserver microtask, not yet delivered
    teardown(); // disconnects synchronously, before that microtask runs
    await Promise.resolve();

    vi.advanceTimersByTime(1000);
    expect(reporter).not.toHaveBeenCalled();
  });

  it('defaults reporter, timeoutMs, and minVisibleText when none are supplied', async () => {
    const { installWhiteScreenDetector } = await freshModule();
    expect(() => {
      installWhiteScreenDetector();
      vi.advanceTimersByTime(5000); // DEFAULT_TIMEOUT_MS
    }).not.toThrow();
  });

  it('scans a custom rootElementId instead of document.body when supplied', async () => {
    const customRoot = document.createElement('div');
    customRoot.id = 'custom-root';
    const child = document.createElement('div');
    child.textContent = 'Real rendered content here';
    customRoot.appendChild(child);
    document.body.appendChild(customRoot);

    const { installWhiteScreenDetector } = await freshModule();
    const reporter = vi.fn();
    installWhiteScreenDetector({
      reporter,
      timeoutMs: 1000,
      minVisibleText: 5,
      rootElementId: 'custom-root',
    });

    vi.advanceTimersByTime(1000);

    expect(reporter).not.toHaveBeenCalled();
  });

  it('returns an inert teardown when document is unavailable', async () => {
    vi.stubGlobal('document', undefined);
    try {
      const { installWhiteScreenDetector } = await freshModule();
      const teardown = installWhiteScreenDetector();
      expect(() => teardown()).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('reports with a zero body_child_count when document.body is unavailable at report time', async () => {
    const { installWhiteScreenDetector } = await freshModule();
    const reporter = vi.fn();
    installWhiteScreenDetector({ reporter, timeoutMs: 1000, rootElementId: 'missing-root' });

    const originalBody = document.body;
    Object.defineProperty(document, 'body', { value: null, configurable: true });
    try {
      vi.advanceTimersByTime(1000);
    } finally {
      Object.defineProperty(document, 'body', { value: originalBody, configurable: true });
    }

    expect(reporter).toHaveBeenCalledWith(
      'client_white_screen',
      expect.objectContaining({ body_child_count: 0 }),
    );
  });
});
