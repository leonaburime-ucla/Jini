// @vitest-environment node
//
// `isVisualStabilityMode`'s `typeof window === 'undefined'` guard is
// genuinely unreachable under jsdom (this package's default environment,
// where `window` always exists). This file runs under Node's real
// environment to exercise it for real.
import { describe, expect, it } from 'vitest';
import { isVisualStabilityMode } from './visual-stability.js';

describe('isVisualStabilityMode (SSR)', () => {
  it('returns false when window is undefined', () => {
    expect(typeof window).toBe('undefined');
    expect(isVisualStabilityMode()).toBe(false);
  });
});
