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

  it('plays every registered sound id, including the lowpass-filtered one', async () => {
    const start = vi.fn();
    class FakeAudioContext {
      state = 'running';
      currentTime = 0;
      createOscillator() {
        return { type: '', frequency: { value: 0 }, connect: vi.fn(), start, stop: vi.fn() };
      }
      createGain() {
        return {
          gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
        };
      }
      createBiquadFilter() {
        return { type: '', frequency: { value: 0 }, connect: vi.fn() };
      }
      destination = {};
    }
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const { playSound: freshPlaySound } = await freshModule();

    for (const id of ['ding', 'chime', 'two-tone-up', 'pluck', 'buzz', 'two-tone-down', 'thud']) {
      freshPlaySound(id);
    }

    // 'pluck' is the only sound with `lowpass` set, exercising the
    // BiquadFilter wiring branch inside playTones. Total tone count across
    // all 7 sounds: 1+2+2+1+3+2+1 = 12.
    expect(start).toHaveBeenCalledTimes(12);
  });

  it('reuses a cached AudioContext and resumes it when suspended', async () => {
    const resume = vi.fn().mockResolvedValue(undefined);
    let constructed = 0;
    class FakeAudioContext {
      state = 'suspended';
      currentTime = 0;
      constructor() {
        constructed += 1;
      }
      createOscillator() {
        return { type: '', frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
      }
      createGain() {
        return {
          gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
        };
      }
      resume = resume;
      destination = {};
    }
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const { playSound: freshPlaySound } = await freshModule();

    freshPlaySound(DEFAULT_SUCCESS_SOUND_ID);
    freshPlaySound(DEFAULT_SUCCESS_SOUND_ID);

    expect(constructed).toBe(1);
    expect(resume).toHaveBeenCalledTimes(2);
  });

  it('silently falls through when AudioContext construction throws', async () => {
    class ThrowingAudioContext {
      constructor() {
        throw new Error('denied');
      }
    }
    vi.stubGlobal('AudioContext', ThrowingAudioContext);
    const { playSound: freshPlaySound } = await freshModule();

    expect(() => freshPlaySound(DEFAULT_SUCCESS_SOUND_ID)).not.toThrow();
  });

  it('silently falls through when resume() rejects', async () => {
    class FakeAudioContext {
      state = 'suspended';
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
      resume = vi.fn().mockRejectedValue(new Error('nope'));
      destination = {};
    }
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const { playSound: freshPlaySound } = await freshModule();

    expect(() => freshPlaySound(DEFAULT_SUCCESS_SOUND_ID)).not.toThrow();
    await Promise.resolve();
  });

  it('no-ops silently when a sound player throws while wiring nodes', async () => {
    class FakeAudioContext {
      state = 'running';
      currentTime = 0;
      createOscillator(): never {
        throw new Error('node creation failed');
      }
      createGain() {
        return {};
      }
      destination = {};
    }
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const { playSound: freshPlaySound } = await freshModule();

    expect(() => freshPlaySound(DEFAULT_SUCCESS_SOUND_ID)).not.toThrow();
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

  it('returns "denied" when the permission prompt itself throws', async () => {
    const requestPermission = vi.fn().mockRejectedValue(new Error('dismissed'));
    vi.stubGlobal('Notification', { permission: 'default', requestPermission });
    await expect(requestNotificationPermission()).resolves.toBe('denied');
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

  function stubServiceWorker(value: unknown) {
    Object.defineProperty(navigator, 'serviceWorker', { value, configurable: true });
  }

  afterEach(() => {
    // @ts-expect-error test-only cleanup of a property we defined above
    delete navigator.serviceWorker;
  });

  it('shows via a registered service worker when available', async () => {
    const showNotification = vi.fn().mockResolvedValue(undefined);
    const registration = { showNotification };
    const register = vi.fn().mockResolvedValue(registration);
    vi.stubGlobal('Notification', { permission: 'granted' });
    stubServiceWorker({ register, ready: Promise.resolve(registration) });

    const result = await showCompletionNotification({
      status: 'succeeded',
      title: 'Done',
      body: 'ok',
      serviceWorkerUrl: '/sw.js',
    });

    expect(result).toBe('shown');
    expect(register).toHaveBeenCalledWith('/sw.js');
    expect(showNotification).toHaveBeenCalledWith('Done', expect.objectContaining({ tag: 'task-succeeded' }));
  });

  it('falls back to the registering registration when navigator.serviceWorker.ready rejects', async () => {
    const showNotification = vi.fn().mockResolvedValue(undefined);
    const registration = { showNotification };
    const register = vi.fn().mockResolvedValue(registration);
    vi.stubGlobal('Notification', { permission: 'granted' });
    stubServiceWorker({ register, ready: Promise.reject(new Error('never ready')) });

    const result = await showCompletionNotification({
      status: 'succeeded',
      title: 'Done',
      body: 'ok',
      serviceWorkerUrl: '/sw.js',
    });

    expect(result).toBe('shown');
    expect(showNotification).toHaveBeenCalled();
  });

  it('falls back to the constructor when the ready registration has no showNotification', async () => {
    const register = vi.fn().mockResolvedValue({});
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
    stubServiceWorker({ register, ready: Promise.resolve({}) });

    const result = await showCompletionNotification({
      status: 'succeeded',
      title: 'Done',
      body: 'ok',
      serviceWorkerUrl: '/sw.js',
    });

    expect(result).toBe('shown');
  });

  it('falls back to the constructor when service worker registration throws', async () => {
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
    stubServiceWorker({ register: vi.fn().mockRejectedValue(new Error('registration failed')) });

    const result = await showCompletionNotification({
      status: 'succeeded',
      title: 'Done',
      body: 'ok',
      serviceWorkerUrl: '/sw.js',
    });

    expect(result).toBe('shown');
  });

  it('returns failed when the Notification constructor itself throws', async () => {
    class ThrowingNotification {
      static permission = 'granted';
      constructor() {
        throw new Error('blocked');
      }
    }
    vi.stubGlobal('Notification', ThrowingNotification);

    const result = await showCompletionNotification({ status: 'failed', title: 't', body: 'b' });

    expect(result).toBe('failed');
  });

  it('wires onclick to focus the window, invoke onClick, and close the notification', async () => {
    const onClick = vi.fn();
    const close = vi.fn();
    let created: FakeNotification | undefined;
    class FakeNotification {
      static permission = 'granted';
      onclick: (() => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(
        public title: string,
        public options?: NotificationOptions,
      ) {
        created = this;
      }
      close = close;
    }
    vi.stubGlobal('Notification', FakeNotification);
    const focusSpy = vi.spyOn(window, 'focus').mockImplementation(() => undefined);

    await showCompletionNotification({ status: 'succeeded', title: 'Done', body: 'ok', onClick });

    expect(created?.onclick).toBeTypeOf('function');
    created?.onclick?.();

    expect(focusSpy).toHaveBeenCalled();
    expect(onClick).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();

    focusSpy.mockRestore();
  });

  it('onclick tolerates window.focus() and note.close() throwing, and onclose releases handlers', async () => {
    let created: FakeNotification | undefined;
    class FakeNotification {
      static permission = 'granted';
      onclick: (() => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(
        public title: string,
        public options?: NotificationOptions,
      ) {
        created = this;
      }
      close() {
        throw new Error('already closed');
      }
    }
    vi.stubGlobal('Notification', FakeNotification);
    const focusSpy = vi.spyOn(window, 'focus').mockImplementation(() => {
      throw new Error('focus blocked');
    });

    await showCompletionNotification({ status: 'succeeded', title: 'Done', body: 'ok' });

    expect(() => created?.onclick?.()).not.toThrow();

    expect(created?.onclose).toBeTypeOf('function');
    created?.onclose?.();
    expect(created?.onclick).toBeNull();
    expect(created?.onclose).toBeNull();
    expect(created?.onerror).toBeNull();

    focusSpy.mockRestore();
  });

  it('onerror also releases the notification handlers', async () => {
    let created: FakeNotification | undefined;
    class FakeNotification {
      static permission = 'granted';
      onclick: (() => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(
        public title: string,
        public options?: NotificationOptions,
      ) {
        created = this;
      }
      close() {
        /* no-op */
      }
    }
    vi.stubGlobal('Notification', FakeNotification);

    await showCompletionNotification({ status: 'failed', title: 'Oops', body: 'bad' });

    expect(created?.onerror).toBeTypeOf('function');
    created?.onerror?.();
    expect(created?.onclick).toBeNull();
  });
});
