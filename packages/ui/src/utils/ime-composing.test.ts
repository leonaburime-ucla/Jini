import { describe, expect, it } from 'vitest';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { isImeComposing } from './ime-composing.js';

describe('isImeComposing', () => {
  const fakeEvent = {} as ReactKeyboardEvent<HTMLInputElement>;

  it('trusts the composing ref over the event when true', () => {
    expect(isImeComposing(fakeEvent, true)).toBe(true);
  });

  it('trusts the composing ref over the event when false', () => {
    expect(isImeComposing(fakeEvent, false)).toBe(false);
  });
});
