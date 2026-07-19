import { describe, expect, it } from 'vitest';
import * as coreBarrel from '../index.js';

describe('core/index barrel', () => {
  it('re-exports createJsonLineStream', () => {
    expect(typeof coreBarrel.createJsonLineStream).toBe('function');
  });
});
