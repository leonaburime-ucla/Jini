import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function freshModule() {
  vi.resetModules();
  return import('../white-screen.js');
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

  it('defaults the reporter and timeout when neither is supplied', async () => {
    const { installWhiteScreenDetector } = await freshModule();
    expect(() => installWhiteScreenDetector()).not.toThrow();
    vi.advanceTimersByTime(5000); // DEFAULT_TIMEOUT_MS
  });

  it('does nothing (and returns a callable no-op teardown) when window is unavailable (SSR-style)', async () => {
    vi.stubGlobal('window', undefined);
    try {
      const { installWhiteScreenDetector } = await freshModule();
      const reporter = vi.fn();
      const teardown = installWhiteScreenDetector({ reporter, timeoutMs: 1000 });
      expect(() => teardown()).not.toThrow();
      expect(reporter).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('does nothing (and returns a callable no-op teardown) when document is unavailable (SSR-style)', async () => {
    vi.stubGlobal('document', undefined);
    try {
      const { installWhiteScreenDetector } = await freshModule();
      const reporter = vi.fn();
      const teardown = installWhiteScreenDetector({ reporter, timeoutMs: 1000 });
      expect(() => teardown()).not.toThrow();
      expect(reporter).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('reports body_child_count 0 rather than throwing when document.body is null', async () => {
    const { installWhiteScreenDetector } = await freshModule();
    const reporter = vi.fn();
    const originalBody = document.body;
    installWhiteScreenDetector({ reporter, timeoutMs: 1000 });
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

  it('scans a custom rootElementId instead of document.body when it resolves to a real element', async () => {
    const container = document.createElement('div');
    container.id = 'custom-root';
    const child = document.createElement('div');
    child.textContent = 'Real content in the custom root';
    container.appendChild(child);
    document.body.appendChild(container);

    const { installWhiteScreenDetector } = await freshModule();
    const reporter = vi.fn();
    installWhiteScreenDetector({ reporter, timeoutMs: 1000, minVisibleText: 5, rootElementId: 'custom-root' });

    vi.advanceTimersByTime(1000);

    expect(reporter).not.toHaveBeenCalled();
  });

  it('falls back to document.body when a supplied rootElementId does not resolve to any element', async () => {
    const child = document.createElement('div');
    child.textContent = 'Real content directly in body';
    document.body.appendChild(child);

    const { installWhiteScreenDetector } = await freshModule();
    const reporter = vi.fn();
    installWhiteScreenDetector({
      reporter,
      timeoutMs: 1000,
      minVisibleText: 5,
      rootElementId: 'does-not-exist',
    });

    vi.advanceTimersByTime(1000);

    expect(reporter).not.toHaveBeenCalled();
  });

  it('reports when the root has no non-loading-shell children at all', async () => {
    const shell = document.createElement('div');
    shell.className = 'app-loading-shell';
    document.body.appendChild(shell);

    const { installWhiteScreenDetector } = await freshModule();
    const reporter = vi.fn();
    installWhiteScreenDetector({ reporter, timeoutMs: 1000 });

    vi.advanceTimersByTime(1000);

    expect(reporter).toHaveBeenCalledWith('client_white_screen', expect.anything());
  });

  it('prefers innerText over textContent when innerText is present', async () => {
    const child = document.createElement('div');
    Object.defineProperty(child, 'innerText', { value: 'A real innerText value', configurable: true });
    child.textContent = ''; // textContent alone would report unmounted
    document.body.appendChild(child);

    const { installWhiteScreenDetector } = await freshModule();
    const reporter = vi.fn();
    installWhiteScreenDetector({ reporter, timeoutMs: 1000, minVisibleText: 5 });

    vi.advanceTimersByTime(1000);

    expect(reporter).not.toHaveBeenCalled();
  });
});
