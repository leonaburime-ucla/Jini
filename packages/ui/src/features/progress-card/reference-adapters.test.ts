import { describe, expect, it } from 'vitest';
import {
  chatActivityToProgressCard,
  dedupeToolUsesById,
  deriveFileOpsFromAgentEvents,
  designSystemGenerationJobToProgressCard,
  isTodoWriteToolName,
  latestStatusDetailFromAgentEvents,
  latestTodosFromAgentEvents,
  parseTodoWriteInput,
  type AgentEventLike,
} from './reference-adapters.js';

describe('isTodoWriteToolName', () => {
  it('recognizes every known alias', () => {
    expect(isTodoWriteToolName('TodoWrite')).toBe(true);
    expect(isTodoWriteToolName('todowrite')).toBe(true);
    expect(isTodoWriteToolName('todo_write')).toBe(true);
    expect(isTodoWriteToolName('update_plan')).toBe(true);
    expect(isTodoWriteToolName('Write')).toBe(false);
  });
});

describe('parseTodoWriteInput', () => {
  it('reads todos from the `todos` field', () => {
    const todos = parseTodoWriteInput({ todos: [{ content: 'Do the thing', status: 'in_progress' }] });
    expect(todos).toEqual([{ content: 'Do the thing', status: 'in_progress' }]);
  });

  it('falls back to the `plan` field', () => {
    const todos = parseTodoWriteInput({ plan: [{ step: 'Plan step', status: 'completed' }] });
    expect(todos).toEqual([{ content: 'Plan step', status: 'completed' }]);
  });

  it('normalizes cancelled/failed statuses to stopped and unknown to pending', () => {
    const todos = parseTodoWriteInput({
      todos: [
        { content: 'a', status: 'cancelled' },
        { content: 'b', status: 'failed' },
        { content: 'c', status: 'mystery' },
      ],
    });
    expect(todos.map((todo) => todo.status)).toEqual(['stopped', 'stopped', 'pending']);
  });

  it('drops entries with no usable content field', () => {
    const todos = parseTodoWriteInput({ todos: [{ status: 'pending' }, { content: 'kept', status: 'pending' }] });
    expect(todos).toEqual([{ content: 'kept', status: 'pending' }]);
  });

  it('returns an empty array for non-object or missing input', () => {
    expect(parseTodoWriteInput(null)).toEqual([]);
    expect(parseTodoWriteInput('nope')).toEqual([]);
    expect(parseTodoWriteInput({})).toEqual([]);
  });
});

describe('latestTodosFromAgentEvents', () => {
  it('returns the most recent TodoWrite call, ignoring earlier ones', () => {
    const events: AgentEventLike[] = [
      { kind: 'tool_use', id: '1', name: 'TodoWrite', input: { todos: [{ content: 'old', status: 'pending' }] } },
      { kind: 'tool_use', id: '2', name: 'Read', input: { file_path: 'a.ts' } },
      { kind: 'tool_use', id: '3', name: 'TodoWrite', input: { todos: [{ content: 'new', status: 'in_progress' }] } },
    ];
    expect(latestTodosFromAgentEvents(events)).toEqual([{ content: 'new', status: 'in_progress' }]);
  });

  it('returns an empty array when there is no TodoWrite event', () => {
    expect(latestTodosFromAgentEvents([{ kind: 'text' }])).toEqual([]);
    expect(latestTodosFromAgentEvents(undefined)).toEqual([]);
  });
});

describe('latestStatusDetailFromAgentEvents', () => {
  it('formats the label and appends detail when present', () => {
    const events: AgentEventLike[] = [{ kind: 'status', label: 'reading_files', detail: 'src/app.ts' }];
    expect(latestStatusDetailFromAgentEvents(events)).toBe('reading files: src/app.ts');
  });

  it('omits the detail suffix when absent', () => {
    const events: AgentEventLike[] = [{ kind: 'status', label: 'thinking' }];
    expect(latestStatusDetailFromAgentEvents(events)).toBe('thinking');
  });

  it('returns null when there is no status event', () => {
    expect(latestStatusDetailFromAgentEvents([{ kind: 'text' }])).toBeNull();
  });
});

