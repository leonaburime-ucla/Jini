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
  | { type: 'raw'; line: string }
  /**
   * Announces a named sub-stage of a multi-step agent run beginning/ending — generic scaffolding
   * for any driver that structures its work into stages (a build pipeline, a multi-pass review,
   * a plan/execute/verify loop), not tied to any one product's own pipeline concept. Added for
   * `@jini/agui`'s generalization of OD's `pipeline_stage_started`/`pipeline_stage_completed`
   * events — see `packages/agui/source-map.md` for the full reasoning and two-consumer
   * justification. Flows through the existing `RunLifecycle.emit('agent', ...)` channel exactly
   * like `tool_use`/`tool_result` already do; no driver in this codebase produces these yet.
   */
  | { type: 'stage_start'; stageId: string; label?: string; iteration?: number }
  | { type: 'stage_end'; stageId: string; iteration?: number }
  /**
   * A human-in-the-loop request/response pair: the agent asks a structured question (with an
   * opaque, caller-defined `payload`) and gets an arbitrary `value` back. Generic scaffolding for
   * "the agent needs the user to answer something mid-run" — not a UI component/data-binding
   * protocol (see the real, much larger A2UI spec at a2ui.org for that different, out-of-scope
   * problem). Added for `@jini/agui`'s generalization of OD's `genui_surface_request`/
   * `genui_surface_response`/`genui_surface_timeout` events — see `packages/agui/source-map.md`.
   * A timeout is represented as a `surface_response` with `respondedBy: 'auto'`, mirroring OD's
   * own collapsing of its two response-shaped event kinds into one. No driver in this codebase
   * produces these yet.
   */
  | { type: 'surface_request'; surfaceId: string; surfaceKind: 'form' | 'choice' | 'confirmation' | 'oauth-prompt'; payload: unknown }
  | { type: 'surface_response'; surfaceId: string; value: unknown; respondedBy: 'user' | 'agent' | 'auto' | 'cache' };

export type RunProtocolEvent =
  | RunEvent<'start', RunStartPayload>
  | RunEvent<'agent', RunAgentPayload>
  | RunEvent<'stdout', RunChunkPayload>
  | RunEvent<'stderr', RunChunkPayload>
  | RunEvent<'error', RunErrorPayload>
  | RunEvent<'end', RunEndPayload>;
