import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_FAILURE_SOUND_ID,
  DEFAULT_SUCCESS_SOUND_ID,
  notificationPermission,
  playSound,
  previewFailure,
  previewSuccess,
  requestNotificationPermission,
  showCompletionNotification,
} from './notifications.js';

// notifications.ts caches its AudioContext at module scope (the origin's
// own singleton reuse pattern). Each of the following cases stubs a
// differently-shaped fake AudioContext, so each gets a fresh module
// instance via resetModules — otherwise a later test would silently reuse
// an earlier test's cached instance.
async function freshModule() {
  vi.resetModules();
  return import('./notifications.js');
}

describe('playSound / previewSuccess / previewFailure', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('no-ops without throwing when no AudioContext is available (jsdom default)', () => {
    expect(() => playSound(DEFAULT_SUCCESS_SOUND_ID)).not.toThrow();
    expect(() => previewSuccess(DEFAULT_SUCCESS_SOUND_ID)).not.toThrow();
    expect(() => previewFailure(DEFAULT_FAILURE_SOUND_ID)).not.toThrow();
  });

  it('no-ops for an unknown sound id even with an AudioContext available', async () => {
    class FakeAudioContext {
      state = 'running';
      currentTime = 0;
      createOscillator() {
        return { type: '', frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
      }
      createGain() {
        return {
          gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
        };
      }
      destination = {};
    }
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const { playSound: freshPlaySound } = await freshModule();
    expect(() => freshPlaySound('not-a-real-sound')).not.toThrow();
  });

  it('drives oscillator + gain node wiring for a known sound id without throwing', async () => {
    const connect = vi.fn();
    const start = vi.fn();
    const stop = vi.fn();
    class FakeAudioContext {
      state = 'running';
      currentTime = 0;
      createOscillator() {
        return { type: '', frequency: { value: 0 }, connect, start, stop };
      }
      createGain() {
        return {
          gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect,
        };
      }
      destination = {};
    }
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const { playSound: freshPlaySound } = await freshModule();

    freshPlaySound(DEFAULT_SUCCESS_SOUND_ID);

    expect(start).toHaveBeenCalled();
    expect(stop).toHaveBeenCalled();
  });
});

describe('notificationPermission / requestNotificationPermission', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports unsupported when the Notification API is absent (jsdom default)', async () => {
    expect(notificationPermission()).toBe('unsupported');
    await expect(requestNotificationPermission()).resolves.toBe('unsupported');
  });

  it('returns the current permission without prompting when already decided', async () => {
    vi.stubGlobal('Notification', { permission: 'granted', requestPermission: vi.fn() });
    expect(notificationPermission()).toBe('granted');
    await expect(requestNotificationPermission()).resolves.toBe('granted');
    expect((globalThis as { Notification: { requestPermission: () => void } }).Notification.requestPermission).not.toHaveBeenCalled();
  });

  it('prompts when permission is still "default"', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted');
    vi.stubGlobal('Notification', { permission: 'default', requestPermission });
    await expect(requestNotificationPermission()).resolves.toBe('granted');
    expect(requestPermission).toHaveBeenCalled();
  });
});

describe('showCompletionNotification', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns unsupported without a Notification global', async () => {
    const result = await showCompletionNotification({ status: 'succeeded', title: 't', body: 'b' });
    expect(result).toBe('unsupported');
  });

  it('returns permission-denied when permission is not granted', async () => {
    vi.stubGlobal('Notification', { permission: 'denied' });
    const result = await showCompletionNotification({ status: 'failed', title: 't', body: 'b' });
    expect(result).toBe('permission-denied');
  });

  it('shows via the Notification constructor with the default tag prefix', async () => {
    let lastTitle: string | undefined;
    let lastOptions: NotificationOptions | undefined;
    class FakeNotification {
      static permission = 'granted';
      onclick: (() => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(title: string, options?: NotificationOptions) {
        lastTitle = title;
        lastOptions = options;
      }
      close() {
        /* no-op */
      }
    }
    vi.stubGlobal('Notification', FakeNotification);

    const result = await showCompletionNotification({ status: 'succeeded', title: 'Done', body: 'All good' });

    expect(result).toBe('shown');
    expect(lastTitle).toBe('Done');
    expect(lastOptions?.tag).toBe('task-succeeded');
  });

  it('honors a custom tagPrefix', async () => {
    let lastOptions: NotificationOptions | undefined;
    class FakeNotification {
      static permission = 'granted';
      onclick: (() => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(_title: string, options?: NotificationOptions) {
        lastOptions = options;
      }
      close() {
        /* no-op */
      }
    }
    vi.stubGlobal('Notification', FakeNotification);

    await showCompletionNotification({
      status: 'failed',
      title: 'Failed',
      body: 'oops',
      tagPrefix: 'my-app',
    });

    expect(lastOptions?.tag).toBe('my-app-failed');
  });

  it('falls back to the constructor when the service worker path is unavailable', async () => {
    class FakeNotification {
      static permission = 'granted';
      onclick: (() => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(
        public title: string,
        public options?: NotificationOptions,
      ) {}
      close() {
        /* no-op */
      }
    }
    vi.stubGlobal('Notification', FakeNotification);

    const result = await showCompletionNotification({
      status: 'succeeded',
      title: 'Done',
      body: 'ok',
      serviceWorkerUrl: '/sw.js',
    });

    // jsdom's `navigator.serviceWorker` is undefined, so the SW path
    // returns null and falls through to the constructor path.
    expect(result).toBe('shown');
  });
});