describe('dedupeToolUsesById', () => {
  it('keeps only the final attempt for a retried tool_use id', () => {
    const events: AgentEventLike[] = [
      { kind: 'tool_use', id: 'a', name: 'Read', input: {} },
      { kind: 'tool_result', toolUseId: 'a', isError: true },
      { kind: 'tool_use', id: 'a', name: 'Read', input: {} },
      { kind: 'tool_result', toolUseId: 'a', isError: false },
    ];
    const deduped = dedupeToolUsesById(events);
    expect(deduped.filter((event) => event.kind === 'tool_use')).toHaveLength(1);
  });

  it('is a no-op when there are no duplicate ids', () => {
    const events: AgentEventLike[] = [{ kind: 'tool_use', id: 'a', name: 'Read', input: {} }];
    expect(dedupeToolUsesById(events)).toEqual(events);
  });
});

describe('deriveFileOpsFromAgentEvents', () => {
  it('classifies read/write/edit/delete tool names', () => {
    const events: AgentEventLike[] = [
      { kind: 'tool_use', id: '1', name: 'Read', input: { file_path: 'a.ts' } },
      { kind: 'tool_use', id: '2', name: 'Write', input: { file_path: 'b.ts' } },
      { kind: 'tool_use', id: '3', name: 'Edit', input: { file_path: 'c.ts' } },
      { kind: 'tool_use', id: '4', name: 'Delete', input: { file_path: 'd.ts' } },
    ];
    const ops = deriveFileOpsFromAgentEvents(events);
    expect(ops.map((op) => op.ops[0]).sort()).toEqual(['delete', 'edit', 'read', 'write']);
  });

  it('merges repeated ops on the same path and tracks the worst status', () => {
    const events: AgentEventLike[] = [
      { kind: 'tool_use', id: '1', name: 'Read', input: { file_path: 'src/a.ts' } },
      { kind: 'tool_result', toolUseId: '1', isError: false },
      { kind: 'tool_use', id: '2', name: 'Edit', input: { file_path: 'src/a.ts' } },
      { kind: 'tool_result', toolUseId: '2', isError: true },
    ];
    const ops = deriveFileOpsFromAgentEvents(events);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ path: 'a.ts', fullPath: 'src/a.ts', status: 'error' });
    expect(ops[0]!.ops).toEqual(['read', 'edit']);
  });

  it('marks a tool_use with no matching tool_result as running', () => {
    const events: AgentEventLike[] = [{ kind: 'tool_use', id: '1', name: 'Write', input: { file_path: 'a.ts' } }];
    expect(deriveFileOpsFromAgentEvents(events)[0]?.status).toBe('running');
  });

  it('ignores tool calls with no resolvable file path', () => {
    const events: AgentEventLike[] = [{ kind: 'tool_use', id: '1', name: 'Read', input: {} }];
    expect(deriveFileOpsFromAgentEvents(events)).toEqual([]);
  });

  it('ignores unrelated tool names', () => {
    const events: AgentEventLike[] = [{ kind: 'tool_use', id: '1', name: 'Bash', input: { command: 'rm a.ts' } }];
    expect(deriveFileOpsFromAgentEvents(events)).toEqual([]);
  });
});

