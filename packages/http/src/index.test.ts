import { describe, expect, it } from 'vitest';
import * as barrel from './index.js';

describe('@jini/http barrel', () => {
  it('re-exports the request/response/origin/adapter/pack/local-daemon public surfaces', () => {
    expect(typeof barrel.ok).toBe('function');
    expect(typeof barrel.err).toBe('function');
    expect(typeof barrel.rawInput).toBe('function');
    expect(typeof barrel.validationError).toBe('function');
    expect(typeof barrel.sendJson).toBe('function');
    expect(typeof barrel.sendApiError).toBe('function');
    expect(typeof barrel.statusForError).toBe('function');
    expect(typeof barrel.guardSameOrigin).toBe('function');
    expect(typeof barrel.defineJsonRoute).toBe('function');
    expect(typeof barrel.mountJsonRoute).toBe('function');
    expect(typeof barrel.mountPackHttp).toBe('function');
    expect(typeof barrel.createCompatApiError).toBe('function');
    expect(typeof barrel.createCompatApiErrorResponse).toBe('function');
    expect(typeof barrel.sendCompatApiError).toBe('function');
    expect(typeof barrel.requireLocalDaemonRequest).toBe('function');
    expect(typeof barrel.validateLocalDaemonRequest).toBe('function');
    expect(typeof barrel.normalizeLocalAuthority).toBe('function');
    expect(typeof barrel.isLoopbackHostname).toBe('function');
    expect(typeof barrel.isLoopbackPeerAddress).toBe('function');
    expect(typeof barrel.localOriginFromHeader).toBe('function');
  });
});
