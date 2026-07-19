import { describe, expect, it } from 'vitest';
import * as acpBarrel from '../index.js';

describe('acp/index barrel', () => {
  it('re-exports the ACP public surface', () => {
    expect(typeof acpBarrel.buildAcpSessionNewParams).toBe('function');
    expect(typeof acpBarrel.normalizeModels).toBe('function');
    expect(typeof acpBarrel.detectAcpModels).toBe('function');
    expect(typeof acpBarrel.attachAcpSession).toBe('function');
    expect(typeof acpBarrel.noopAccountFailureClassifier.classify).toBe('function');
  });
});
