import { describe, expect, it, vi } from 'vitest';
import { createBrowserTabStripHaptics } from './dependencies.js';

describe('createBrowserTabStripHaptics', () => {
  it('delegates to navigator.vibrate when available', () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });
    createBrowserTabStripHaptics().pulse(8);
    expect(vibrate).toHaveBeenCalledWith(8);
    vi.unstubAllGlobals();
  });

  it('is a silent no-op when navigator.vibrate is unavailable', () => {
    vi.stubGlobal('navigator', {});
    expect(() => createBrowserTabStripHaptics().pulse(8)).not.toThrow();
    vi.unstubAllGlobals();
  });

  it('is a silent no-op when navigator itself is undefined', () => {
    vi.stubGlobal('navigator', undefined);
    expect(() => createBrowserTabStripHaptics().pulse(8)).not.toThrow();
    vi.unstubAllGlobals();
  });

  it('swallows a navigator.vibrate throw', () => {
    vi.stubGlobal('navigator', {
      vibrate: () => {
        throw new Error('vibrate unsupported');
      },
    });
    expect(() => createBrowserTabStripHaptics().pulse(8)).not.toThrow();
    vi.unstubAllGlobals();
  });
});
