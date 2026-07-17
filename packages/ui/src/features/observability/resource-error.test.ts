import { afterEach, describe, expect, it, vi } from 'vitest';

async function freshModule() {
  vi.resetModules();
  return import('./resource-error.js');
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

  it('is idempotent per install: a second install call is a no-op teardown', async () => {
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

  it('defaults to a no-op reporter when none is supplied', async () => {
    const { installResourceErrorObserver } = await freshModule();
    installResourceErrorObserver();

    const img = document.createElement('img');
    img.src = 'https://example.test/default-reporter.png';
    document.body.appendChild(img);
    expect(() => dispatchResourceError(img)).not.toThrow();
  });

  it('ignores an error event whose target is not an Element', async () => {
    const { installResourceErrorObserver } = await freshModule();
    const reporter = vi.fn();
    installResourceErrorObserver({ reporter });

    const event = new Event('error');
    Object.defineProperty(event, 'target', { value: document.createTextNode('x'), configurable: true });
    window.dispatchEvent(event);

    expect(reporter).not.toHaveBeenCalled();
  });

  it('ignores a resource-tag element with no resolvable src', async () => {
    const { installResourceErrorObserver } = await freshModule();
    const reporter = vi.fn();
    installResourceErrorObserver({ reporter });

    const audio = document.createElement('audio'); // no src attribute set
    document.body.appendChild(audio);
    dispatchResourceError(audio);

    expect(reporter).not.toHaveBeenCalled();
  });

  it.each([
    ['script', 'src', 'https://example.test/chunk.js'],
    ['iframe', 'src', 'https://example.test/frame.html'],
    ['source', 'src', 'https://example.test/clip.mp4'],
    ['track', 'src', 'https://example.test/captions.vtt'],
    ['video', 'src', 'https://example.test/video.mp4'],
    ['audio', 'src', 'https://example.test/audio.mp3'],
  ] as const)('reads src for a failed <%s>', async (tagName, attr, url) => {
    const { installResourceErrorObserver } = await freshModule();
    const reporter = vi.fn();
    installResourceErrorObserver({ reporter });

    const el = document.createElement(tagName);
    (el as unknown as Record<string, string>)[attr] = url;
    document.body.appendChild(el);
    dispatchResourceError(el);

    expect(reporter).toHaveBeenCalledWith(
      'client_resource_error',
      expect.objectContaining({ tag: tagName, url }),
    );
  });
});
