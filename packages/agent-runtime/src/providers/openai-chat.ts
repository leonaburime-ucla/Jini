/**
 * @module providers/openai-chat
 *
 * OpenAI Chat Completions API wire adapter + tool-loop turn-runner. Built
 * fresh against OpenAI's real, current public API docs/reference
 * (`developers.openai.com/api/docs/guides/function-calling` for the
 * `tools`/`tool_calls`/tool-result-message shapes; the streaming delta
 * accumulation shape below matches the long-stable, widely-documented
 * `chat.completion.chunk` SSE format every OpenAI-compatible gateway this
 * package's `providers/model-catalog.ts` already targets — `openai`/
 * `senseaudio`/`aihubmix` protocols — implements identically), per this
 * repo's "verify against real API docs, don't guess from memory"
 * convention. Only the *shape* (a turn-runner with a tool-execution loop)
 * is modeled on OD's `apps/daemon/src/routes/chat.ts`'s `runTurn` per
 * `ADS-memory/reports/proposals/PROP-http-route-packs-chat-model-proxy-
 * 2026-07-21.md` — this task did not have direct access to that file.
 * Sibling of `anthropic-messages.ts`; see that module's header for the
 * shared design rationale (package placement, `extraHeaders` fix for the
 * confirmed OpenRouter product-identity leak, the `turn-end-guard.ts` fix
 * for the confirmed duplicate-`end`-event bug — both apply identically
 * here).
 */
import { createRoleMarkerGuard } from '../role-marker-guard.js';
import { redactSecrets, validateBaseUrl } from './connection-guard.js';
import { decodeSseStream } from './sse-decode.js';
import { createTurnEndGuard, type TurnEndReason } from './turn-end-guard.js';

export interface OpenAiFunctionToolDef {
  readonly type: 'function';
  readonly function: {
    readonly name: string;
    readonly description?: string;
    readonly parameters: Record<string, unknown>;
  };
}

export interface OpenAiToolCallParam {
  readonly id: string;
  readonly type: 'function';
  readonly function: { readonly name: string; readonly arguments: string };
}

export interface OpenAiMessageParam {
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  readonly content: string | null;
  readonly tool_calls?: readonly OpenAiToolCallParam[];
  readonly tool_call_id?: string;
  readonly name?: string;
}

export interface OpenAiToolCall {
  readonly id: string;
  readonly name: string;
  readonly input: unknown;
}

export interface OpenAiToolResult {
  readonly content: string;
}

/** Host-owned tool execution — same "the collaborator is always supplied" convention as `anthropic-messages.ts#AnthropicToolExecutor`. */
export type OpenAiToolExecutor = (call: OpenAiToolCall) => Promise<OpenAiToolResult>;

export type OpenAiTurnEndReason = TurnEndReason;

export type OpenAiTurnEvent =
  | { readonly type: 'status'; readonly label: string }
  | { readonly type: 'text_delta'; readonly delta: string }
  | { readonly type: 'tool_use'; readonly id: string; readonly name: string; readonly input: unknown }
  | { readonly type: 'tool_result'; readonly toolUseId: string; readonly content: string; readonly isError: boolean }
  | { readonly type: 'usage'; readonly usage: Record<string, unknown> | null }
  | { readonly type: 'fabricated_role_marker'; readonly marker: string; readonly messageId: string }
  | { readonly type: 'error'; readonly message: string; readonly code?: string }
  | { readonly type: 'end'; readonly reason: OpenAiTurnEndReason };

export interface OpenAiTurnOptions {
  readonly apiKey: string;
  /** Defaults to `https://api.openai.com`. Overridable for OpenAI-compatible gateways (matching `providers/model-catalog.ts`'s `openai`-protocol `baseUrl` convention). */
  readonly baseUrl?: string;
  readonly model: string;
  readonly messages: readonly OpenAiMessageParam[];
  readonly tools?: readonly OpenAiFunctionToolDef[];
  readonly temperature?: number;
  /** Same bound and rationale as `AnthropicTurnOptions.maxToolTurns`. Defaults to 8. */
  readonly maxToolTurns?: number;
  readonly executeTool?: OpenAiToolExecutor;
  readonly onEvent: (event: OpenAiTurnEvent) => void;
  readonly signal?: AbortSignal;
  /** Caller-supplied extra headers — see `anthropic-messages.ts#AnthropicTurnOptions.extraHeaders`'s doc for why this exists and what it fixes. */
  readonly extraHeaders?: Record<string, string>;
}

