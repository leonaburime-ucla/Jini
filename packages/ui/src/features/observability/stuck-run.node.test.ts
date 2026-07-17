// @vitest-environment node
//
// Companion to stuck-run.test.ts: exercises the SSR guard
// (`typeof window === 'undefined'`) for real, in an environment with no DOM
// globals at all — a separate file because the environment pragma applies
// to the whole file, not a single describe/it block.
import { describe, expect, it } from 'vitest';
import { trackRunStart } from './stuck-run.js';

describe('trackRunStart (no window)', () => {
  it('is a no-op when window is unavailable', () => {
    expect(typeof window).toBe('undefined');
    expect(() => trackRunStart('run-ssr')).not.toThrow();
  });
});
