import { describe, expect, it } from 'vitest';
import { classifyJsonCandidate, createJsonLineStream } from '../json-line-stream.js';

describe('classifyJsonCandidate', () => {
  it('classifies a complete object as complete', () => {
    expect(classifyJsonCandidate('{"a":1}')).toBe('complete');
  });

  it('classifies a complete array as complete', () => {
    expect(classifyJsonCandidate('[1,2,3]')).toBe('complete');
  });

  it('classifies an empty object and empty array as complete', () => {
    expect(classifyJsonCandidate('{}')).toBe('complete');
    expect(classifyJsonCandidate('[]')).toBe('complete');
  });

  it('classifies an empty array immediately followed by more input as invalid', () => {
    expect(classifyJsonCandidate('[][]')).toBe('invalid');
  });

  it('classifies scalars as complete', () => {
    expect(classifyJsonCandidate('true')).toBe('complete');
    expect(classifyJsonCandidate('false')).toBe('complete');
    expect(classifyJsonCandidate('null')).toBe('complete');
    expect(classifyJsonCandidate('42')).toBe('complete');
    expect(classifyJsonCandidate('-42')).toBe('complete');
    expect(classifyJsonCandidate('0')).toBe('complete');
    expect(classifyJsonCandidate('3.14')).toBe('complete');
    expect(classifyJsonCandidate('1e10')).toBe('complete');
    expect(classifyJsonCandidate('1.5e+10')).toBe('complete');
    expect(classifyJsonCandidate('1e-10')).toBe('complete');
    expect(classifyJsonCandidate('"hello"')).toBe('complete');
  });

  it('classifies an unclosed object as incomplete', () => {
    expect(classifyJsonCandidate('{"a":1')).toBe('incomplete');
    expect(classifyJsonCandidate('{"a"')).toBe('incomplete');
    expect(classifyJsonCandidate('{"a":')).toBe('incomplete');
    expect(classifyJsonCandidate('{')).toBe('incomplete');
  });

  it('classifies an unclosed array as incomplete', () => {
    expect(classifyJsonCandidate('[1,2')).toBe('incomplete');
    expect(classifyJsonCandidate('[')).toBe('incomplete');
  });

  it('classifies an unclosed string as incomplete', () => {
    expect(classifyJsonCandidate('"hello')).toBe('incomplete');
  });

  it('classifies an unclosed object key string as incomplete', () => {
    expect(classifyJsonCandidate('{"a')).toBe('incomplete');
  });

  it('classifies an unclosed object value string as incomplete', () => {
    expect(classifyJsonCandidate('{"a":"b')).toBe('incomplete');
  });

  it('classifies an unclosed array value string as incomplete', () => {
    expect(classifyJsonCandidate('["a')).toBe('incomplete');
  });

  it('classifies a lone minus sign with nothing after it as invalid', () => {
    expect(classifyJsonCandidate('-')).toBe('invalid');
  });

  it('classifies a partial literal as incomplete', () => {
    expect(classifyJsonCandidate('tru')).toBe('incomplete');
    expect(classifyJsonCandidate('fals')).toBe('incomplete');
    expect(classifyJsonCandidate('nul')).toBe('incomplete');
  });

  it('classifies a number cut off mid-fraction/exponent (no trailing digit) as invalid', () => {
    // The classifier requires at least one digit after `.`/`e`/`e+`; a
    // candidate that ends exactly there has no way to resolve into valid
    // JSON by appending more digits at the *next* line boundary (the parser
    // re-tries char-by-char within the same candidate), so it is invalid
    // rather than incomplete.
    expect(classifyJsonCandidate('1.')).toBe('invalid');
    expect(classifyJsonCandidate('1e')).toBe('invalid');
    expect(classifyJsonCandidate('1e+')).toBe('invalid');
  });

  it('classifies a number with more digits pending as incomplete', () => {
    expect(classifyJsonCandidate('123')).toBe('complete');
    expect(classifyJsonCandidate('[123')).toBe('incomplete');
  });

  it('classifies malformed literals as invalid', () => {
    expect(classifyJsonCandidate('trux')).toBe('invalid');
    expect(classifyJsonCandidate('falsx')).toBe('invalid');
    expect(classifyJsonCandidate('nulx')).toBe('invalid');
  });

  it('classifies a bad number as invalid', () => {
    expect(classifyJsonCandidate('-x')).toBe('invalid');
    expect(classifyJsonCandidate('1.x')).toBe('invalid');
    expect(classifyJsonCandidate('1ex')).toBe('invalid');
  });

  it('classifies a stray closing brace/bracket as invalid', () => {
    expect(classifyJsonCandidate('}')).toBe('invalid');
    expect(classifyJsonCandidate(']')).toBe('invalid');
    expect(classifyJsonCandidate('{]')).toBe('invalid');
    expect(classifyJsonCandidate('[}')).toBe('invalid');
  });

  it('classifies an object missing a colon as invalid', () => {
    expect(classifyJsonCandidate('{"a" 1}')).toBe('invalid');
  });

  it('classifies an object with a bad key as invalid', () => {
    expect(classifyJsonCandidate('{1:2}')).toBe('invalid');
  });

  it('classifies an object with a bad separator as invalid', () => {
    expect(classifyJsonCandidate('{"a":1 "b":2}')).toBe('invalid');
  });

  it('classifies an array with a bad separator as invalid', () => {
    expect(classifyJsonCandidate('[1 2]')).toBe('invalid');
  });

  it('classifies extra content after a complete root value as invalid', () => {
    expect(classifyJsonCandidate('{}{}')).toBe('invalid');
  });

  it('classifies a bad value token as invalid', () => {
    expect(classifyJsonCandidate('{"a":x}')).toBe('invalid');
    expect(classifyJsonCandidate('[x]')).toBe('invalid');
  });

  it('classifies whitespace-only input as incomplete', () => {
    expect(classifyJsonCandidate('   ')).toBe('incomplete');
    expect(classifyJsonCandidate('')).toBe('incomplete');
  });

  it('handles nested structures with whitespace', () => {
    expect(classifyJsonCandidate('{ "a" : [ 1 , 2 , { "b" : true } ] }')).toBe('complete');
  });

  it('handles escaped characters within strings', () => {
    expect(classifyJsonCandidate(String.raw`{"a":"he said \"hi\""}`)).toBe('complete');
    // A trailing backslash inside an unterminated string: the escape
    // consumes the next character (here, none is left), so the string
    // never finds its closing quote — incomplete, not invalid.
    expect(classifyJsonCandidate('"a' + String.fromCharCode(92))).toBe('incomplete');
  });
});