export interface OpenAiTurnResult {
  readonly finishReason: string | null;
  readonly toolTurns: number;
}

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com';
const DEFAULT_MAX_TOOL_TURNS = 8;
const DONE_SENTINEL = '[DONE]';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function openAiRequestUrl(baseUrl: string | undefined): string {
  const base = (baseUrl ?? DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, '');
  return /\/v\d+(\/|$)/.test(base) ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
}

function openAiHeaders(options: OpenAiTurnOptions): Record<string, string> {
  return {
    'content-type': 'application/json',
    authorization: `Bearer ${options.apiKey}`,
    ...(options.extraHeaders ?? {}),
  };
}

function openAiRequestBody(options: OpenAiTurnOptions, messages: readonly OpenAiMessageParam[]): Record<string, unknown> {
  return {
    model: options.model,
    stream: true,
    stream_options: { include_usage: true },
    messages,
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    ...(options.tools && options.tools.length > 0 ? { tools: options.tools } : {}),
  };
}

function extractOpenAiErrorDetail(rawText: string): string {
  try {
    const parsed: unknown = JSON.parse(rawText);
    if (isRecord(parsed) && isRecord(parsed.error) && typeof parsed.error.message === 'string') {
      return parsed.error.message;
    }
  } catch {
    // Non-JSON error body — fall through to the raw text below.
  }
  return rawText.trim().slice(0, 500);
}

interface PendingToolCall {
  id: string;
  name: string;
  argsJson: string;
}

interface SingleRequestOutcome {
  readonly finishReason: string | null;
  readonly toolCalls: readonly OpenAiToolCall[];
  readonly text: string;
}

/** Runs exactly one OpenAI Chat Completions streaming request and reduces its SSE events into a single outcome. Mirrors `anthropic-messages.ts#runSingleAnthropicRequest`'s `emitEnd` contract — see that function's doc. */
async function runSingleOpenAiRequest(
  options: OpenAiTurnOptions,
  messages: readonly OpenAiMessageParam[],
  emitEnd: (reason: OpenAiTurnEndReason) => void,
  hasEnded: () => boolean,
): Promise<SingleRequestOutcome> {
  const { onEvent } = options;

  const baseUrlCheck = validateBaseUrl(options.baseUrl ?? DEFAULT_OPENAI_BASE_URL);
  if (baseUrlCheck.error) {
    onEvent({ type: 'error', message: baseUrlCheck.error });
    emitEnd('error');
    return { finishReason: null, toolCalls: [], text: '' };
  }

  let response: { ok: boolean; status: number; body: AsyncIterable<Uint8Array | string> | null; text(): Promise<string> };
  try {
    response = (await fetch(openAiRequestUrl(options.baseUrl), {
      method: 'POST',
      headers: openAiHeaders(options),
      body: JSON.stringify(openAiRequestBody(options, messages)),
      ...(options.signal ? { signal: options.signal } : {}),
    })) as unknown as typeof response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    onEvent({ type: 'error', message: redactSecrets(message, [options.apiKey]) });
    emitEnd('error');
    return { finishReason: null, toolCalls: [], text: '' };
  }

  if (!response.ok) {
    const rawText = await response.text();
    onEvent({
      type: 'error',
      message: redactSecrets(extractOpenAiErrorDetail(rawText), [options.apiKey]),
      code: String(response.status),
    });
    emitEnd('error');
    return { finishReason: null, toolCalls: [], text: '' };
  }
  if (!response.body) {
    onEvent({ type: 'error', message: 'OpenAI response had no body' });
    emitEnd('error');
    return { finishReason: null, toolCalls: [], text: '' };
  }

  onEvent({ type: 'status', label: 'requesting' });

  const guard = createRoleMarkerGuard('openai-turn');
  const toolCalls = new Map<number, PendingToolCall>();
  let fullText = '';
  let finishReason: string | null = null;
  let usage: Record<string, unknown> | null = null;

  for await (const frame of decodeSseStream(response.body)) {
    // No `hasEnded()` re-check at the top of this loop: the only in-loop call to `emitEnd`
    // (contamination, below) is immediately followed by `break`, and every other call site is a
    // pre-loop early `return` — traced across all five call sites in this function, same proof as
    // `anthropic-messages.ts#runSingleAnthropicRequest`. `hasEnded()` is still consulted once,
    // after this loop, to decide whether pending tool_use events should still be emitted (a
    // contaminating delta can arrive on a *later* chunk than the one that set `finish_reason`).
    if (frame.data === DONE_SENTINEL) break;

    let data: unknown;
    try {
      data = JSON.parse(frame.data);
    } catch {
      continue; // tolerate a malformed/empty keep-alive frame
    }
    if (!isRecord(data)) continue;

    if (isRecord(data.usage)) {
      usage = data.usage;
      onEvent({ type: 'usage', usage });
    }

    const choices = Array.isArray(data.choices) ? data.choices : [];
    const choice = choices[0];
    if (!isRecord(choice)) continue;

    if (typeof choice.finish_reason === 'string') {
      finishReason = choice.finish_reason;
    }

    const delta = isRecord(choice.delta) ? choice.delta : null;
    if (!delta) continue;

    if (typeof delta.content === 'string' && delta.content.length > 0) {
      // No `guard.contaminated` pre-check here: the only way it becomes true is the
      // `emitEnd('contaminated'); break;` a few lines below, which exits this loop immediately —
      // see `anthropic-messages.ts#runSingleAnthropicRequest`'s identical reachability proof.
      const safe = guard.feedText(delta.content);
      if (safe.length > 0) {
        fullText += safe;
        onEvent({ type: 'text_delta', delta: safe });
      }
      if (guard.contaminated) {
        const warn = guard.warningEvent();
        if (warn) onEvent(warn);
        emitEnd('contaminated');
        break;
      }
    }

    if (Array.isArray(delta.tool_calls)) {
      for (const rawCall of delta.tool_calls) {
        if (!isRecord(rawCall) || typeof rawCall.index !== 'number') continue;
        let pending = toolCalls.get(rawCall.index);
        if (!pending) {
          const id = typeof rawCall.id === 'string' ? rawCall.id : `call_${rawCall.index}`;
          const fn = isRecord(rawCall.function) ? rawCall.function : {};
          const name = typeof fn.name === 'string' ? fn.name : '';
          pending = { id, name, argsJson: '' };
          toolCalls.set(rawCall.index, pending);
        }
        const fn = isRecord(rawCall.function) ? rawCall.function : null;
        if (fn && typeof fn.arguments === 'string') {
          pending.argsJson += fn.arguments;
        }
      }
    }
  }

  const resolvedToolCalls: OpenAiToolCall[] = Array.from(toolCalls.values()).map((call) => {
    let input: unknown = {};
    if (call.argsJson.trim()) {
      try {
        input = JSON.parse(call.argsJson);
      } catch {
        input = {};
      }
    }
    return { id: call.id, name: call.name, input };
  });

  if (finishReason === 'tool_calls' && !hasEnded()) {
    for (const call of resolvedToolCalls) {
      onEvent({ type: 'tool_use', id: call.id, name: call.name, input: call.input });
    }
  }

  return { finishReason, toolCalls: resolvedToolCalls, text: fullText };
}

