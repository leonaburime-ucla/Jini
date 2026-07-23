/**
 * @module providers/ollama-chat
 *
 * Ollama Chat Completions wire adapter + tool-loop turn-runner. Sibling of
 * `anthropic-messages.ts`/`openai-chat.ts` — see those modules' headers for
 * the shared design rationale. Targets Ollama's OpenAI-compatible
 * `/v1/chat/completions` endpoint (documented at
 * `github.com/ollama/ollama/blob/main/docs/openai.md`) rather than Ollama's
 * own native `/api/chat` wire format — the OpenAI-compatible surface is
 * byte-identical to plain OpenAI's chat-completions JSON, so this module
 * reuses `openai-chat.ts`'s extracted `runOpenAiCompatibleRequest`
 * SSE-reduction loop rather than duplicating it.
 *
 * **Local-first design call (already approved):** `baseUrl` defaults to
 * `http://localhost:11434` — a real local Ollama install needs no
 * configuration to work out of the box. `validateBaseUrl`'s loopback
 * carve-out (see `connection-guard.ts`'s doc: "Loopback is intentionally
 * allowed... for local LLM servers like Ollama") is exactly what makes this
 * safe under the shared SSRF guard.
 *
 * **No required `apiKey`:** unlike every other provider in this package,
 * local Ollama has no auth of its own. `apiKey` is optional on
 * {@link OllamaTurnOptions}; when omitted, no `authorization` header is
 * sent at all (not even `Bearer undefined`) — see `ollamaHeaders`. A
 * caller pointing this adapter at a *remote*, key-gated Ollama-compatible
 * gateway can still supply one.
 */
import { defaultDnsLookup, validateBaseUrlResolved } from './connection-guard.js';
import { runOpenAiCompatibleRequest, type OpenAiCompatibleRequestOutcome } from './openai-chat.js';
import { createTurnEndGuard, type TurnEndReason } from './turn-end-guard.js';

export interface OllamaFunctionToolDef {
  readonly type: 'function';
  readonly function: {
    readonly name: string;
    readonly description?: string;
    readonly parameters: Record<string, unknown>;
  };
}

export interface OllamaToolCallParam {
  readonly id: string;
  readonly type: 'function';
  readonly function: { readonly name: string; readonly arguments: string };
}

export interface OllamaMessageParam {
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  readonly content: string | null;
  readonly tool_calls?: readonly OllamaToolCallParam[];
  readonly tool_call_id?: string;
  readonly name?: string;
}

export interface OllamaToolCall {
  readonly id: string;
  readonly name: string;
  readonly input: unknown;
}

export interface OllamaToolResult {
  readonly content: string;
}

/** Host-owned tool execution — same "the collaborator is always supplied" convention as `anthropic-messages.ts#AnthropicToolExecutor`. */
export type OllamaToolExecutor = (call: OllamaToolCall) => Promise<OllamaToolResult>;

export type OllamaTurnEndReason = TurnEndReason;

export type OllamaTurnEvent =
  | { readonly type: 'status'; readonly label: string }
  | { readonly type: 'text_delta'; readonly delta: string }
  | { readonly type: 'tool_use'; readonly id: string; readonly name: string; readonly input: unknown }
  | { readonly type: 'tool_result'; readonly toolUseId: string; readonly content: string; readonly isError: boolean }
  | { readonly type: 'usage'; readonly usage: Record<string, unknown> | null }
  | { readonly type: 'fabricated_role_marker'; readonly marker: string; readonly messageId: string }
  | { readonly type: 'error'; readonly message: string; readonly code?: string }
  | { readonly type: 'end'; readonly reason: OllamaTurnEndReason };

export interface OllamaTurnOptions {
  /** Optional — see module doc. Local Ollama needs no auth. */
  readonly apiKey?: string;
  /** Defaults to `http://localhost:11434` — see module doc. */
  readonly baseUrl?: string;
  readonly model: string;
  readonly messages: readonly OllamaMessageParam[];
  readonly tools?: readonly OllamaFunctionToolDef[];
  readonly temperature?: number;
  /** Same bound and rationale as `AnthropicTurnOptions.maxToolTurns`. Defaults to 8. */
  readonly maxToolTurns?: number;
  readonly executeTool?: OllamaToolExecutor;
  readonly onEvent: (event: OllamaTurnEvent) => void;
  readonly signal?: AbortSignal;
  /** Caller-supplied extra headers — see `anthropic-messages.ts#AnthropicTurnOptions.extraHeaders`'s doc for why this exists and what it fixes. */
  readonly extraHeaders?: Record<string, string>;
}

