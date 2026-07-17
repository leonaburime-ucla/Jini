import { describe, expect, it } from 'vitest';
import { createJsonEventStreamHandler } from './json-event-stream.js';

/**
 * Behavioral replay tests against synthetic traces shaped like real Codex
 * `exec --json` and OpenCode `run --format json` output (per this file's
 * own parser branches). Same network-access limitation as
 * `claude-stream.test.ts` applies — see that file's header comment.
 */
function feed(kind: string, lines: unknown[]) {
  const events: Record<string, unknown>[] = [];
  const handler = createJsonEventStreamHandler(kind, (event) => events.push(event));
  for (const line of lines) handler.feed(`${JSON.stringify(line)}\n`);
  handler.flush();
  return events;
}

describe('createJsonEventStreamHandler (codex)', () => {
  it('replays a thread-start → command execution → agent message → usage trace', () => {
    const events = feed('codex', [
      { type: 'thread.started', thread_id: 'thread_abc' },
      { type: 'turn.started' },
      {
        type: 'item.started',
        item: { id: 'cmd_1', type: 'command_execution', command: 'ls' },
      },
      {
        type: 'item.completed',
        item: { id: 'cmd_1', type: 'command_execution', command: 'ls', aggregated_output: 'index.html\n', exit_code: 0 },
      },
      { type: 'item.completed', item: { type: 'agent_message', text: 'Done listing files.' } },
      { type: 'turn.completed', usage: { input_tokens: 200, output_tokens: 30, cached_input_tokens: 50 } },
    ]);

    const types = events.map((e) => e.type);
    expect(types).toEqual(['status', 'status', 'tool_use', 'tool_result', 'text_delta', 'usage']);
    // item.started AND item.completed for the same command id both try to
    // emit tool_use, but the dedupe set only lets the first through.
    const toolUseEvents = events.filter((e) => e.type === 'tool_use');
    expect(toolUseEvents).toHaveLength(1);
    expect(toolUseEvents[0]).toEqual({ type: 'tool_use', id: 'cmd_1', name: 'Bash', input: { command: 'ls' } });

    const toolResult = events.find((e) => e.type === 'tool_result')!;
    expect(toolResult.isError).toBe(false);
    expect(toolResult.content).toContain('index.html');

    const textDelta = events.find((e) => e.type === 'text_delta')!;
    expect(textDelta.delta).toBe('Done listing files.');

    const usage = events.find((e) => e.type === 'usage')!;
    expect(usage.usage).toEqual({ input_tokens: 200, output_tokens: 30, cached_read_tokens: 50 });

    const firstStatus = events[0]!;
    expect(firstStatus.sessionId).toBe('thread_abc');
  });

  it('marks a failed command as an error tool_result', () => {
    const events = feed('codex', [
      {
        type: 'item.completed',
        item: { id: 'cmd_2', type: 'command_execution', command: 'false', aggregated_output: '', exit_code: 1 },
      },
    ]);
    const toolResult = events.find((e) => e.type === 'tool_result')!;
    expect(toolResult.isError).toBe(true);
  });

  it('emits a non-fatal status for a recoverable reconnect error', () => {
    const events = feed('codex', [
      { type: 'error', message: 'Reconnecting... stream disconnected before completion' },
    ]);
    expect(events[0]?.type).toBe('status');
  });

  it('emits a fatal error event for a non-recoverable error', () => {
    const events = feed('codex', [{ type: 'error', message: 'invalid API key' }]);
    expect(events[0]?.type).toBe('error');
  });
});

describe('createJsonEventStreamHandler (opencode)', () => {
  it('replays a step_start → text → tool_use trace and captures the session id', () => {
    const events = feed('opencode', [
      { type: 'step_start', sessionID: 'ses_123' },
      { type: 'text', part: { text: 'Working on it.' } },
      {
        type: 'tool_use',
        sessionID: 'ses_123',
        part: { tool: 'write', callID: 'call_1', state: { input: { path: 'a.html' } } },
      },
    ]);

    const types = events.map((e) => e.type);
    expect(types).toEqual(['status', 'text_delta', 'tool_use']);
    expect(events[0]).toMatchObject({ type: 'status', label: 'running', sessionId: 'ses_123' });
    expect(events[1]).toEqual({ type: 'text_delta', delta: 'Working on it.' });
  });

  it('falls through to a raw event for an unrecognized shape', () => {
    const events = feed('opencode', [{ type: 'totally-unknown-event' }]);
    expect(events).toEqual([{ type: 'raw', line: JSON.stringify({ type: 'totally-unknown-event' }) }]);
  });
});
