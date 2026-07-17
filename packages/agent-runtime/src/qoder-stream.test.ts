import { describe, expect, it } from 'vitest';
import { createQoderStreamHandler } from './qoder-stream.js';

/** Synthetic trace shaped like Qoder CLI's `--output-format stream-json`; see `claude-stream.test.ts` for the network-access caveat. */
function feed(lines: unknown[]) {
  const events: Record<string, unknown>[] = [];
  const handler = createQoderStreamHandler((event) => events.push(event));
  for (const line of lines) handler.feed(`${JSON.stringify(line)}\n`);
  handler.flush();
  return events;
}

describe('createQoderStreamHandler', () => {
  it('replays an init → assistant text → result trace', () => {
    const events = feed([
      { type: 'system', subtype: 'init', model: 'qoder-ultimate', session_id: 'qsess_1', qodercli_version: '1.2.3' },
      { type: 'assistant', message: { content: [{ type: 'text', text: 'Building the page.' }] } },
      { type: 'result', usage: { input_tokens: 10 }, total_cost_usd: 0.001, duration_ms: 400, stop_reason: 'stop', is_error: false },
    ]);

    expect(events.map((e) => e.type)).toEqual(['status', 'text_delta', 'usage']);
    expect(events[0]).toMatchObject({ label: 'initializing', model: 'qoder-ultimate', sessionId: 'qsess_1' });
    expect(events[1]).toEqual({ type: 'text_delta', delta: 'Building the page.' });
    expect(events[2]).toMatchObject({ isError: false, costUsd: 0.001 });
  });

  it('surfaces a failed result as both a usage record and an error event', () => {
    const events = feed([{ type: 'result', is_error: true, stop_reason: 'quota_exceeded' }]);
    expect(events.map((e) => e.type)).toEqual(['usage', 'error']);
    expect(events[1]?.message).toContain('quota_exceeded');
  });

  it('emits thinking_start once then thinking_delta for subsequent thinking blocks', () => {
    const events = feed([
      {
        type: 'assistant',
        message: {
          content: [
            { type: 'thinking', thinking: 'considering approach A' },
            { type: 'thinking', thinking: 'considering approach B' },
          ],
        },
      },
    ]);
    expect(events.map((e) => e.type)).toEqual(['thinking_start', 'thinking_delta', 'thinking_delta']);
  });

  it('emits a raw event for malformed JSON', () => {
    const handler = createQoderStreamHandler(() => {});
    expect(() => handler.feed('{bad json\n')).not.toThrow();
  });
});
