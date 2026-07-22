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
} from '../notifications.js';

async function freshModule() {
  vi.resetModules();
  return import('../notifications.js');
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

  it('handles webkitAudioContext legacy fallback and suspended AudioContext state', async () => {
    const resume = vi.fn().mockResolvedValue(undefined);
    class FakeWebkitAudioContext {
      state = 'suspended';
      currentTime = 0;
      resume = resume;
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
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', FakeWebkitAudioContext);
    const { playSound: freshPlaySound } = await freshModule();

    expect(() => freshPlaySound('ding')).not.toThrow();
    expect(resume).toHaveBeenCalled();
  });

  it('handles AudioContext constructor throwing or resume rejecting gracefully', async () => {
    class ThrowingAudioContext {
      constructor() {
        throw new Error('AudioContext blocked');
      }
    }
    vi.stubGlobal('AudioContext', ThrowingAudioContext);
    const { playSound: freshPlaySound } = await freshModule();
    expect(() => freshPlaySound('ding')).not.toThrow();

    class RejectingResumeAudioContext {
      state = 'suspended';
      currentTime = 0;
      resume() {
        return Promise.reject(new Error('Autoplay policy blocked'));
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
      destination = {};
    }
    vi.stubGlobal('AudioContext', RejectingResumeAudioContext);
    const { playSound: freshPlaySound2 } = await freshModule();
    expect(() => freshPlaySound2('ding')).not.toThrow();
  });

  it('handles node creation/connection errors gracefully inside playSound', async () => {
    class FailingNodeAudioContext {
      state = 'running';
      currentTime = 0;
      createOscillator() {
        throw new Error('Node limit reached');
      }
      destination = {};
    }
    vi.stubGlobal('AudioContext', FailingNodeAudioContext);
    const { playSound: freshPlaySound } = await freshModule();

    expect(() => freshPlaySound('ding')).not.toThrow();
  });

  it('drives lowpass biquad filter for pluck and square wave sounds', async () => {
    const createBiquadFilter = vi.fn().mockReturnValue({
      type: '',
      frequency: { value: 0 },
      connect: vi.fn(),
    });
    class FilteringAudioContext {
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
      createBiquadFilter = createBiquadFilter;
      destination = {};
    }
    vi.stubGlobal('AudioContext', FilteringAudioContext);
    const { playSound: freshPlaySound } = await freshModule();

    freshPlaySound('pluck');
    expect(createBiquadFilter).toHaveBeenCalled();
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

    freshPlaySound('chime');
    freshPlaySound('two-tone-up');
    freshPlaySound('buzz');
    freshPlaySound('two-tone-down');
    freshPlaySound('thud');
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

  it('handles requestPermission throwing gracefully', async () => {
    const requestPermission = vi.fn().mockRejectedValue(new Error('Permission denied'));
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

  it('triggers notification callbacks (onclick, onclose, onerror) and window.focus', async () => {
    const onClickSpy = vi.fn();
    const focusSpy = vi.fn();
    vi.stubGlobal('focus', focusSpy);

    class EventfulNotification {
      static permission = 'granted';
      onclick: (() => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public title: string, public options?: NotificationOptions) {
        setTimeout(() => {
          this.onclick?.();
          this.onclose?.();
          this.onerror?.();
        }, 0);
      }
      close() {}
    }
    vi.stubGlobal('Notification', EventfulNotification);

    const result = await showCompletionNotification({
      status: 'succeeded',
      title: 'Done',
      body: 'All good',
      onClick: onClickSpy,
    });

    expect(result).toBe('shown');
    await new Promise((r) => setTimeout(r, 20));
    expect(onClickSpy).toHaveBeenCalled();
    expect(focusSpy).toHaveBeenCalled();
  });

  it('handles Notification constructor throwing gracefully', async () => {
    class ThrowingNotification {
      static permission = 'granted';
      constructor() {
        throw new Error('Notification creation failed');
      }
    }
    vi.stubGlobal('Notification', ThrowingNotification);

    const result = await showCompletionNotification({ status: 'succeeded', title: 'Done', body: 'All good' });
    expect(result).toBe('failed');
  });

  it('shows notification via Service Worker path when available', async () => {
    const showNotification = vi.fn().mockResolvedValue(undefined);
    const mockRegistration = { showNotification };
    const mockServiceWorker = {
      register: vi.fn().mockResolvedValue(mockRegistration),
      ready: Promise.resolve(mockRegistration),
    };
    vi.stubGlobal('Notification', { permission: 'granted' });
    vi.stubGlobal('navigator', { serviceWorker: mockServiceWorker });

    const result = await showCompletionNotification({
      status: 'succeeded',
      title: 'Done via SW',
      body: 'Service worker notification',
      serviceWorkerUrl: '/sw.js',
    });

    expect(result).toBe('shown');
    expect(showNotification).toHaveBeenCalledWith('Done via SW', expect.objectContaining({
      body: 'Service worker notification',
      tag: 'task-succeeded',
    }));
  });

  it('falls back to constructor if Service Worker registration fails', async () => {
    class FallbackNotification {
      static permission = 'granted';
      onclick: (() => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public title: string) {}
      close() {}
    }
    const mockServiceWorker = {
      register: vi.fn().mockRejectedValue(new Error('SW failed')),
    };
    vi.stubGlobal('Notification', FallbackNotification);
    vi.stubGlobal('navigator', { serviceWorker: mockServiceWorker });

    const result = await showCompletionNotification({
      status: 'succeeded',
      title: 'Fallback',
      body: 'SW failed fallback',
      serviceWorkerUrl: '/sw.js',
    });

    expect(result).toBe('shown');
  });
});
