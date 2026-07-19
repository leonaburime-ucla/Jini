import { describe, expect, it } from 'vitest';
import { deriveRunErrorCode, runResultFromStatus } from './result.js';

describe('runResultFromStatus', () => {
  it('maps succeeded/canceled to success/cancelled and everything else to failed', () => {
    expect(runResultFromStatus('succeeded')).toBe('success');
    expect(runResultFromStatus('canceled')).toBe('cancelled');
    expect(runResultFromStatus('failed')).toBe('failed');
    expect(runResultFromStatus('anything-else')).toBe('failed');
    expect(runResultFromStatus(undefined)).toBe('failed');
  });
});

describe('deriveRunErrorCode', () => {
  it('returns undefined for a successful run', () => {
    expect(deriveRunErrorCode({ status: 'succeeded', errorCode: 'IGNORED' })).toBeUndefined();
  });

  it('forwards only an explicit error code for a cancelled run', () => {
    expect(deriveRunErrorCode({ status: 'canceled', errorCode: 'CANCEL_DURING_RECOVERY' })).toBe(
      'CANCEL_DURING_RECOVERY',
    );
    expect(deriveRunErrorCode({ status: 'canceled' })).toBeUndefined();
    expect(deriveRunErrorCode({ status: 'canceled', errorCode: null })).toBeUndefined();
  });

  it('prefers the structured error code stamped on a failed run', () => {
    expect(
      deriveRunErrorCode({ status: 'failed', errorCode: 'RATE_LIMITED', signal: 'SIGKILL', exitCode: 1 }),
    ).toBe('RATE_LIMITED');
  });

  it('derives AGENT_SIGNAL_* when a failed run carries only a signal', () => {
    expect(deriveRunErrorCode({ status: 'failed', signal: 'SIGKILL' })).toBe('AGENT_SIGNAL_SIGKILL');
  });

  it('derives AGENT_EXIT_* when a failed run carries only a non-zero exit code', () => {
    expect(deriveRunErrorCode({ status: 'failed', exitCode: 137 })).toBe('AGENT_EXIT_137');
  });

  it('falls back to AGENT_TERMINATED_UNKNOWN for a zero exit or no signal at all', () => {
    expect(deriveRunErrorCode({ status: 'failed', exitCode: 0 })).toBe('AGENT_TERMINATED_UNKNOWN');
    expect(deriveRunErrorCode({ status: 'failed' })).toBe('AGENT_TERMINATED_UNKNOWN');
    expect(deriveRunErrorCode({ status: 'failed', errorCode: null, exitCode: null, signal: null })).toBe(
      'AGENT_TERMINATED_UNKNOWN',
    );
  });
});
