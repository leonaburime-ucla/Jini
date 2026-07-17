import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useRunStream } from './useRunStream.js';
import { createFakeChatTransport } from './testing/fake-transport.js';

describe('useRunStream', () => {
  it('starts idle', () => {
    const transport = createFakeChatTransport();
    const { result } = renderHook(() => useRunStream(transport));
    expect(result.current.status).toBe('idle');
    expect(result.current.events).toEqual([]);
    expect(result.current.runId).toBeNull();
  });

  it('streams events from start() and accumulates them in order', async () => {
    const transport = createFakeChatTransport();
    const { result } = renderHook(() => useRunStream(transport));

    await act(async () => {
      await result.current.start({ history: [] });
    });
    expect(result.current.runId).toBe('run-1');
    expect(result.current.isStreaming).toBe(true);

    act(() => transport.emit({ kind: 'text', text: 'hello' }));
    expect(result.current.events).toEqual([{ kind: 'text', text: 'hello' }]);

    act(() => transport.emit({ kind: 'tool_use', id: 't1', name: 'Bash', input: { command: 'ls' } }));
    expect(result.current.events).toHaveLength(2);

    act(() => transport.finish());
    expect(result.current.status).toBe('done');
  });

  it('buffers live tool-input deltas by tool id, ephemeral only', async () => {
    const transport = createFakeChatTransport();
    const { result } = renderHook(() => useRunStream(transport));
    await act(async () => {
      await result.current.start({ history: [] });
    });
    act(() => transport.emitToolInputDelta('t1', 'Write', '{"file'));
    act(() => transport.emitToolInputDelta('t1', 'Write', '_path":"a.txt"}'));
    expect(result.current.toolInputDeltas.t1).toBe('{"file_path":"a.txt"}');
    // A fresh start() must clear stale deltas from the previous run.
    await act(async () => {
      await result.current.start({ history: [] });
    });
    expect(result.current.toolInputDeltas).toEqual({});
  });

  it('surfaces transport errors via onError', async () => {
    const transport = createFakeChatTransport();
    const { result } = renderHook(() => useRunStream(transport));
    await act(async () => {
      await result.current.start({ history: [] });
    });
    act(() => transport.fail(new Error('boom')));
    expect(result.current.status).toBe('error');
    expect(result.current.error?.message).toBe('boom');
  });

  it('cancel() stops the run via the transport and marks status canceled', async () => {
    const transport = createFakeChatTransport();
    const { result } = renderHook(() => useRunStream(transport));
    await act(async () => {
      await result.current.start({ history: [] });
    });
    act(() => result.current.cancel());
    expect(result.current.status).toBe('canceled');
    expect(transport.stoppedRunIds).toEqual(['run-1']);

    // A late event from the aborted subscription must not resurrect state —
    // this is the stale-generation guard.
    act(() => transport.emit({ kind: 'text', text: 'too-late' }));
    expect(result.current.events).toEqual([]);
    expect(result.current.status).toBe('canceled');
  });

  it('reattach() resumes an existing run, seeded with prior persisted events, then keeps streaming', async () => {
    const transport = createFakeChatTransport();
    const { result } = renderHook(() => useRunStream(transport));
    const priorEvents = [{ kind: 'text' as const, text: 'earlier' }];

    await act(async () => {
      await result.current.reattach('run-existing', priorEvents);
    });
    expect(result.current.runId).toBe('run-existing');
    expect(result.current.events).toEqual(priorEvents);
    expect(result.current.isStreaming).toBe(true);
    expect(transport.reattachCalls).toHaveLength(1);
    expect(transport.reattachCalls[0]?.runId).toBe('run-existing');

    act(() => transport.emit({ kind: 'text', text: ' more' }));
    expect(result.current.events).toEqual([...priorEvents, { kind: 'text', text: ' more' }]);

    act(() => transport.finish());
    expect(result.current.status).toBe('done');
  });

  it('a second start() supersedes the first — stale-generation events from the first are dropped', async () => {
    const transport = createFakeChatTransport();
    const { result } = renderHook(() => useRunStream(transport));

    await act(async () => {
      await result.current.start({ history: [] });
    });
    const firstRunHandlers = transport.calls[0]!.handlers;

    await act(async () => {
      await result.current.start({ history: [] });
    });
    expect(result.current.runId).toBe('run-2');

    // Simulate a straggling callback from the first (superseded) subscription.
    act(() => firstRunHandlers.onEvent({ kind: 'text', text: 'stale' }));
    expect(result.current.events).toEqual([]);

    act(() => transport.emit({ kind: 'text', text: 'fresh' }));
    expect(result.current.events).toEqual([{ kind: 'text', text: 'fresh' }]);
  });

  it('reset() clears state back to idle without calling the transport', async () => {
    const transport = createFakeChatTransport();
    const { result } = renderHook(() => useRunStream(transport));
    await act(async () => {
      await result.current.start({ history: [] });
    });
    act(() => transport.emit({ kind: 'text', text: 'x' }));
    act(() => result.current.reset());
    expect(result.current.status).toBe('idle');
    expect(result.current.events).toEqual([]);
    expect(result.current.runId).toBeNull();
    expect(transport.stoppedRunIds).toEqual([]);
  });
});
