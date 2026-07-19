import { describe, expect, it } from 'vitest';
import { coerceCliValue, parseFlags, positionalArgs } from '../flags.js';

describe('parseFlags', () => {
  it('parses a boolean flag', () => {
    expect(parseFlags(['--json'], { boolean: new Set(['json']) })).toEqual({ json: true });
  });

  it('parses --flag=value', () => {
    expect(parseFlags(['--name=cards'], { string: new Set(['name']) })).toEqual({ name: 'cards' });
  });

  it('parses --flag value', () => {
    expect(parseFlags(['--name', 'cards'], { string: new Set(['name']) })).toEqual({ name: 'cards' });
  });

  it('throws when a required string flag has no following value', () => {
    expect(() => parseFlags(['--name'], { string: new Set(['name']) })).toThrow('flag --name requires a value');
  });

  it('throws on an unrecognized flag when string/boolean sets are non-empty', () => {
    expect(() => parseFlags(['--bogus'], { string: new Set(['name']) })).toThrow('unknown flag: --bogus');
  });

  it('accepts any flag when no string/boolean sets are given, consuming a non-flag next token as the value', () => {
    expect(parseFlags(['--name', 'cards'])).toEqual({ name: 'cards' });
  });

  it('accepts any flag when no sets are given, treating a flag-like or missing next token as boolean true', () => {
    expect(parseFlags(['--flag', '--other'])).toEqual({ flag: true, other: true });
    expect(parseFlags(['--flag'])).toEqual({ flag: true });
  });

  it('skips non-"--"-prefixed tokens (positionals)', () => {
    expect(parseFlags(['foo', '--json'], { boolean: new Set(['json']) })).toEqual({ json: true });
  });

  it('a boolean-declared flag never consumes the next token even via the heuristic path', () => {
    expect(parseFlags(['--json', 'value'], { boolean: new Set(['json']) })).toEqual({ json: true });
  });

  it('handles multiple flags and repeated keys (last wins)', () => {
    expect(
      parseFlags(['--name', 'a', '--name', 'b'], { string: new Set(['name']) }),
    ).toEqual({ name: 'b' });
  });
});

describe('positionalArgs', () => {
  it('collects non-flag tokens', () => {
    expect(positionalArgs(['foo', 'bar'])).toEqual(['foo', 'bar']);
  });

  it('skips a known string flag and its value', () => {
    expect(positionalArgs(['--project', 'p1', 'foo'], { string: new Set(['project']) })).toEqual(['foo']);
  });

  it('does not skip a value for an unknown flag (only consumes the flag token itself)', () => {
    expect(positionalArgs(['--other', 'p1', 'foo'])).toEqual(['p1', 'foo']);
  });

  it('does not double-skip an inline --flag=value token', () => {
    expect(positionalArgs(['--project=p1', 'foo'], { string: new Set(['project']) })).toEqual(['foo']);
  });

  it('stops flag-skipping at "--" when stopAtDoubleDash is set, collecting the rest verbatim', () => {
    expect(
      positionalArgs(['--project', 'p1', '--', '--not-a-flag', 'x'], {
        string: new Set(['project']),
        stopAtDoubleDash: true,
      }),
    ).toEqual(['--not-a-flag', 'x']);
  });

  it('treats "--" as an ordinary flag-prefixed token when stopAtDoubleDash is not set', () => {
    expect(positionalArgs(['a', '--', 'b'])).toEqual(['a', 'b']);
  });
});

describe('coerceCliValue', () => {
  it('coerces "true" and "false" to booleans', () => {
    expect(coerceCliValue('true')).toBe(true);
    expect(coerceCliValue('false')).toBe(false);
  });

  it('coerces an integer literal to a number', () => {
    expect(coerceCliValue('42')).toBe(42);
  });

  it('coerces a negative decimal literal to a number', () => {
    expect(coerceCliValue('-3.5')).toBe(-3.5);
  });

  it('leaves a non-numeric, non-boolean string unchanged', () => {
    expect(coerceCliValue('abc')).toBe('abc');
  });

  it('leaves a partially-numeric string unchanged (the whole value must match)', () => {
    expect(coerceCliValue('12abc')).toBe('12abc');
  });

  it('leaves an empty string unchanged', () => {
    expect(coerceCliValue('')).toBe('');
  });
});
