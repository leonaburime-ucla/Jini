import { homedir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { expandConfiguredEnv, expandHomePath } from '../paths.js';

describe('expandHomePath', () => {
  it('expands a bare "~" to the home directory', () => {
    expect(expandHomePath('~')).toBe(homedir());
  });

  it('expands a "~/" prefix using a forward slash', () => {
    expect(expandHomePath('~/foo/bar')).toBe(path.join(homedir(), 'foo/bar'));
  });

  it('expands a "~\\\\" prefix using a backslash', () => {
    expect(expandHomePath('~\\foo\\bar')).toBe(path.join(homedir(), 'foo\\bar'));
  });

  it('leaves an absolute path unchanged', () => {
    expect(expandHomePath('/usr/local/bin/foo')).toBe('/usr/local/bin/foo');
  });

  it('leaves a value that merely contains a tilde mid-string unchanged', () => {
    expect(expandHomePath('foo~bar')).toBe('foo~bar');
  });
});

describe('expandConfiguredEnv', () => {
  it('returns an empty object for a nullish or non-object input', () => {
    expect(expandConfiguredEnv(null)).toEqual({});
    expect(expandConfiguredEnv(undefined)).toEqual({});
    expect(expandConfiguredEnv('not-an-object')).toEqual({});
    expect(expandConfiguredEnv(42)).toEqual({});
  });

  it('skips non-string values', () => {
    expect(expandConfiguredEnv({ FOO: 1, BAR: null, BAZ: 'ok' })).toEqual({ BAZ: 'ok' });
  });

  it('expands home-relative string values', () => {
    expect(expandConfiguredEnv({ MY_PATH: '~/config.json' })).toEqual({
      MY_PATH: path.join(homedir(), 'config.json'),
    });
  });

  it('passes through plain string values unchanged', () => {
    expect(expandConfiguredEnv({ FOO: 'bar' })).toEqual({ FOO: 'bar' });
  });
});
