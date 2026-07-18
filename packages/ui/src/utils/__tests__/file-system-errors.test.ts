import { describe, expect, it } from 'vitest';
import { createFileSystemReadError, isFileSystemReadError } from '../file-system-errors.js';

describe('createFileSystemReadError / isFileSystemReadError', () => {
  it('wraps an Error cause with the action prefix and a FileSystemReadError name', () => {
    const cause = new Error('permission denied');
    const wrapped = createFileSystemReadError('reading dropped folder', cause);

    expect(wrapped.name).toBe('FileSystemReadError');
    expect(wrapped.message).toBe('reading dropped folder: Error: permission denied');
    expect(wrapped.cause).toBe(cause);
  });

  it('summarizes a non-Error cause (string) safely', () => {
    const wrapped = createFileSystemReadError('reading file', 'boom');
    expect(wrapped.message).toBe('reading file: boom');
  });

  it('summarizes a plain object with name/message fields', () => {
    const wrapped = createFileSystemReadError('reading file', { name: 'AbortError', message: 'cancelled' });
    expect(wrapped.message).toBe('reading file: AbortError: cancelled');
  });

  it('falls back to a generic "Error" name for an object without one', () => {
    const wrapped = createFileSystemReadError('reading file', { message: 'oops' });
    expect(wrapped.message).toBe('reading file: Error: oops');
  });

  it('isFileSystemReadError distinguishes wrapped errors from ordinary ones', () => {
    const wrapped = createFileSystemReadError('reading file', new Error('x'));
    expect(isFileSystemReadError(wrapped)).toBe(true);
    expect(isFileSystemReadError(new Error('plain'))).toBe(false);
    expect(isFileSystemReadError('not an error')).toBe(false);
    expect(isFileSystemReadError(null)).toBe(false);
  });
});
