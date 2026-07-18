import { describe, expect, it } from 'vitest';
import { parseSseFrame } from '../sse.js';

describe('parseSseFrame', () => {
  it('parses a named event with a JSON data payload and id', () => {
    const result = parseSseFrame('event: tick\nid: 42\ndata: {"n":1}');
    expect(result).toEqual({ kind: 'event', event: 'tick', data: { n: 1 }, id: '42' });
  });

  it('defaults the event name to "message" when omitted', () => {
    const result = parseSseFrame('data: {"ok":true}');
    expect(result).toEqual({ kind: 'event', event: 'message', data: { ok: true } });
  });

  it('joins multiple data: lines before parsing JSON', () => {
    const result = parseSseFrame('data: {"a":1,\ndata: "b":2}');
    expect(result).toEqual({ kind: 'event', event: 'message', data: { a: 1, b: 2 } });
  });

  it('returns a comment frame for data-less lines prefixed with ":"', () => {
    const result = parseSseFrame(': keep-alive');
    expect(result).toEqual({ kind: 'comment', comment: 'keep-alive' });
  });

  it('returns empty for a frame with neither data nor comment lines', () => {
    expect(parseSseFrame('event: noop')).toEqual({ kind: 'empty' });
  });

  it('returns null when data: lines do not parse as JSON', () => {
    expect(parseSseFrame('data: not-json')).toBeNull();
  });

  it('strips trailing \\r from CRLF-terminated lines', () => {
    const result = parseSseFrame('event: tick\r\ndata: {"n":1}\r');
    expect(result).toEqual({ kind: 'event', event: 'tick', data: { n: 1 } });
  });
});