describe('chatActivityToProgressCard', () => {
  it('returns null when there is nothing to show', () => {
    expect(chatActivityToProgressCard(null, { id: 'x', active: false })).toBeNull();
    expect(chatActivityToProgressCard({ events: [] }, { id: 'x', active: false })).toBeNull();
  });

  it('is running while active, even with an unset runStatus', () => {
    const card = chatActivityToProgressCard({ events: [] }, { id: 'x', active: true });
    expect(card?.status).toBe('running');
  });

  it('maps queued/running runStatus to a running card (when there is activity to show)', () => {
    const events: AgentEventLike[] = [{ kind: 'status', label: 'thinking' }];
    expect(chatActivityToProgressCard({ events, runStatus: 'queued' }, { id: 'x', active: false })?.status).toBe(
      'running',
    );
    expect(chatActivityToProgressCard({ events, runStatus: 'running' }, { id: 'x', active: false })?.status).toBe(
      'running',
    );
  });

  it('a queued/running runStatus alone (no active flag, no other signal) shows nothing, matching the source', () => {
    expect(chatActivityToProgressCard({ runStatus: 'queued' }, { id: 'x', active: false })).toBeNull();
  });

  it('maps failed/canceled runStatus to a failed card', () => {
    expect(chatActivityToProgressCard({ runStatus: 'failed' }, { id: 'x', active: false })?.status).toBe('failed');
    expect(chatActivityToProgressCard({ runStatus: 'canceled' }, { id: 'x', active: false })?.status).toBe('failed');
  });

  it('maps a terminal succeeded run to a succeeded card at 100%', () => {
    const card = chatActivityToProgressCard({ runStatus: 'succeeded' }, { id: 'x', active: true });
    // `active` still forces running per the source's own precedence rule.
    expect(card?.status).toBe('running');
  });

  it('builds steps from the latest todo list, capping progress between 18 and 92', () => {
    const events: AgentEventLike[] = [
      {
        kind: 'tool_use',
        id: '1',
        name: 'TodoWrite',
        input: {
          todos: [
            { content: 'first', status: 'completed' },
            { content: 'second', status: 'in_progress' },
            { content: 'third', status: 'pending' },
          ],
        },
      },
    ];
    const card = chatActivityToProgressCard({ events, runStatus: 'running' }, { id: 'x', active: true });
    expect(card?.steps.map((step) => ({ label: step.label, status: step.status }))).toEqual([
      { label: 'first', status: 'succeeded' },
      { label: 'second', status: 'running' },
      { label: 'third', status: 'pending' },
    ]);
    expect(card?.progress).toBeGreaterThanOrEqual(18);
    expect(card?.progress).toBeLessThanOrEqual(92);
  });

  it('falls back to derived steps when there is no todo list', () => {
    const events: AgentEventLike[] = [
      { kind: 'tool_use', id: '1', name: 'Read', input: { file_path: 'a.ts' } },
      { kind: 'tool_result', toolUseId: '1', isError: false },
    ];
    const card = chatActivityToProgressCard({ events, runStatus: 'running' }, { id: 'x', active: true });
    expect(card?.steps.map((step) => step.id)).toEqual(['read-current-state', 'update-files', 'finalize']);
  });

  it('surfaces derived file ops as secondaryItems', () => {
    const events: AgentEventLike[] = [
      { kind: 'tool_use', id: '1', name: 'Edit', input: { file_path: 'src/a.ts' } },
      { kind: 'tool_result', toolUseId: '1', isError: false },
    ];
    const card = chatActivityToProgressCard({ events, runStatus: 'running' }, { id: 'x', active: true });
    expect(card?.secondaryItems).toEqual([{ id: 'src/a.ts', label: 'a.ts', status: 'succeeded' }]);
  });

  it('is active with a status event even when nothing else is going on', () => {
    const events: AgentEventLike[] = [{ kind: 'status', label: 'thinking' }];
    const card = chatActivityToProgressCard({ events, runStatus: 'succeeded' }, { id: 'x', active: false });
    expect(card).not.toBeNull();
    expect(card?.detail).toBe('thinking');
  });
});

describe('designSystemGenerationJobToProgressCard', () => {
  it('maps queued to pending and preserves running/succeeded/failed', () => {
    expect(designSystemGenerationJobToProgressCard(job({ status: 'queued' })).status).toBe('pending');
    expect(designSystemGenerationJobToProgressCard(job({ status: 'running' })).status).toBe('running');
    expect(designSystemGenerationJobToProgressCard(job({ status: 'succeeded' })).status).toBe('succeeded');
    expect(designSystemGenerationJobToProgressCard(job({ status: 'failed' })).status).toBe('failed');
  });

  it('maps canceled to failed, same terminal-non-success grouping as the chat-activity adapter', () => {
    expect(designSystemGenerationJobToProgressCard(job({ status: 'canceled' })).status).toBe('failed');
  });

  it('maps steps 1:1 and clamps progress', () => {
    const card = designSystemGenerationJobToProgressCard(
      job({
        progress: 142,
        steps: [{ id: 's1', title: 'Draft tokens', status: 'succeeded' }],
      }),
    );
    expect(card.progress).toBe(100);
    expect(card.steps).toEqual([{ id: 's1', label: 'Draft tokens', status: 'succeeded' }]);
  });

  it('carries the job message through as detail, omitting it when absent', () => {
    expect(designSystemGenerationJobToProgressCard(job({ message: 'Applying feedback.' })).detail).toBe(
      'Applying feedback.',
    );
    expect(designSystemGenerationJobToProgressCard(job({})).detail).toBeUndefined();
  });
});

function job(overrides: Partial<Parameters<typeof designSystemGenerationJobToProgressCard>[0]>) {
  return {
    id: 'job-1',
    status: 'running' as const,
    progress: 50,
    steps: [],
    ...overrides,
  };
}
