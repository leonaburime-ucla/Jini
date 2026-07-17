// @vitest-environment node
//
// getCtx()'s `typeof window === 'undefined'` guard and
// notificationOptionsFor()'s `typeof window === 'undefined' ? '/' : ...`
// ternary are SSR-only paths — genuinely unreachable under jsdom (this
// package's default environment, where `window` always exists). This file
// runs under Node's real environment to exercise them for real.
import { describe, expect, it, vi } from 'vitest';

describe('notifications SSR guards', () => {
  it('playSound no-ops when window is undefined', async () => {
    expect(typeof window).toBe('undefined');
    const { playSound } = await import('./notifications.js');
    expect(() => playSound('ding')).not.toThrow();
  });

  it('showCompletionNotification defaults the notification data url to "/" when window is undefined', async () => {
    expect(typeof window).toBe('undefined');
    let lastOptions: NotificationOptions | undefined;
    class FakeNotification {
      static permission = 'granted';
      onclick: (() => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(
        public title: string,
        options?: NotificationOptions,
      ) {
        lastOptions = options;
      }
      close() {
        /* no-op */
      }
    }
    vi.stubGlobal('Notification', FakeNotification);

    const { showCompletionNotification } = await import('./notifications.js');
    const result = await showCompletionNotification({ status: 'succeeded', title: 't', body: 'b' });

    expect(result).toBe('shown');
    expect((lastOptions?.data as { url: string }).url).toBe('/');

    vi.unstubAllGlobals();
  });
});
