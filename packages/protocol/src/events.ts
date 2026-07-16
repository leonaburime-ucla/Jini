import type { RunErrorPayload } from './errors.js';

/**
 * Transport-neutral run-event envelope. HTTP/SSE, CLI JSON-lines, MCP
 * notifications, and the sidecar wire format are each a projection of this
 * shape — none of them owns it (extraction-plan §12 C2: one canonical event
 * envelope, not an SSE-shaped one).
 */
export interface RunEvent<Name extends string, Payload> {
  /** Monotonic cursor for replay/reconnect (a transport's Last-Event-ID is one projection of this). Always assigned by the durable EventLog kernel port. */
  id: string;
  event: Name;
  data: Payload;
}

export type RunEventName<Event> = Event extends RunEvent<infer Name, unknown> ? Name : never;

export type RunEventPayload<Event, Name extends string> = Event extends RunEvent<Name, infer Payload>
  ? Payload
  : never;

export const RUN_PROTOCOL_VERSION = 1;

export interface RunStartPayload {
  runId: string;
  agentId?: string;
  protocolVersion?: typeof RUN_PROTOCOL_VERSION;
  /** Caller-supplied idempotency key; a duplicate start with the same key must replay the existing run rather than starting a second one. */
  idempotencyKey?: string;
}

export interface RunChunkPayload {
  chunk: string;
}

export interface RunEndPayload {
  code: number | null;
  signal?: string | null;
  status?: 'succeeded' | 'failed' | 'canceled';
  /** True when a `failed` run can be recovered by resuming the underlying agent-CLI session instead of starting a new run. */
  resumable?: boolean;
}

export type RunAgentPayload =
  | { type: 'status'; label: string; model?: string; ttftMs?: number; detail?: string }
  | { type: 'text_delta'; delta: string }
  | { type: 'thinking_start' }
  | { type: 'thinking_delta'; delta: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_input_delta'; id: string; name: string; delta: string }
  | { type: 'tool_result'; toolUseId: string; content: string; isError?: boolean }
  | { type: 'usage'; usage?: { input_tokens?: number; output_tokens?: number }; costUsd?: number; durationMs?: number }
  | { type: 'raw'; line: string };

export type RunProtocolEvent =
  | RunEvent<'start', RunStartPayload>
  | RunEvent<'agent', RunAgentPayload>
  | RunEvent<'stdout', RunChunkPayload>
  | RunEvent<'stderr', RunChunkPayload>
  | RunEvent<'error', RunErrorPayload>
  | RunEvent<'end', RunEndPayload>;
