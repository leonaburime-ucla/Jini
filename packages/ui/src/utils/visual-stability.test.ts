import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_VISUAL_STABILITY_STORAGE_KEY, isVisualStabilityMode } from './visual-stability.js';

describe('isVisualStabilityMode', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns false when the flag is unset', () => {
    expect(isVisualStabilityMode()).toBe(false);
  });

  it('returns true when the default key is set to "1"', () => {
    window.localStorage.setItem(DEFAULT_VISUAL_STABILITY_STORAGE_KEY, '1');
    expect(isVisualStabilityMode()).toBe(true);
  });

  it('returns false for any value other than exactly "1"', () => {
    window.localStorage.setItem(DEFAULT_VISUAL_STABILITY_STORAGE_KEY, 'true');
    expect(isVisualStabilityMode()).toBe(false);
  });

  it('honors a custom storage key', () => {
    window.localStorage.setItem('host:custom-key', '1');
    expect(isVisualStabilityMode('host:custom-key')).toBe(true);
    expect(isVisualStabilityMode()).toBe(false);
  });

  it('returns false rather than throwing when localStorage access throws', () => {
    // Replacing the whole `localStorage` object (rather than monkey-patching
    // `getItem` on jsdom's native Storage instance) is required here: v8's
    // coverage instrumentation fails to attribute the catch block's hits
    // back to this file when the throw originates from a patched method on
    // jsdom's built-in Storage object, even though the behavior itself
    // (catching and returning false) is identical either way.
    const original = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: () => {
          throw new Error('access denied');
        },
      },
      configurable: true,
    });
    try {
      expect(isVisualStabilityMode()).toBe(false);
    } finally {
      Object.defineProperty(window, 'localStorage', { value: original, configurable: true });
    }
  });
});
