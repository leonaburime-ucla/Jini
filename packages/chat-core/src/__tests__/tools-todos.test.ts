import { describe, expect, it } from 'vitest';
import type { AgentEvent } from '../events.js';
import { dedupeToolUsesById, deriveToolStatus, toRenderProps } from '../tools.js';
import {
  isTodoWriteToolName,
  latestTodosFromEvents,
  latestTodoWriteInput,
  latestTodoWriteInputForPinnedCard,
  parseTodoWriteInput,
  unfinishedTodosFromEvents,
} from '../todos.js';

describe('tools: deriveToolStatus / toRenderProps', () => {
  const use: Extract<AgentEvent, { kind: 'tool_use' }> = { kind: 'tool_use', id: 't1', name: 'Read', input: { path: 'a.ts' } };

  it('reports "complete" once a non-error result has arrived', () => {
    const result: Extract<AgentEvent, { kind: 'tool_result' }> = { kind: 'tool_result', toolUseId: 't1', content: 'ok', isError: false };
    expect(deriveToolStatus(result, true)).toBe('complete');
  });

  it('reports "error" once an error result has arrived, even mid-stream', () => {
    const result: Extract<AgentEvent, { kind: 'tool_result' }> = { kind: 'tool_result', toolUseId: 't1', content: 'boom', isError: true };
    expect(deriveToolStatus(result, true)).toBe('error');
  });

  it('reports "executing" while streaming with no result yet', () => {
    expect(deriveToolStatus(undefined, true)).toBe('executing');
  });

  it('reports "complete" for a stored turn missing its trailing tool_result on a run that succeeded', () => {
    expect(deriveToolStatus(undefined, false, true)).toBe('complete');
  });

  it('reports "error" for no result after a run that did not succeed', () => {
    expect(deriveToolStatus(undefined, false, false)).toBe('error');
  });

  it('toRenderProps projects the tool_use + result pair into the render-prop shape', () => {
    const result: Extract<AgentEvent, { kind: 'tool_result' }> = { kind: 'tool_result', toolUseId: 't1', content: 'ok', isError: false };
    expect(toRenderProps(use, result, false, true)).toEqual({
      status: 'complete',
      name: 'Read',
      args: { path: 'a.ts' },
      result: 'ok',
      isError: false,
    });
  });
});

describe('tools: dedupeToolUsesById', () => {
  it('drops a replayed duplicate tool_use id but keeps every other event in original order', () => {
    const events: AgentEvent[] = [
      { kind: 'text', text: 'starting' },
      { kind: 'tool_use', id: 'a', name: 'Read', input: {} },
      { kind: 'tool_result', toolUseId: 'a', content: 'ok', isError: false },
      { kind: 'tool_use', id: 'a', name: 'Read', input: {} }, // replayed duplicate
      { kind: 'tool_use', id: 'b', name: 'Write', input: {} },
    ];
    const deduped = dedupeToolUsesById(events);
    expect(deduped.filter((e) => e.kind === 'tool_use')).toHaveLength(2);
    expect(deduped.map((e) => e.kind)).toEqual(['text', 'tool_use', 'tool_result', 'tool_use']);
  });

  it('returns the same array reference when there is nothing to dedupe (cheap no-op)', () => {
    const events: AgentEvent[] = [{ kind: 'tool_use', id: 'a', name: 'Read', input: {} }];
    expect(dedupeToolUsesById(events)).toBe(events);
  });

  it('returns [] for undefined or empty input', () => {
    expect(dedupeToolUsesById(undefined)).toEqual([]);
    expect(dedupeToolUsesById([])).toEqual([]);
  });
});

describe('todos: parseTodoWriteInput', () => {
  it('normalizes several input shapes (todos vs plan array; content/step/label aliases)', () => {
    expect(parseTodoWriteInput({ todos: [{ content: 'a', status: 'completed' }] })).toEqual([{ content: 'a', status: 'completed', activeForm: undefined }]);
    expect(parseTodoWriteInput({ plan: [{ step: 'b' }] })[0]?.content).toBe('b');
  });

  it('maps an unrecognized/cancelled status to "stopped" and an unknown status to "pending"', () => {
    const [cancelled] = parseTodoWriteInput({ todos: [{ content: 'x', status: 'cancelled' }] });
    expect(cancelled?.status).toBe('stopped');
    const [unknown] = parseTodoWriteInput({ todos: [{ content: 'y', status: 'bogus' }] });
    expect(unknown?.status).toBe('pending');
  });

  it('drops entries with no recognizable body text instead of throwing', () => {
    expect(parseTodoWriteInput({ todos: [{ status: 'pending' }, { content: 'kept' }] })).toEqual([{ content: 'kept', status: 'pending', activeForm: undefined }]);
  });

  it('returns [] for non-object input', () => {
    expect(parseTodoWriteInput(null)).toEqual([]);
    expect(parseTodoWriteInput('nope')).toEqual([]);
  });
});

describe('todos: isTodoWriteToolName', () => {
  it('accepts every documented spelling and rejects an unrelated tool name', () => {
    expect(isTodoWriteToolName('TodoWrite')).toBe(true);
    expect(isTodoWriteToolName('update_plan')).toBe(true);
    expect(isTodoWriteToolName('Read')).toBe(false);
  });
});

describe('todos: latest-plan derivation', () => {
  const planEvents: AgentEvent[] = [
    { kind: 'tool_use', id: 't1', name: 'TodoWrite', input: { todos: [{ content: 'first', status: 'completed' }] } },
    { kind: 'tool_use', id: 't2', name: 'TodoWrite', input: { todos: [{ content: 'first', status: 'completed' }, { content: 'second', status: 'in_progress' }] } },
  ];

  it('latestTodosFromEvents returns only the most recent TodoWrite snapshot, not the first', () => {
    expect(latestTodosFromEvents(planEvents)).toHaveLength(2);
  });

  it('unfinishedTodosFromEvents filters the latest snapshot down to non-completed items', () => {
    const unfinished = unfinishedTodosFromEvents(planEvents);
    expect(unfinished).toHaveLength(1);
    expect(unfinished[0]?.content).toBe('second');
  });

  it('latestTodoWriteInput (alias for latestTodoWriteInputFromMessages) scans messages newest-first across a conversation', () => {
    const messages = [{ events: planEvents.slice(0, 1) }, { events: planEvents.slice(1) }];
    const secondEvent = planEvents[1];
    const expectedInput = secondEvent?.kind === 'tool_use' ? secondEvent.input : undefined;
    expect(latestTodoWriteInput(messages)).toEqual(expectedInput);
  });

  it('latestTodoWriteInputForPinnedCard leaves an active run untouched but flips a stuck in_progress item to "stopped" once the run is terminal', () => {
    const messages = [{ events: planEvents.slice(1), runStatus: 'running' as const, endedAt: undefined }];
    const active = latestTodoWriteInputForPinnedCard(messages) as { todos: Array<{ status: string }> };
    expect(active.todos[1]?.status).toBe('in_progress');

    const terminalMessages = [{ events: planEvents.slice(1), runStatus: 'failed' as const, endedAt: 1000 }];
    const stopped = latestTodoWriteInputForPinnedCard(terminalMessages) as { todos: Array<{ status: string }> };
    expect(stopped.todos[1]?.status).toBe('stopped');
    expect(stopped.todos[0]?.status).toBe('completed'); // an already-completed item is left alone
  });

  it('returns null when no message carries a plan tool call', () => {
    expect(latestTodoWriteInputForPinnedCard([{ events: [{ kind: 'text', text: 'hi' }] }])).toBeNull();
  });
});
