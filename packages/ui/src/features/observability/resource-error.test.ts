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
    installResourceErrorObserver({ reporter: reporterB });

    const img = document.createElement('img');
    img.src = 'https://example.test/dup.png';
    document.body.appendChild(img);
    dispatchResourceError(img);

    expect(reporterA).toHaveBeenCalledTimes(1);
    expect(reporterB).not.toHaveBeenCalled();
  });
});
