import { afterEach, describe, expect, it, vi } from 'vitest';

async function freshModule() {
  vi.resetModules();
  return import('../resource-error.js');
}

function dispatchResourceError(target: Element): void {
  const event = new Event('error');
  Object.defineProperty(event, 'target', { value: target, configurable: true });
  window.dispatchEvent(event);
}

describe('installResourceErrorObserver', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('reports a failed <img> load with its src and attribute flags', async () => {
    const { installResourceErrorObserver } = await freshModule();
    const reporter = vi.fn();
    const teardown = installResourceErrorObserver({ reporter });

    const img = document.createElement('img');
    img.src = 'https://example.test/broken.png';
    document.body.appendChild(img);
    dispatchResourceError(img);

    expect(reporter).toHaveBeenCalledWith(
      'client_resource_error',
      expect.objectContaining({
        tag: 'img',
        url: 'https://example.test/broken.png',
        async_attr: false,
        defer_attr: false,
      }),
    );
    teardown();
  });

  it('reads href for a failed <link>', async () => {
    const { installResourceErrorObserver } = await freshModule();
    const reporter = vi.fn();
    installResourceErrorObserver({ reporter });

    const link = document.createElement('link');
    link.href = 'https://example.test/style.css';
    document.body.appendChild(link);
    dispatchResourceError(link);

    expect(reporter).toHaveBeenCalledWith(
      'client_resource_error',
      expect.objectContaining({ tag: 'link', url: 'https://example.test/style.css' }),
    );
  });

  it('ignores errors on elements outside the tracked resource tag set', async () => {
    const { installResourceErrorObserver } = await freshModule();
    const reporter = vi.fn();
    installResourceErrorObserver({ reporter });

    const div = document.createElement('div');
    document.body.appendChild(div);
    dispatchResourceError(div);

    expect(reporter).not.toHaveBeenCalled();
  });

  it('stops reporting after teardown', async () => {
    const { installResourceErrorObserver } = await freshModule();
    const reporter = vi.fn();
    const teardown = installResourceErrorObserver({ reporter });
    teardown();

    const img = document.createElement('img');
    img.src = 'https://example.test/after-teardown.png';
    document.body.appendChild(img);
    dispatchResourceError(img);

    expect(reporter).not.toHaveBeenCalled();
  });

  it('is idempotent per install: a second install call is a callable no-op teardown', async () => {
    const { installResourceErrorObserver } = await freshModule();
    const reporterA = vi.fn();
    const reporterB = vi.fn();
    installResourceErrorObserver({ reporter: reporterA });
    const secondTeardown = installResourceErrorObserver({ reporter: reporterB });

    const img = document.createElement('img');
    img.src = 'https://example.test/dup.png';
    document.body.appendChild(img);
    dispatchResourceError(img);

    expect(reporterA).toHaveBeenCalledTimes(1);
    expect(reporterB).not.toHaveBeenCalled();
    expect(() => secondTeardown()).not.toThrow();
  });

  it('does nothing (and does not throw) when window is unavailable (SSR-style)', async () => {
    vi.stubGlobal('window', undefined);
    try {
      const { installResourceErrorObserver } = await freshModule();
      const reporter = vi.fn();
      const teardown = installResourceErrorObserver({ reporter });
      expect(() => teardown()).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('ignores an error event whose target is not an Element', async () => {
    const { installResourceErrorObserver } = await freshModule();
    const reporter = vi.fn();
    installResourceErrorObserver({ reporter });

    const event = new Event('error');
    Object.defineProperty(event, 'target', { value: null, configurable: true });
    window.dispatchEvent(event);

    expect(reporter).not.toHaveBeenCalled();
  });

  it('ignores a tracked-tag element that resolves to no src/href at all', async () => {
    const { installResourceErrorObserver } = await freshModule();
    const reporter = vi.fn();
    installResourceErrorObserver({ reporter });

    const source = document.createElement('source'); // no `src` set
    document.body.appendChild(source);
    dispatchResourceError(source);

    expect(reporter).not.toHaveBeenCalled();
  });

  it('reports async/defer/crossorigin attribute flags when present', async () => {
    const { installResourceErrorObserver } = await freshModule();
    const reporter = vi.fn();
    installResourceErrorObserver({ reporter });

    const script = document.createElement('script');
    script.src = 'https://example.test/chunk.js';
    script.setAttribute('async', '');
    script.setAttribute('defer', '');
    script.setAttribute('crossorigin', 'anonymous');
    document.body.appendChild(script);
    dispatchResourceError(script);

    expect(reporter).toHaveBeenCalledWith(
      'client_resource_error',
      expect.objectContaining({
        tag: 'script',
        async_attr: true,
        defer_attr: true,
        crossorigin: 'anonymous',
      }),
    );
  });

  it('reads src for iframe, source, track, audio, and video elements', async () => {
    const { installResourceErrorObserver } = await freshModule();
    const reporter = vi.fn();
    installResourceErrorObserver({ reporter });

    const cases: Array<[string, HTMLElement]> = [
      ['iframe', Object.assign(document.createElement('iframe'), { src: 'https://example.test/a' })],
      ['source', Object.assign(document.createElement('source'), { src: 'https://example.test/b' })],
      ['track', Object.assign(document.createElement('track'), { src: 'https://example.test/c' })],
      ['audio', Object.assign(document.createElement('audio'), { src: 'https://example.test/d' })],
      ['video', Object.assign(document.createElement('video'), { src: 'https://example.test/e' })],
    ];
    for (const [, el] of cases) {
      document.body.appendChild(el);
      dispatchResourceError(el);
    }

    expect(reporter).toHaveBeenCalledTimes(cases.length);
    for (const [tag] of cases) {
      expect(reporter).toHaveBeenCalledWith('client_resource_error', expect.objectContaining({ tag }));
    }
  });

  it('falls back to a bare src/href attribute for an element outside the typed instanceof chain', async () => {
    const { installResourceErrorObserver } = await freshModule();
    const reporter = vi.fn();
    installResourceErrorObserver({ reporter });

    // Custom element tagName won't match RESOURCE_TAGS, so use a real
    // tracked tag whose class isn't one of readSrc's typed branches by
    // faking its prototype chain — instead, exercise the fallback path
    // directly via an element with a manually-set `src` *attribute* (not
    // property) on a tag this jsdom build doesn't subclass distinctly.
    const el = document.createElement('img');
    Object.setPrototypeOf(el, Element.prototype);
    el.setAttribute('src', 'https://example.test/fallback.png');
    document.body.appendChild(el);
    dispatchResourceError(el);

    expect(reporter).toHaveBeenCalledWith(
      'client_resource_error',
      expect.objectContaining({ url: 'https://example.test/fallback.png' }),
    );
  });

  it('falls back to the bare href attribute when there is no src attribute at all', async () => {
    const { installResourceErrorObserver } = await freshModule();
    const reporter = vi.fn();
    installResourceErrorObserver({ reporter });

    const el = document.createElement('img');
    Object.setPrototypeOf(el, Element.prototype);
    el.setAttribute('href', 'https://example.test/fallback-href.png');
    document.body.appendChild(el);
    dispatchResourceError(el);

    expect(reporter).toHaveBeenCalledWith(
      'client_resource_error',
      expect.objectContaining({ url: 'https://example.test/fallback-href.png' }),
    );
  });

  it('falls back to the no-op reporter when none is supplied', async () => {
    const { installResourceErrorObserver } = await freshModule();
    expect(() => installResourceErrorObserver()).not.toThrow();
  });
});