export interface OllamaTurnResult {
  readonly finishReason: string | null;
  readonly toolTurns: number;
}

const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';
const DEFAULT_MAX_TOOL_TURNS = 8;

function ollamaRequestUrl(baseUrl: string | undefined): string {
  const base = (baseUrl ?? DEFAULT_OLLAMA_BASE_URL).replace(/\/+$/, '');
  return /\/v\d+(\/|$)/.test(base) ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
}

/** No `authorization` header at all when `apiKey` is omitted — a bare `Bearer` with no token is worse than no header, and a local Ollama install rejects neither. */
function ollamaHeaders(options: OllamaTurnOptions): Record<string, string> {
  return {
    'content-type': 'application/json',
    ...(options.apiKey ? { authorization: `Bearer ${options.apiKey}` } : {}),
    ...(options.extraHeaders ?? {}),
  };
}

function ollamaRequestBody(options: OllamaTurnOptions, messages: readonly OllamaMessageParam[]): Record<string, unknown> {
  return {
    model: options.model,
    stream: true,
    stream_options: { include_usage: true },
    messages,
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    ...(options.tools && options.tools.length > 0 ? { tools: options.tools } : {}),
  };
}

/** Validates `options.baseUrl`, then delegates to `openai-chat.ts#runOpenAiCompatibleRequest` with Ollama's own URL/header/body builders. */
async function runSingleOllamaRequest(
  options: OllamaTurnOptions,
  messages: readonly OllamaMessageParam[],
  emitEnd: (reason: OllamaTurnEndReason) => void,
  hasEnded: () => boolean,
): Promise<OpenAiCompatibleRequestOutcome> {
  const baseUrlCheck = await validateBaseUrlResolved(options.baseUrl ?? DEFAULT_OLLAMA_BASE_URL, defaultDnsLookup);
  if (baseUrlCheck.error) {
    options.onEvent({ type: 'error', message: baseUrlCheck.error });
    emitEnd('error');
    return { finishReason: null, toolCalls: [], text: '' };
  }

  return runOpenAiCompatibleRequest({
    url: ollamaRequestUrl(options.baseUrl),
    headers: ollamaHeaders(options),
    body: ollamaRequestBody(options, messages),
    ...(options.signal ? { signal: options.signal } : {}),
    redactSecretsList: [options.apiKey],
    guardMessageId: 'ollama-turn',
    providerLabel: 'Ollama',
    onEvent: options.onEvent,
    emitEnd,
    hasEnded,
  });
}

/**
 * Runs a full Ollama (OpenAI-compatible) Chat Completions turn, including
 * the tool-execution loop when `options.executeTool` is supplied and the
 * model requests a function call. See
 * `anthropic-messages.ts#runAnthropicToolTurn`'s doc for the shared
 * event-stream/`ended`-flag contract this mirrors exactly.
 */
export async function runOllamaToolTurn(options: OllamaTurnOptions): Promise<OllamaTurnResult> {
  const maxToolTurns = options.maxToolTurns ?? DEFAULT_MAX_TOOL_TURNS;

  const endGuard = createTurnEndGuard<OllamaTurnEvent>(options.onEvent, (reason) => ({ type: 'end', reason }));
  const emitEnd = endGuard.emitEnd;

  let messages = options.messages.slice();
  let toolTurns = 0;
  let lastFinishReason: string | null = null;

  while (true) {
    const outcome = await runSingleOllamaRequest(options, messages, emitEnd, endGuard.hasEnded);
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

    const assistantToolCalls: OllamaToolCallParam[] = outcome.toolCalls.map((call) => ({
      id: call.id,
      type: 'function',
      function: { name: call.name, arguments: JSON.stringify(call.input) },
    }));
    const toolResultMessages: OllamaMessageParam[] = [];
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
