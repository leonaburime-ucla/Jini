import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trackIframeLoad } from './iframe.js';

describe('trackIframeLoad', () => {
  let iframe: HTMLIFrameElement;

  beforeEach(() => {
    vi.useFakeTimers();
    iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
  });

  afterEach(() => {
    vi.useRealTimers();
    iframe.remove();
  });

  it('does not report on a successful load', () => {
    const reporter = vi.fn();
    trackIframeLoad({ iframe, surface: 'preview', reporter, timeoutMs: 5000 });

    iframe.dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(5000);

    expect(reporter).not.toHaveBeenCalled();
  });

  it('reports client_iframe_error on an error event, merging surface and context', () => {
    const reporter = vi.fn();
    trackIframeLoad({
      iframe,
      surface: 'preview',
      reporter,
      timeoutMs: 5000,
      context: { hostId: 'abc' },
    });

    iframe.dispatchEvent(new Event('error'));

    expect(reporter).toHaveBeenCalledWith(
      'client_iframe_error',
      expect.objectContaining({ surface: 'preview', reason: 'error_event', hostId: 'abc' }),
    );
  });

  it('reports client_iframe_timeout when neither load nor error fires in time', () => {
    const reporter = vi.fn();
    trackIframeLoad({ iframe, surface: 'preview', reporter, timeoutMs: 1000 });

    vi.advanceTimersByTime(1000);

    expect(reporter).toHaveBeenCalledWith(
      'client_iframe_timeout',
      expect.objectContaining({ surface: 'preview', timeout_ms: 1000 }),
    );
  });

  it('only settles once — a load after an error does not double-report', () => {
    const reporter = vi.fn();
    trackIframeLoad({ iframe, surface: 'preview', reporter, timeoutMs: 1000 });

    iframe.dispatchEvent(new Event('error'));
    iframe.dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(1000);

    expect(reporter).toHaveBeenCalledTimes(1);
  });

  it('stops listening and clears the timer once torn down', () => {
    const reporter = vi.fn();
    const teardown = trackIframeLoad({ iframe, surface: 'preview', reporter, timeoutMs: 1000 });
    teardown();

    iframe.dispatchEvent(new Event('error'));
    vi.advanceTimersByTime(1000);

    expect(reporter).not.toHaveBeenCalled();
  });
});
