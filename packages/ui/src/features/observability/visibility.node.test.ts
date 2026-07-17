// @vitest-environment node
//
// Companion to visibility.test.ts: exercises the SSR guard
// (`typeof document === 'undefined'`) for real, in an environment with no
// DOM globals at all — a separate file because the environment pragma
// applies to the whole file, not a single describe/it block.
import { describe, expect, it } from 'vitest';
import { installVisibilityObserver } from './visibility.js';

describe('installVisibilityObserver (no document)', () => {
  it('returns an inert teardown when document is unavailable', () => {
    expect(typeof document).toBe('undefined');
    const teardown = installVisibilityObserver();

    expect(() => teardown()).not.toThrow();
  });
});