describe('createJsonLineStream', () => {
  it('parses a single complete JSON line', () => {
    const messages: unknown[] = [];
    const stream = createJsonLineStream((msg) => messages.push(msg));
    stream.feed('{"a":1}\n');
    expect(messages).toEqual([{ a: 1 }]);
  });

  it('parses multiple lines fed in one chunk', () => {
    const messages: unknown[] = [];
    const stream = createJsonLineStream((msg) => messages.push(msg));
    stream.feed('{"a":1}\n{"b":2}\n');
    expect(messages).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('buffers a partial line across feed() calls', () => {
    const messages: unknown[] = [];
    const stream = createJsonLineStream((msg) => messages.push(msg));
    stream.feed('{"a":');
    expect(messages).toEqual([]);
    stream.feed('1}\n');
    expect(messages).toEqual([{ a: 1 }]);
  });

  it('splits a chunk containing multiple lines and a trailing partial line', () => {
    const messages: unknown[] = [];
    const stream = createJsonLineStream((msg) => messages.push(msg));
    stream.feed('{"a":1}\n{"b":2}\n{"c":');
    expect(messages).toEqual([{ a: 1 }, { b: 2 }]);
    stream.feed('3}\n');
    expect(messages).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }]);
  });

  it('ignores blank lines', () => {
    const messages: unknown[] = [];
    const stream = createJsonLineStream((msg) => messages.push(msg));
    stream.feed('\n\n{"a":1}\n\n');
    expect(messages).toEqual([{ a: 1 }]);
  });

  it('flush() drains a residual buffered line with no trailing newline', () => {
    const messages: unknown[] = [];
    const stream = createJsonLineStream((msg) => messages.push(msg));
    stream.feed('{"a":1}');
    expect(messages).toEqual([]);
    stream.flush();
    expect(messages).toEqual([{ a: 1 }]);
  });

  it('flush() on an empty buffer is a no-op', () => {
    const messages: unknown[] = [];
    const stream = createJsonLineStream((msg) => messages.push(msg));
    expect(() => stream.flush()).not.toThrow();
    expect(messages).toEqual([]);
  });

  it('ignores a non-JSON trailing log line on flush', () => {
    const messages: unknown[] = [];
    const stream = createJsonLineStream((msg) => messages.push(msg));
    stream.feed('not json at all');
    stream.flush();
    expect(messages).toEqual([]);
  });

  it('passes the raw reassembled line as the second callback argument', () => {
    const raws: string[] = [];
    const stream = createJsonLineStream((_msg, raw) => raws.push(raw));
    stream.feed('{"a":1}\n');
    expect(raws).toEqual(['{"a":1}']);
  });

  it('reassembles a pretty-printed multiline JSON object', () => {
    const messages: unknown[] = [];
    const stream = createJsonLineStream((msg) => messages.push(msg));
    stream.feed('{\n');
    stream.feed('  "a": 1,\n');
    stream.feed('  "b": 2\n');
    stream.feed('}\n');
    expect(messages).toEqual([{ a: 1, b: 2 }]);
  });

  it('reassembles a pretty-printed multiline JSON object whose final line has no trailing newline, via flush()', () => {
    const messages: unknown[] = [];
    const stream = createJsonLineStream((msg) => messages.push(msg));
    // No trailing newline after the closing brace, so it stays buffered
    // until flush() drains it.
    stream.feed('{\n  "a": 1\n}');
    stream.flush();
    expect(messages).toEqual([{ a: 1 }]);
  });

  it('abandons a multiline candidate that exceeds 256 lines and retries the current line fresh', () => {
    const messages: unknown[] = [];
    const stream = createJsonLineStream((msg) => messages.push(msg));
    // Open an object that never legally closes within the line budget.
    stream.feed('{\n');
    for (let i = 0; i < 260; i += 1) {
      stream.feed(`"k${i}": ${i},\n`);
    }
    // A fresh valid line should still parse after the pending candidate is abandoned.
    stream.feed('{"fresh":true}\n');
    expect(messages).toContainEqual({ fresh: true });
  });

  it('abandons a multiline candidate that exceeds the byte budget and retries the current line fresh', () => {
    const messages: unknown[] = [];
    const stream = createJsonLineStream((msg) => messages.push(msg));
    stream.feed('{\n');
    // A single huge line pushes the candidate over 128_000 chars immediately.
    const hugeLine = `"pad": "${'x'.repeat(129_000)}"\n`;
    stream.feed(hugeLine);
    stream.feed('{"fresh":true}\n');
    expect(messages).toContainEqual({ fresh: true });
  });

  it('starts a pending multiline candidate only for lines beginning with { or [', () => {
    const messages: unknown[] = [];
    const raws: string[] = [];
    const stream = createJsonLineStream((msg, raw) => {
      messages.push(msg);
      raws.push(raw);
    });
    // Not JSON and doesn't start with { or [ -> should be silently dropped,
    // not accumulated into a pending candidate.
    stream.feed('hello world\n');
    stream.feed('{"a":1}\n');
    expect(messages).toEqual([{ a: 1 }]);
  });

  it('treats a line starting with { that is already invalid (not just incomplete) as a dropped line', () => {
    const messages: unknown[] = [];
    const stream = createJsonLineStream((msg) => messages.push(msg));
    // `{]` is invalid, not incomplete, so it must not start a pending candidate.
    stream.feed('{]\n');
    stream.feed('{"a":1}\n');
    expect(messages).toEqual([{ a: 1 }]);
  });

  it('recovers when a pending multiline candidate resolves to invalid JSON on the next line and the next line parses standalone', () => {
    const messages: unknown[] = [];
    const stream = createJsonLineStream((msg) => messages.push(msg));
    stream.feed('{\n');
    // Appending this makes the candidate `{\nbad line here` which is invalid
    // (starts a value with 'b'), forcing handleLine to retry the current
    // line fresh.
    stream.feed('bad line here\n');
    stream.feed('{"a":1}\n');
    expect(messages).toEqual([{ a: 1 }]);
  });
});
