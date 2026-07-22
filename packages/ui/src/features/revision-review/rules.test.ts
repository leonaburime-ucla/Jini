import { describe, expect, it } from 'vitest';
import { diffAddedLines, formatRevisionTimestamp } from './rules.js';

describe('diffAddedLines', () => {
  it('returns everything after the common prefix', () => {
    expect(diffAddedLines('a\nb\nc', 'a\nb\nd\ne')).toBe('d\ne');
  });

  it('returns an empty string when the texts are identical', () => {
    expect(diffAddedLines('a\nb', 'a\nb')).toBe('');
  });

  it('returns the whole proposed text when nothing is shared', () => {
    expect(diffAddedLines('x', 'a\nb')).toBe('a\nb');
  });

  it('returns an empty string when the proposed text is a strict prefix truncation of the base', () => {
    expect(diffAddedLines('a\nb\nc', 'a\nb')).toBe('');
  });

  it('handles CRLF line endings the same as LF', () => {
    expect(diffAddedLines('a\r\nb', 'a\r\nb\r\nc')).toBe('c');
  });

  it('handles empty inputs', () => {
    expect(diffAddedLines('', '')).toBe('');
    expect(diffAddedLines('', 'a')).toBe('a');
  });
});

describe('formatRevisionTimestamp', () => {
  it('formats a valid ISO timestamp', () => {
    const formatted = formatRevisionTimestamp('2026-03-01T10:30:00.000Z');
    expect(formatted).toMatch(/\w+ \d+,? \d{1,2}:\d{2}/);
  });

  it('returns the raw value unchanged when it does not parse as a date', () => {
    expect(formatRevisionTimestamp('not-a-date')).toBe('not-a-date');
  });
});
