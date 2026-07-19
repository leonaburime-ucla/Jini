import { describe, expect, it } from 'vitest';
import {
  createApiError,
  isTerminalRunState,
  RUN_PROTOCOL_VERSION,
  type ApiError,
  type RunCancelRequest,
  type RunProtocolEvent,
  type RunStatus,
} from '../index.js';

describe('@jini/protocol', () => {
  it('constructs a full run event sequence through the transport-neutral envelope', () => {
    const events: RunProtocolEvent[] = [
      { id: '0', event: 'start', data: { runId: 'run_1', protocolVersion: RUN_PROTOCOL_VERSION, idempotencyKey: 'req_1' } },
      { id: '1', event: 'agent', data: { type: 'text_delta', delta: 'hello' } },
      { id: '2', event: 'agent', data: { type: 'tool_use', id: 'tu_1', name: 'read_file', input: { path: 'a.ts' } } },
      { id: '3', event: 'agent', data: { type: 'tool_result', toolUseId: 'tu_1', content: 'ok' } },
      { id: '4', event: 'end', data: { code: 0, status: 'succeeded' } },
    ];

    expect(events).toHaveLength(5);
    expect(events[0]?.event).toBe('start');
    expect(events.at(-1)?.event).toBe('end');
  });

  it('carries a generic ApiError without any product-specific error code', () => {
    const error: ApiError = createApiError('VALIDATION_FAILED', 'missing field', {
      details: { field: 'name' },
      retryable: false,
    });

    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.details).toEqual({ field: 'name' });
  });

  it('tracks a run through queued -> running -> succeeded', () => {
    const run: RunStatus = { id: 'run_1', state: 'queued' };
    expect(isTerminalRunState(run.state)).toBe(false);

    const running: RunStatus = { ...run, state: 'running', startedAt: 1 };
    expect(isTerminalRunState(running.state)).toBe(false);

    const done: RunStatus = { ...running, state: 'succeeded', endedAt: 2 };
    expect(isTerminalRunState(done.state)).toBe(true);
  });

  it('models a cancellation request against a run id, not a transport detail', () => {
    const cancel: RunCancelRequest = { runId: 'run_1', reason: 'user requested' };
    expect(cancel.runId).toBe('run_1');
  });
});
