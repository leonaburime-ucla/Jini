import { describe, expect, it } from 'vitest';
import * as piRpcBarrel from '../index.js';

describe('pi-rpc/index barrel', () => {
  it('re-exports mapPiRpcEvent, attachPiRpcSession, and parsePiModels', () => {
    expect(typeof piRpcBarrel.mapPiRpcEvent).toBe('function');
    expect(typeof piRpcBarrel.attachPiRpcSession).toBe('function');
    expect(typeof piRpcBarrel.parsePiModels).toBe('function');
  });
});
