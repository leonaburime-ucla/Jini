import { describe, expect, it } from 'vitest';

import { parseRuleBody } from '../rule-body.js';

describe('parseRuleBody', () => {
  it('parses Assertion/Check/Verified by labeled lines', () => {
    const result = parseRuleBody(
      'Assertion: buttons use the brand green color\nCheck: every button element has the brand green fill\nVerified by: annotation on the CTA button',
    );
    expect(result).toEqual({
      assertion: 'buttons use the brand green color',
      check: 'every button element has the brand green fill',
      rationale: 'annotation on the CTA button',
    });
  });

  it('accepts "Rationale:" as a synonym for "Verified by:"', () => {
    const result = parseRuleBody('Assertion: a\nRationale: because reasons');
    expect(result.rationale).toBe('because reasons');
  });

  it('prefers "Verified by:" over "Rationale:" when both are present (first match wins)', () => {
    const result = parseRuleBody('Verified by: first\nRationale: second');
    expect(result.rationale).toBe('first');
  });

  it('falls back to assertion for check when no Check: line is present', () => {
    const result = parseRuleBody('Assertion: only an assertion here');
    expect(result.check).toBe('only an assertion here');
  });

  it('falls back to the first line as assertion when no labels are recognized (plain prose)', () => {
    const result = parseRuleBody('Just a plain prose rule with no labels.\nSecond line ignored.');
    expect(result).toEqual({
      assertion: 'Just a plain prose rule with no labels.',
      check: 'Just a plain prose rule with no labels.',
      rationale: '',
    });
  });

  it('keeps only the first occurrence of a repeated label', () => {
    const result = parseRuleBody('Assertion: first\nAssertion: second');
    expect(result.assertion).toBe('first');
  });

  it('ignores an unrecognized label line rather than folding it into any field', () => {
    const result = parseRuleBody('Assertion: a\nFoo: bar\nCheck: c');
    expect(result).toEqual({ assertion: 'a', check: 'c', rationale: '' });
  });

  it('skips a labeled line whose value is empty after trimming', () => {
    const result = parseRuleBody('Assertion:   \nCheck: c');
    // The empty "Assertion:" line is skipped, so assertion falls back to the
    // first line of the body verbatim (which is that same empty-valued line).
    expect(result.check).toBe('c');
    expect(result.assertion).toBe('Assertion:');
  });

  it('returns all-empty fields for an empty body', () => {
    expect(parseRuleBody('')).toEqual({ assertion: '', check: '', rationale: '' });
  });

  it('handles CRLF line endings the same as LF', () => {
    const result = parseRuleBody('Assertion: a\r\nCheck: c\r\nRationale: r');
    expect(result).toEqual({ assertion: 'a', check: 'c', rationale: 'r' });
  });
});
