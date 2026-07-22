/**
 * @module model-proxy
 *
 * `POST /api/proxy/anthropic/stream` and `POST /api/proxy/openai/stream` —
 * thin SSE route wrappers over `@jini/agent-runtime`'s new
 * `runAnthropicToolTurn`/`runOpenAiToolTurn` wire-adapter/turn-runners.
 * Implements the placement decision in `ADS-memory/reports/proposals/
 * PROP-http-route-packs-chat-model-proxy-2026-07-21.md`: OD's
 * `apps/daemon/src/routes/chat.ts` (2267 lines) genuinely is the largest
 * reusable route pack this package's routes-classification table ever
 * found, but its provider-specific wire-protocol knowledge (Anthropic
 * Messages API / OpenAI Chat Completions SSE parsing, tool-call-fragment
 * accumulation, the role-marker-guard contamination loop) does not belong
 * in `@jini/http` — this package has zero AI-provider knowledge anywhere
 * else in its surface, and that proposal recommended keeping it that way by
 * extending `@jini/agent-runtime`'s existing `providers/` pattern instead.
 * This module is the `@jini/http` half of that split: request parsing,
 * same-origin enforcement, and SSE transport (`sse.ts`, the same primitive
 * `runs.ts`/`memory.ts` already consume) — no knowledge of what an
 * Anthropic `content_block_delta` or an OpenAI `tool_calls[].function.
 * arguments` fragment looks like lives here.
 *
 * **Scope for this pass** (per the proposal's own recommendation): Anthropic
 * and OpenAI only — "the two most-used, and the ones `runTurn`/
 * `runAnthropicToolTurn` already show the clearest tool-loop pattern for."
 * Azure/Google/Ollama/OpenRouter proxy routes are deliberately not built
 * this round; see `source-map.md`'s dated section for the mechanical
 * follow-up note (each is expected to be a thin sibling module following
 * this exact request-parsing/SSE-wiring shape, once `@jini/agent-runtime`
 * grows the matching per-vendor turn-runner).
 *
 * **Deliberately excluded regardless of this decision** (confirmed
 * OD-PRODUCT per the proposal): `POST /api/runs/:id/feedback` and the two
 * "Critique Theater" routes. Not touched by this module at all.
 *
 * **BYOK, not server-held credentials.** Every request carries its own
 * `apiKey` (and optional `baseUrl`/`extraHeaders`) in the POST body, exactly
 * like `@jini/agent-runtime`'s existing `providers/model-catalog.ts` BYOK
 * surface — this route never stores or reads a server-side credential.
 *
 * **Tool execution is out of scope for this pass.** `ModelProxyHttpDeps`'s
 * `executeTool` hooks are optional and default to unset, matching
 * `packages/deploy/source-map.md`'s precedent for "deferred real
 * `ToolExecutor` wiring." With no executor supplied, a turn still streams
 * back any `tool_use`/`tool_calls` the model requests (so a caller can act
 * on them itself and start a fresh request with the results appended to
 * `messages`) — the turn-runner just does not attempt the server-side
 * tool-execution loop. See `anthropic-messages.ts`/`openai-chat.ts`'s own
 * docs for that behavior.
 */
import { randomUUID } from 'node:crypto';
import type { Express, Request, Response } from 'express';
import {
  runAnthropicToolTurn,
  runOpenAiToolTurn,
  type AnthropicMessageParam,
  type AnthropicToolCall,
  type AnthropicToolDef,
  type AnthropicToolExecutor,
  type AnthropicToolResult,
  type AnthropicTurnEvent,
  type OpenAiFunctionToolDef,
  type OpenAiMessageParam,
  type OpenAiToolCall,
  type OpenAiToolExecutor,
  type OpenAiToolResult,
  type OpenAiTurnEvent,
} from '@jini/agent-runtime';
import { createApiError } from '@jini/protocol';
import type { AdapterContext } from './adapter.js';
import { validationError } from './request.js';
import { sendApiError } from './response.js';
import { guardSameOrigin } from './origin.js';
import { createSseChannel, type SseEvent } from './sse.js';
import { err, ok, type Result } from './types.js';

