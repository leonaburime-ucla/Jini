import { describe, expect, it } from 'vitest';
import * as agentProtocolBarrel from '../index.js';

describe('agent-protocol/index root barrel', () => {
  it('re-exports the full public surface (13 names)', () => {
    expect(typeof agentProtocolBarrel.createJsonLineStream).toBe('function');
    expect(typeof agentProtocolBarrel.buildAcpSessionNewParams).toBe('function');
    expect(typeof agentProtocolBarrel.normalizeModels).toBe('function');
    expect(typeof agentProtocolBarrel.detectAcpModels).toBe('function');
    expect(typeof agentProtocolBarrel.attachAcpSession).toBe('function');
    expect(typeof agentProtocolBarrel.noopAccountFailureClassifier).toBe('object');
    expect(typeof agentProtocolBarrel.mapPiRpcEvent).toBe('function');
    expect(typeof agentProtocolBarrel.attachPiRpcSession).toBe('function');
    expect(typeof agentProtocolBarrel.parsePiModels).toBe('function');
  });
});
