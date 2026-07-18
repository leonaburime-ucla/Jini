import { describe, expect, it } from 'vitest';
import { isRecord, errorMessage, errorCode, getRecord } from './internal.js';

describe('isRecord', () => {
  it('returns true for plain objects and arrays', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(true);
  });
  it('returns false for null and primitives', () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord('x')).toBe(false);
    expect(isRecord(42)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
  });
});

describe('errorMessage', () => {
  it('returns the message of an Error instance', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
  });
  it('stringifies non-Error values', () => {
    expect(errorMessage('plain')).toBe('plain');
    expect(errorMessage(7)).toBe('7');
  });
});

describe('errorCode', () => {
  it('extracts a string code field', () => {
    expect(errorCode({ code: 'EPIPE' })).toBe('EPIPE');
  });
  it('returns undefined when code is missing, not a string, or value is not a record', () => {
    expect(errorCode({})).toBeUndefined();
    expect(errorCode({ code: 42 })).toBeUndefined();
    expect(errorCode('not a record')).toBeUndefined();
    expect(errorCode(null)).toBeUndefined();
  });
});

describe('getRecord', () => {
  it('returns the value when it is a record', () => {
    const v = { a: 1 };
    expect(getRecord(v)).toBe(v);
  });
  it('returns undefined otherwise', () => {
    expect(getRecord(null)).toBeUndefined();
    expect(getRecord('x')).toBeUndefined();
  });
});
