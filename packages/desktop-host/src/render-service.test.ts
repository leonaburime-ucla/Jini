import { describe, expect, it, vi } from 'vitest';
import { RenderServiceError, htmlToDataUrl, isOriginAllowed, withRenderTimeout } from './render-service.js';

describe('htmlToDataUrl', () => {
  it('base64-encodes the html into a data: url', () => {
    const url = htmlToDataUrl('<html>hi</html>');
    expect(url).toBe(`data:text/html;base64,${Buffer.from('<html>hi</html>', 'utf8').toString('base64')}`);
  });
});

describe('isOriginAllowed', () => {
  it('allows everything when allowedOrigins is undefined (no allowlist configured)', () => {
    expect(isOriginAllowed('https://anything.example/x', undefined)).toBe(true);
  });

  it('always allows data: urls regardless of the allowlist', () => {
    expect(isOriginAllowed('data:text/html;base64,aGk=', ['https://good.example'])).toBe(true);
  });

  it('always allows about: urls regardless of the allowlist', () => {
    expect(isOriginAllowed('about:blank', ['https://good.example'])).toBe(true);
  });

  it('allows a url whose origin is in the allowlist', () => {
    expect(isOriginAllowed('https://good.example/path?x=1', ['https://good.example'])).toBe(true);
  });

  it('rejects a url whose origin is not in the allowlist', () => {
    expect(isOriginAllowed('https://evil.example/path', ['https://good.example'])).toBe(false);
  });

  it('rejects an unparseable url rather than throwing', () => {
    expect(isOriginAllowed('not a url', ['https://good.example'])).toBe(false);
  });
});

describe('withRenderTimeout', () => {
  it('rejects immediately if the signal is already aborted before starting', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(withRenderTimeout(Promise.resolve('never'), 1000, controller.signal)).rejects.toMatchObject({
      code: 'aborted',
    });
  });

  it('returns the promise unchanged when neither timeoutMs nor signal is given', async () => {
    const result = await withRenderTimeout(Promise.resolve('value'), undefined, undefined);
    expect(result).toBe('value');
  });

  it('resolves with the value when the promise settles before the timeout, cleaning up the abort listener', async () => {
    const controller = new AbortController();
    const removeSpy = vi.spyOn(controller.signal, 'removeEventListener');
    const result = await withRenderTimeout(Promise.resolve('ok'), 1000, controller.signal);
    expect(result).toBe('ok');
    expect(removeSpy).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('rejects with the original error when the promise rejects before the timeout', async () => {
    const controller = new AbortController();
    await expect(withRenderTimeout(Promise.reject(new Error('boom')), 1000, controller.signal)).rejects.toThrow('boom');
  });

  it('rejects with a timeout RenderServiceError when the promise never settles in time', async () => {
    const pending = new Promise<never>(() => {});
    await expect(withRenderTimeout(pending, 10, undefined)).rejects.toMatchObject({
      code: 'timeout',
      message: expect.stringContaining('render timed out after 10ms'),
    });
  });

  it('rejects with an aborted RenderServiceError when the signal aborts mid-flight, clearing the timer', async () => {
    const pending = new Promise<never>(() => {});
    const controller = new AbortController();
    const pendingResult = withRenderTimeout(pending, 10_000, controller.signal);
    controller.abort();
    await expect(pendingResult).rejects.toMatchObject({ code: 'aborted' });
  });

  it('ignores a late abort firing after the promise already settled (settled guard)', async () => {
    const controller = new AbortController();
    const result = await withRenderTimeout(Promise.resolve('fast'), undefined, controller.signal);
    controller.abort();
    expect(result).toBe('fast');
  });

  it('ignores a late resolve that arrives after the timeout already settled the promise (settled guard)', async () => {
    vi.useFakeTimers();
    try {
      let resolvePending: (value: string) => void = () => {};
      const pending = new Promise<string>((resolve) => {
        resolvePending = resolve;
      });
      const result = withRenderTimeout(pending, 10, undefined);
      const assertion = expect(result).rejects.toMatchObject({ code: 'timeout' });
      await vi.advanceTimersByTimeAsync(20);
      // The underlying render eventually finishes anyway, after the timeout
      // already rejected — the `if (settled) return` guard in the resolve
      // handler must swallow this instead of resolving twice.
      resolvePending('too late');
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores a late rejection that arrives after the timeout already settled the promise (settled guard)', async () => {
    vi.useFakeTimers();
    try {
      let rejectPending: (error: unknown) => void = () => {};
      const pending = new Promise<never>((_resolve, reject) => {
        rejectPending = reject;
      });
      const result = withRenderTimeout(pending, 10, undefined);
      const assertion = expect(result).rejects.toMatchObject({ code: 'timeout' });
      await vi.advanceTimersByTimeAsync(20);
      rejectPending(new Error('too late'));
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores a late abort that arrives after the timeout already settled the promise (settled guard, listener not yet removed)', async () => {
    vi.useFakeTimers();
    try {
      const controller = new AbortController();
      const pending = new Promise<never>(() => {});
      const result = withRenderTimeout(pending, 10, controller.signal);
      const assertion = expect(result).rejects.toMatchObject({ code: 'timeout' });
      await vi.advanceTimersByTimeAsync(20);
      // The timeout path does not remove the abort listener (only the
      // promise's resolve/reject handlers do), so a later abort is still
      // delivered to `onAbort` — which must no-op via the settled guard.
      controller.abort();
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('RenderServiceError', () => {
  it('carries the given code and a matching error name', () => {
    const error = new RenderServiceError('nope', 'not-implemented');
    expect(error.name).toBe('RenderServiceError');
    expect(error.code).toBe('not-implemented');
    expect(error.message).toBe('nope');
  });
});
