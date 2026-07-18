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
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('access denied');
    });
    expect(isVisualStabilityMode()).toBe(false);
  });
});
