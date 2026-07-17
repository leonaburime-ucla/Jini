// @vitest-environment node
//
// Companion to boot-timing.test.ts: exercises the SSR guard
// (`typeof window === 'undefined'`) for real, in an environment with no
// DOM globals at all — a separate file because the environment pragma
// applies to the whole file, not a single describe/it block.
import { describe, expect, it } from 'vitest';
import { installBootTimingObserver } from './boot-timing.js';

describe('installBootTimingObserver (no window)', () => {
  it('returns an inert teardown when window is unavailable', () => {
    expect(typeof window).toBe('undefined');
    const teardown = installBootTimingObserver();

    expect(() => teardown()).not.toThrow();
  });
});
