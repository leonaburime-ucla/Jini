import { describe, expect, it } from 'vitest';
import { composeRuntimeCompatNormalizers, noopRuntimeCompatNormalizer, type RuntimeCompatNormalizer } from '../runtime-compat.js';

describe('noopRuntimeCompatNormalizer', () => {
  it('returns the body unchanged', () => {
    expect(noopRuntimeCompatNormalizer('index.html', 'body')).toBe('body');
    const obj = { x: 1 };
    expect(noopRuntimeCompatNormalizer('index.html', obj)).toBe(obj);
  });
});

describe('composeRuntimeCompatNormalizers', () => {
  it('applies each normalizer in order, threading the output forward', () => {
    const appendA: RuntimeCompatNormalizer = (_name, body) => `${body as string}-A`;
    const appendB: RuntimeCompatNormalizer = (_name, body) => `${body as string}-B`;
    const composed = composeRuntimeCompatNormalizers([appendA, appendB]);
    expect(composed('index.html', 'start')).toBe('start-A-B');
  });

  it('with zero normalizers, returns the body unchanged', () => {
    const composed = composeRuntimeCompatNormalizers([]);
    expect(composed('index.html', 'unchanged')).toBe('unchanged');
  });

  it('passes the name through to every normalizer', () => {
    const seen: string[] = [];
    const record: RuntimeCompatNormalizer = (name, body) => {
      seen.push(name);
      return body;
    };
    composeRuntimeCompatNormalizers([record, record])('a.html', 'x');
    expect(seen).toEqual(['a.html', 'a.html']);
  });
});