/** Diagnostic detail for an internal-error response this route deliberately does not disclose to the client (SEC-005, matching `runs.ts#RunInternalErrorContext`). Only reached if a turn-runner's promise itself rejects — both turn-runners already convert every provider/network failure into an `'error'`+`'end'` event pair internally, so this is a genuinely unexpected-exception path (e.g. a caller-supplied `executeTool` throwing). */
export interface ModelProxyInternalErrorContext {
  readonly provider: 'anthropic' | 'openai';
  readonly correlationId: string;
  readonly error: unknown;
}

function defaultInternalErrorSink(context: ModelProxyInternalErrorContext): void {
  // eslint-disable-next-line no-console
  console.error(`[@jini/http] internal error (model-proxy/${context.provider}, correlationId=${context.correlationId})`, context.error);
}

export interface ModelProxyHttpDeps {
  /** Host-owned tool execution for the Anthropic proxy route. Omit to stream `tool_use` events without running a server-side tool loop (see module doc). */
  readonly anthropicExecuteTool?: AnthropicToolExecutor;
  /** Host-owned tool execution for the OpenAI proxy route. Same default-unset behavior as `anthropicExecuteTool`. */
  readonly openaiExecuteTool?: OpenAiToolExecutor;
  /** Host-owned sink for the real exception behind a generic internal-error SSE event (SEC-005). Defaults to `console.error`. */
  readonly onInternalError?: (context: ModelProxyInternalErrorContext) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

interface ParsedProxyCommon {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly model: string;
  readonly messages: unknown[];
  readonly temperature?: number;
  readonly maxToolTurns?: number;
  readonly extraHeaders?: Record<string, string>;
}

/**
 * Validates only the transport-level shape every proxied request shares
 * (non-empty `apiKey`/`model`, a `messages` array, and the optional numeric/
 * record fields' primitive types) — never the *contents* of `messages` or
 * `tools`, which is provider wire-protocol knowledge this package does not
 * have (see module doc). A malformed message/tool shape is instead rejected
 * by the real provider API and surfaces as a normal `'error'` SSE event,
 * exactly like any other upstream rejection.
 */
function parseCommon(body: unknown): Result<ParsedProxyCommon> {
  if (!isRecord(body)) return err(validationError('body must be a JSON object'));

  const apiKey = nonEmptyString(body.apiKey);
  if (!apiKey) {
    return err(validationError('apiKey must be a non-empty string', [{ path: 'apiKey', message: 'required non-empty string' }]));
  }
  const model = nonEmptyString(body.model);
  if (!model) {
    return err(validationError('model must be a non-empty string', [{ path: 'model', message: 'required non-empty string' }]));
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return err(validationError('messages must be a non-empty array', [{ path: 'messages', message: 'required non-empty array' }]));
  }
  if (body.baseUrl !== undefined && typeof body.baseUrl !== 'string') {
    return err(validationError('baseUrl must be a string when provided'));
  }
  if (body.temperature !== undefined && typeof body.temperature !== 'number') {
    return err(validationError('temperature must be a number when provided'));
  }
  if (body.maxToolTurns !== undefined && typeof body.maxToolTurns !== 'number') {
    return err(validationError('maxToolTurns must be a number when provided'));
  }
  if (body.extraHeaders !== undefined && !isRecord(body.extraHeaders)) {
    return err(validationError('extraHeaders must be an object when provided'));
  }

  return ok({
    apiKey,
    model,
    messages: body.messages,
    ...(body.baseUrl !== undefined ? { baseUrl: body.baseUrl as string } : {}),
    ...(body.temperature !== undefined ? { temperature: body.temperature as number } : {}),
    ...(body.maxToolTurns !== undefined ? { maxToolTurns: body.maxToolTurns as number } : {}),
    ...(body.extraHeaders !== undefined ? { extraHeaders: body.extraHeaders as Record<string, string> } : {}),
  });
}

interface ParsedAnthropicProxyRequest extends ParsedProxyCommon {
  readonly apiVersion?: string;
  readonly system?: string;
  readonly tools?: unknown[];
  readonly maxTokens: number;
}

function parseAnthropicProxyRequest(body: unknown): Result<ParsedAnthropicProxyRequest> {
  const common = parseCommon(body);
  if (!common.ok) return common;
  const record = body as Record<string, unknown>;

  if (typeof record.maxTokens !== 'number' || !Number.isFinite(record.maxTokens) || record.maxTokens <= 0) {
    return err(validationError('maxTokens must be a positive number', [{ path: 'maxTokens', message: 'required positive number' }]));
  }
  if (record.apiVersion !== undefined && typeof record.apiVersion !== 'string') {
    return err(validationError('apiVersion must be a string when provided'));
  }
  if (record.system !== undefined && typeof record.system !== 'string') {
    return err(validationError('system must be a string when provided'));
  }
  if (record.tools !== undefined && !Array.isArray(record.tools)) {
    return err(validationError('tools must be an array when provided'));
  }

  return ok({
    ...common.value,
    maxTokens: record.maxTokens,
    ...(record.apiVersion !== undefined ? { apiVersion: record.apiVersion as string } : {}),
    ...(record.system !== undefined ? { system: record.system as string } : {}),
    ...(record.tools !== undefined ? { tools: record.tools as unknown[] } : {}),
  });
}

interface ParsedOpenAiProxyRequest extends ParsedProxyCommon {
  readonly tools?: unknown[];
}

function parseOpenAiProxyRequest(body: unknown): Result<ParsedOpenAiProxyRequest> {
  const common = parseCommon(body);
  if (!common.ok) return common;
  const record = body as Record<string, unknown>;

  if (record.tools !== undefined && !Array.isArray(record.tools)) {
    return err(validationError('tools must be an array when provided'));
  }

  return ok({
    ...common.value,
    ...(record.tools !== undefined ? { tools: record.tools as unknown[] } : {}),
  });
}

interface ModelProxyStreamEvent extends SseEvent {
  readonly data: AnthropicTurnEvent | OpenAiTurnEvent;
}

/** Wraps a raw turn-runner event for `sse.ts`'s generic channel: `kind` drives both the wire `event:` field and `createSseChannel`'s `isEndEvent` auto-close, `data` preserves the exact event shape agent-runtime produced. */
function toStreamEvent(seq: number, event: AnthropicTurnEvent | OpenAiTurnEvent): ModelProxyStreamEvent {
  return { opaqueCursor: String(seq), kind: event.type, data: event };
}

/** Shared plumbing between the two provider routes: same-origin guard, request parsing, SSE channel lifecycle, and the SEC-005 catch-all for a turn-runner promise that rejects outright (see module doc). Provider-specific pieces (`parse`, `run`) are injected. */
function registerProxyStreamRoute<ParsedRequest, TurnEvent extends { type: string }>(
  app: Express,
  path: string,
  adapter: AdapterContext,
  provider: ModelProxyInternalErrorContext['provider'],
  onInternalError: (context: ModelProxyInternalErrorContext) => void,
  parse: (body: unknown) => Result<ParsedRequest>,
  run: (parsed: ParsedRequest, onEvent: (event: TurnEvent) => void) => Promise<unknown>,
): void {
  app.post(path, async (req: Request, res: Response) => {
    const origin = guardSameOrigin(req, adapter);
    if (!origin.ok) {
      sendApiError(res, 403, origin.error);
      return;
    }
    const parsed = parse(req.body);
    if (!parsed.ok) {
      sendApiError(res, 400, parsed.error);
      return;
    }

    let seq = 0;
    const channel = createSseChannel<ModelProxyStreamEvent>(res, { isEndEvent: (event) => event.kind === 'end' });
    channel.open();

    try {
      await run(parsed.value, (event) => channel.enqueue(toStreamEvent(seq++, event as unknown as AnthropicTurnEvent | OpenAiTurnEvent)));
      // No `channel.end()` call here: every reachable exit path inside both turn-runners emits
      // exactly one `'end'`-kind event before its promise resolves (the duplicate-end-event fix —
      // see `anthropic-messages.ts`/`openai-chat.ts`'s `turn-end-guard.ts` usage, and each
      // function's own `while (true)` loop, which cannot exit without first calling `emitEnd`), and
      // `isEndEvent` above already auto-closed the channel the instant that event was enqueued.
    } catch (error) {
      const correlationId = randomUUID();
      onInternalError({ provider, correlationId, error });
      // `enqueue` is a documented no-op once the channel is already closed (`sse.ts`), so these
      // two synthetic events are safe to send unconditionally: normally the channel is still open
      // here (an exception escaping `run` — e.g. a caller-supplied `executeTool` throwing — means
      // no `'end'` event was ever emitted for this connection), and the synthetic `'end'`-kind
      // event's own `isEndEvent` match closes the channel via the same path as a real one.
      channel.enqueue(
        toStreamEvent(seq++, {
          type: 'error',
          message: 'an internal error occurred',
          code: correlationId,
        } as unknown as AnthropicTurnEvent | OpenAiTurnEvent),
      );
      channel.enqueue(toStreamEvent(seq++, { type: 'end', reason: 'error' } as unknown as AnthropicTurnEvent | OpenAiTurnEvent));
    }
  });
}

/** Mounts `POST /api/proxy/anthropic/stream` and `POST /api/proxy/openai/stream`. */
export function registerModelProxyRoutes(app: Express, deps: ModelProxyHttpDeps, adapter: AdapterContext): void {
  const onInternalError = deps.onInternalError ?? defaultInternalErrorSink;

  registerProxyStreamRoute<ParsedAnthropicProxyRequest, AnthropicTurnEvent>(
    app,
    '/api/proxy/anthropic/stream',
    adapter,
    'anthropic',
    onInternalError,
    parseAnthropicProxyRequest,
    (parsed, onEvent) =>
      runAnthropicToolTurn({
        apiKey: parsed.apiKey,
        model: parsed.model,
        maxTokens: parsed.maxTokens,
        messages: parsed.messages as unknown as readonly AnthropicMessageParam[],
        onEvent,
        ...(parsed.baseUrl !== undefined ? { baseUrl: parsed.baseUrl } : {}),
        ...(parsed.apiVersion !== undefined ? { apiVersion: parsed.apiVersion } : {}),
        ...(parsed.system !== undefined ? { system: parsed.system } : {}),
        ...(parsed.tools !== undefined ? { tools: parsed.tools as unknown as readonly AnthropicToolDef[] } : {}),
        ...(parsed.temperature !== undefined ? { temperature: parsed.temperature } : {}),
        ...(parsed.maxToolTurns !== undefined ? { maxToolTurns: parsed.maxToolTurns } : {}),
        ...(parsed.extraHeaders !== undefined ? { extraHeaders: parsed.extraHeaders } : {}),
        ...(deps.anthropicExecuteTool
          ? {
              executeTool: (call: AnthropicToolCall): Promise<AnthropicToolResult> => deps.anthropicExecuteTool!(call),
            }
          : {}),
      }),
  );

  registerProxyStreamRoute<ParsedOpenAiProxyRequest, OpenAiTurnEvent>(
    app,
    '/api/proxy/openai/stream',
    adapter,
    'openai',
    onInternalError,
    parseOpenAiProxyRequest,
    (parsed, onEvent) =>
      runOpenAiToolTurn({
        apiKey: parsed.apiKey,
        model: parsed.model,
        messages: parsed.messages as unknown as readonly OpenAiMessageParam[],
        onEvent,
        ...(parsed.baseUrl !== undefined ? { baseUrl: parsed.baseUrl } : {}),
        ...(parsed.tools !== undefined ? { tools: parsed.tools as unknown as readonly OpenAiFunctionToolDef[] } : {}),
        ...(parsed.temperature !== undefined ? { temperature: parsed.temperature } : {}),
        ...(parsed.maxToolTurns !== undefined ? { maxToolTurns: parsed.maxToolTurns } : {}),
        ...(parsed.extraHeaders !== undefined ? { extraHeaders: parsed.extraHeaders } : {}),
        ...(deps.openaiExecuteTool
          ? {
              executeTool: (call: OpenAiToolCall): Promise<OpenAiToolResult> => deps.openaiExecuteTool!(call),
            }
          : {}),
      }),
  );
}
