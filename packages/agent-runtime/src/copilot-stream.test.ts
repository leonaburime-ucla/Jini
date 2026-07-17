import { describe, expect, it } from 'vitest';
import { createCopilotStreamHandler } from './copilot-stream.js';

/** Synthetic trace shaped like GitHub Copilot CLI's `--output-format json`; see `claude-stream.test.ts` for the network-access caveat. */
function feed(lines: unknown[]) {
  const events: Record<string, unknown>[] = [];
  const handler = createCopilotStreamHandler((event) => events.push(event));
  for (const line of lines) handler.feed(`${JSON.stringify(line)}\n`);
  handler.flush();
  return events;
}

describe('createCopilotStreamHandler', () => {
  it('replays a session-init → text → tool-call → result trace', () => {
    const events = feed([
      { type: 'session.tools_updated', data: { model: 'gpt-5.2' } },
      { type: 'assistant.turn_start', data: {} },
      { type: 'assistant.message_delta', data: { deltaContent: 'Looking into it.' } },
      { type: 'tool.execution_start', data: { toolCallId: 'call_1', toolName: 'bash', arguments: { command: 'ls' } } },
      { type: 'tool.execution_complete', data: { toolCallId: 'call_1', result: 'index.html', success: true } },
      { type: 'result', usage: { sessionDurationMs: 900 }, success: true },
    ]);

    expect(events.map((e) => e.type)).toEqual(['status', 'status', 'text_delta', 'tool_use', 'tool_result', 'usage']);
    expect(events[0]).toEqual({ type: 'status', label: 'initializing', model: 'gpt-5.2' });
    expect(events[3]).toEqual({ type: 'tool_use', id: 'call_1', name: 'bash', input: { command: 'ls' } });
    expect(events[4]).toEqual({ type: 'tool_result', toolUseId: 'call_1', content: 'index.html', isError: false });
    expect(events[5]).toMatchObject({ stopReason: 'completed', durationMs: 900 });
  });

  it('flags a tool failure and a non-success result', () => {
    const events = feed([
      { type: 'tool.execution_complete', data: { toolCallId: 'call_2', result: 'permission denied', success: false } },
      { type: 'result', usage: {}, success: false, exitCode: 1 },
    ]);
    expect(events[0]).toMatchObject({ isError: true });
    expect(events[1]).toMatchObject({ stopReason: 'error' });
  });

  it('emits a raw event for malformed JSON instead of throwing', () => {
    const events: Record<string, unknown>[] = [];
    const handler = createCopilotStreamHandler((event) => events.push(event));
    expect(() => handler.feed('{unterminated\n')).not.toThrow();
    expect(events).toEqual([{ type: 'raw', line: '{unterminated' }]);
  });
});