/**
 * Runs a full OpenAI Chat Completions turn, including the tool-execution
 * loop when `options.executeTool` is supplied and the model requests a
 * function call. See `anthropic-messages.ts#runAnthropicToolTurn`'s doc for
 * the shared event-stream/`ended`-flag contract this mirrors exactly.
 */
export async function runOpenAiToolTurn(options: OpenAiTurnOptions): Promise<OpenAiTurnResult> {
  const maxToolTurns = options.maxToolTurns ?? DEFAULT_MAX_TOOL_TURNS;

  const endGuard = createTurnEndGuard<OpenAiTurnEvent>(options.onEvent, (reason) => ({ type: 'end', reason }));
  const emitEnd = endGuard.emitEnd;

  let messages = options.messages.slice();
  let toolTurns = 0;
  let lastFinishReason: string | null = null;

  while (true) {
    const outcome = await runSingleOpenAiRequest(options, messages, emitEnd, endGuard.hasEnded);
    lastFinishReason = outcome.finishReason;

    if (endGuard.hasEnded()) break;

    if (outcome.finishReason !== 'tool_calls' || outcome.toolCalls.length === 0) {
      emitEnd('stop');
      break;
    }
    if (!options.executeTool) {
      emitEnd('stop');
      break;
    }
    if (toolTurns >= maxToolTurns) {
      emitEnd('max_tool_turns');
      break;
    }
    toolTurns += 1;

    const assistantToolCalls: OpenAiToolCallParam[] = outcome.toolCalls.map((call) => ({
      id: call.id,
      type: 'function',
      function: { name: call.name, arguments: JSON.stringify(call.input) },
    }));
    const toolResultMessages: OpenAiMessageParam[] = [];
    for (const call of outcome.toolCalls) {
      const result = await options.executeTool(call);
      options.onEvent({ type: 'tool_result', toolUseId: call.id, content: result.content, isError: false });
      toolResultMessages.push({ role: 'tool', content: result.content, tool_call_id: call.id });
    }

    messages = [
      ...messages,
      { role: 'assistant', content: outcome.text || null, tool_calls: assistantToolCalls },
      ...toolResultMessages,
    ];
  }

  return { finishReason: lastFinishReason, toolTurns };
}
