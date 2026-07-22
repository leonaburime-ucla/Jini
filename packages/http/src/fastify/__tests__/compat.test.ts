import { describe, expect, it, vi } from 'vitest';
import { createCompatApiError, createCompatApiErrorResponse, sendApiError } from '../compat.js';

function makeReply() {
  return {
    code: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
}

describe('createCompatApiError', () => {
  it('builds an ApiError from code + message with no extra init', () => {
    expect(createCompatApiError('NOT_FOUND', 'run not found')).toEqual({
      code: 'NOT_FOUND',
      message: 'run not found',
    });
  });

  it('merges an explicit init object onto the error', () => {
    expect(
      createCompatApiError('VALIDATION_FAILED', 'bad input', {
        details: { kind: 'validation', issues: [] } as any,
      }),
    ).toEqual({
      code: 'VALIDATION_FAILED',
      message: 'bad input',
      details: { kind: 'validation', issues: [] },
    });
  });
});

describe('createCompatApiErrorResponse', () => {
  it('wraps the built error in the standard { error } envelope', () => {
    expect(createCompatApiErrorResponse('BAD_REQUEST', 'nope')).toEqual({
      error: { code: 'BAD_REQUEST', message: 'nope' },
    });
  });
});

describe('sendApiError (compat, separate-arguments call shape)', () => {
  it('writes the status and the wrapped error built from separate arguments', () => {
    const reply = makeReply();
    sendApiError(reply as any, 404, 'NOT_FOUND', 'run not found');
    expect(reply.code).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({
      error: { code: 'NOT_FOUND', message: 'run not found' },
    });
  });

  it('passes an explicit init object through to the sent error', () => {
    const reply = makeReply();
    sendApiError(reply as any, 422, 'VALIDATION_FAILED', 'bad input', {
      details: { kind: 'validation', issues: [{ path: 'name', message: 'required' }] } as any,
    });
    expect(reply.send).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'bad input',
        details: { kind: 'validation', issues: [{ path: 'name', message: 'required' }] },
      },
    });
  });

  it('returns the reply so callers can chain, matching FastifyReply.send()\'s own return shape', () => {
    const reply = makeReply();
    const returned = sendApiError(reply as any, 404, 'NOT_FOUND', 'gone');
    expect(returned).toBe(reply);
  });
});
