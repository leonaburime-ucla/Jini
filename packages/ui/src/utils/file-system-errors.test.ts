import { describe, expect, it } from 'vitest';
import { createFileSystemReadError, isFileSystemReadError } from './file-system-errors.js';

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

  it('falls back to the stringified error when an Error has an empty message', () => {
    const cause = new Error();
    cause.name = 'CustomError';
    const wrapped = createFileSystemReadError('reading file', cause);
    // Error.prototype.toString() on a name-only Error returns just the name.
    expect(wrapped.message).toBe('reading file: CustomError: CustomError');
  });

  it('falls back to the generic "Error" name when an Error has an empty name', () => {
    const cause = new Error('boom');
    cause.name = '';
    const wrapped = createFileSystemReadError('reading file', cause);
    expect(wrapped.message).toBe('reading file: Error: boom');
  });

  it('summarizes a non-string message on a plain object via String(error)', () => {
    const wrapped = createFileSystemReadError('reading file', { message: 404 });
    expect(wrapped.message).toBe('reading file: Error: [object Object]');
  });

  it('summarizes a nullish, non-object cause via String(error)', () => {
    const wrapped = createFileSystemReadError('reading file', null);
    expect(wrapped.message).toBe('reading file: null');
  });

  it('isFileSystemReadError distinguishes wrapped errors from ordinary ones', () => {
    const wrapped = createFileSystemReadError('reading file', new Error('x'));
    expect(isFileSystemReadError(wrapped)).toBe(true);
    expect(isFileSystemReadError(new Error('plain'))).toBe(false);
    expect(isFileSystemReadError('not an error')).toBe(false);
    expect(isFileSystemReadError(null)).toBe(false);
  });
});
