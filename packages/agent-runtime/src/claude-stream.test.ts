import { describe, expect, it } from 'vitest';
import { createClaudeStreamHandler } from './claude-stream.js';

/**
 * Behavioral replay test: feeds a hand-built JSONL trace shaped like a real
 * `claude --output-format stream-json --include-partial-messages` session
 * (message_start → text delta → tool_use block → tool_result → result)
 * through the ported parser and asserts the emitted event sequence. OD's
 * `mocks/recordings/` corpus (the real captured-CLI-output fixtures) is
 * fetched from Cloudflare R2 via `mocks/scripts/fetch-recordings.sh` and was
 * not reachable from this sandbox (no network access to that storage), so
 * this is a synthetic trace built to match the documented wire shapes in
 * `claude-stream.ts`'s own header comment and `mocks/golden/*.events.json`
 * (which WAS available in the source checkout and was used as a shape
 * reference), not a byte-for-byte replay of a captured recording. See the
 * task report for the explicit limitation.
 */
function feedLines(handler: ReturnType<typeof createClaudeStreamHandler>, lines: unknown[]) {
  for (const line of lines) {
    handler.feed(`${JSON.stringify(line)}\n`);
  }
  handler.flush();
}

describe('createClaudeStreamHandler', () => {
  it('replays a representative claude-code stream-json trace', () => {
    const events: Record<string, unknown>[] = [];
    const handler = createClaudeStreamHandler((event) => events.push(event));

    feedLines(handler, [
      { type: 'system', subtype: 'init', model: 'claude-sonnet-4-5', session_id: 'sess_abc' },
      {
        type: 'stream_event',
        event: { type: 'message_start', message: { id: 'msg_1' } },
      },
      {
        type: 'stream_event',
        event: {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text' },
        },
      },
      {
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'Reading the file now.' },
        },
      },
      { type: 'stream_event', event: { type: 'content_block_stop', index: 0 } },
      {
        type: 'stream_event',
        event: {
          type: 'content_block_start',
          index: 1,
          content_block: { type: 'tool_use', id: 'tool_1', name: 'Read' },
        },
      },
      {
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 1,
          delta: { type: 'input_json_delta', partial_json: '{"file_path":"index.html"}' },
        },
      },
      { type: 'stream_event', event: { type: 'content_block_stop', index: 1 } },
      {
        type: 'assistant',
        message: {
          id: 'msg_1',
          content: [{ type: 'tool_use', id: 'tool_1', name: 'Read', input: { file_path: 'index.html' } }],
          stop_reason: 'tool_use',
        },
      },
      {
        type: 'user',
        message: {
          content: [{ type: 'tool_result', tool_use_id: 'tool_1', content: '<html></html>', is_error: false }],
        },
      },
      {
        type: 'result',
        usage: { input_tokens: 120, output_tokens: 40 },
        total_cost_usd: 0.002,
        duration_ms: 850,
        stop_reason: 'end_turn',
      },
    ]);

    const types = events.map((e) => e.type);
    expect(types).toEqual([
      'status',
      'text_delta',
      'tool_input_delta',
      'tool_use',
      'turn_end',
      'tool_result',
      'usage',
    ]);

    const status = events[0]!;
    expect(status.label).toBe('initializing');
    expect(status.model).toBe('claude-sonnet-4-5');
    expect(status.sessionId).toBe('sess_abc');

    expect(events[1]).toEqual({ type: 'text_delta', delta: 'Reading the file now.' });

    const toolUse = events[3]!;
    expect(toolUse.name).toBe('Read');
    expect(toolUse.input).toEqual({ file_path: 'index.html' });

    expect(events[4]).toEqual({ type: 'turn_end', stopReason: 'tool_use' });

    expect(events[5]).toEqual({
      type: 'tool_result',
      toolUseId: 'tool_1',
      content: '<html></html>',
      isError: false,
    });

    const usage = events[6]!;
    expect(usage.usage).toEqual({ input_tokens: 120, output_tokens: 40 });
    expect(usage.costUsd).toBe(0.002);
    expect(usage.stopReason).toBe('end_turn');
  });

  it('does not duplicate a tool_use already streamed via input_json_delta when the final assistant wrapper repeats it', () => {
    const events: Record<string, unknown>[] = [];
    const handler = createClaudeStreamHandler((event) => events.push(event));

    feedLines(handler, [
      {
        type: 'stream_event',
        event: { type: 'message_start', message: { id: 'msg_2' } },
      },
      {
        type: 'stream_event',
        event: { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'tool_2', name: 'Write' } },
      },
      {
        type: 'stream_event',
        event: { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"path":"a.html"}' } },
      },
      { type: 'stream_event', event: { type: 'content_block_stop', index: 0 } },
      // The final assistant wrapper repeats the same tool_use id — must be suppressed.
      {
        type: 'assistant',
        message: {
          id: 'msg_2',
          content: [{ type: 'tool_use', id: 'tool_2', name: 'Write', input: {} }],
          stop_reason: 'tool_use',
        },
      },
    ]);

    const toolUseEvents = events.filter((e) => e.type === 'tool_use');
    expect(toolUseEvents).toHaveLength(1);
    expect(toolUseEvents[0]?.input).toEqual({ path: 'a.html' });
  });

  it('emits a raw event for a malformed JSON line instead of throwing', () => {
    const events: Record<string, unknown>[] = [];
    const handler = createClaudeStreamHandler((event) => events.push(event));
    handler.feed('{not valid json\n');
    handler.flush();
    expect(events).toEqual([{ type: 'raw', line: '{not valid json' }]);
  });
});
