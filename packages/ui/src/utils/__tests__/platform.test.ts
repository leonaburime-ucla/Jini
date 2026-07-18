import { afterEach, describe, expect, it, vi } from 'vitest';
import { isMacPlatform } from '../platform.js';

describe('isMacPlatform', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true for a Mac platform string', () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    expect(isMacPlatform()).toBe(true);
  });

  it('returns true for iOS device platform strings', () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('iPhone');
    expect(isMacPlatform()).toBe(true);
  });

  it('returns false for a non-Apple platform string', () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('Win32');
    expect(isMacPlatform()).toBe(false);
  });
});
