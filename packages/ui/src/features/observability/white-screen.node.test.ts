// @vitest-environment node
//
// Companion to white-screen.test.ts: exercises the SSR guard
// (`typeof window === 'undefined'`) for real, in an environment with no DOM
// globals at all — a separate file because the environment pragma applies
// to the whole file, not a single describe/it block.
import { describe, expect, it } from 'vitest';
import { installWhiteScreenDetector } from './white-screen.js';

describe('installWhiteScreenDetector (no window)', () => {
  it('returns an inert teardown when window is unavailable', () => {
    expect(typeof window).toBe('undefined');
    const teardown = installWhiteScreenDetector();

    expect(() => teardown()).not.toThrow();
  });
});
