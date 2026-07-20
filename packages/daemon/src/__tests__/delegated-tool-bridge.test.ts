import { describe, expect, it, vi } from 'vitest';
import { createToolRegistry } from '@jini/core';
import type { RunAgentPayload, RunProtocolEvent } from '@jini/protocol';
import { createDelegatedToolBridge, serializeDelegatedToolOutput } from '../delegated-tool-bridge.js';
import { createInMemoryEventLog } from '../event-log.js';
import { createRunLifecycle } from '../run-lifecycle.js';
import { createToolExecutor } from '../tool-executor.js';

async function collectEvents(lifecycle: ReturnType<typeof createRunLifecycle>, runId: string): Promise<RunProtocolEvent[]> {
  const events: RunProtocolEvent[] = [];
  await lifecycle.stream(runId, (event) => events.push(event));
  return events;
}

describe('DelegatedToolBridge', () => {
  it('routes one allowed and one denied delegated call through ToolExecutor with matching run events and audits', async () => {
    const registry = createToolRegistry();
    const allowedHandler = vi.fn(async (input: { input: unknown }) => ({ echoed: input.input }));
    const deniedHandler = vi.fn(async () => 'must not run');
    registry.register({
      descriptor: { id: 'echo' },
      handler: allowedHandler,
      policy: { authorize: () => 'allow' },
    });
    registry.register({
      descriptor: { id: 'blocked' },
      handler: deniedHandler,
      policy: { authorize: () => 'deny' },
    });
    const toolExecutor = createToolExecutor({ registry });
    const lifecycle = createRunLifecycle({ eventLog: createInMemoryEventLog() });
    const bridge = createDelegatedToolBridge({ lifecycle, toolExecutor });
    const { run } = await lifecycle.start({ contextRef: 'delegated-tools' });

    const allowed = await bridge.execute({
      runId: run.id,
      toolUseId: 'call-allow',
      toolId: 'echo',
      principal: { id: 'user-1' },
      input: { greeting: 'hello' },
    });
    const denied = await bridge.execute({
      runId: run.id,
      toolUseId: 'call-deny',
      toolId: 'blocked',
      principal: { id: 'user-1' },
      input: { destructive: true },
    });
    await lifecycle.finish({ runId: run.id, status: 'succeeded', code: 0, signal: null, resumable: false });

    expect(allowed.status).toBe('completed');
    expect(denied.status).toBe('denied');
    expect(allowedHandler).toHaveBeenCalledTimes(1);
    expect(deniedHandler).not.toHaveBeenCalled();
    expect(toolExecutor.getAuditRecord(allowed.executionId)?.events.map((event) => event.phase)).toEqual([
      'requested',
      'authorized',
      'started',
      'completed',
    ]);
    expect(toolExecutor.getAuditRecord(denied.executionId)?.events.map((event) => event.phase)).toEqual([
      'requested',
      'denied',
    ]);

    const agentEvents = (await collectEvents(lifecycle, run.id))
      .filter((event) => event.kind === 'agent')
      .map((event) => event.payload as RunAgentPayload);
    expect(agentEvents).toEqual([
      { type: 'tool_use', id: 'call-allow', name: 'echo', input: { greeting: 'hello' } },
      { type: 'tool_result', toolUseId: 'call-allow', content: '{"echoed":{"greeting":"hello"}}' },
      { type: 'tool_use', id: 'call-deny', name: 'blocked', input: { destructive: true } },
      {
        type: 'tool_result',
        toolUseId: 'call-deny',
        content: 'Tool execution denied by policy.',
        isError: true,
      },
    ]);
  });

  it('serializes non-string tool output without throwing on circular values', () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(serializeDelegatedToolOutput({ ok: true })).toBe('{"ok":true}');
    expect(serializeDelegatedToolOutput(undefined)).toBe('');
    expect(serializeDelegatedToolOutput(circular)).toBe('[object Object]');
  });
});
