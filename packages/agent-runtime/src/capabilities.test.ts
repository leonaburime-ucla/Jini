import { describe, expect, it } from 'vitest';
import { agentCapabilities } from './capabilities.js';

describe('agentCapabilities', () => {
  it('is a shared, mutable Map keyed by agent id', () => {
    expect(agentCapabilities).toBeInstanceOf(Map);
    agentCapabilities.set('test-agent', { supportsImages: true });
    expect(agentCapabilities.get('test-agent')).toEqual({ supportsImages: true });
    agentCapabilities.delete('test-agent');
  });
});
