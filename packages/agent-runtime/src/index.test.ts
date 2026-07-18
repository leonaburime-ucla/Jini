import { describe, expect, it } from 'vitest';
import * as pkgBarrel from './index.js';

describe('@jini/agent-runtime root barrel', () => {
  it('re-exports the agent-protocol public surface', () => {
    expect(typeof pkgBarrel.createJsonLineStream).toBe('function');
    expect(typeof pkgBarrel.attachAcpSession).toBe('function');
    expect(typeof pkgBarrel.attachPiRpcSession).toBe('function');
    expect(typeof pkgBarrel.parsePiModels).toBe('function');
    expect(typeof pkgBarrel.noopAccountFailureClassifier).toBe('object');
  });
});
