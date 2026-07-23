/**
 * @module providers/azure-chat
 *
 * Azure OpenAI Chat Completions wire adapter + tool-loop turn-runner.
 * Sibling of `anthropic-messages.ts`/`openai-chat.ts` — see those modules'
 * headers for the shared design rationale. Azure OpenAI's chat-completions
 * JSON request/response body is byte-identical to plain OpenAI's (same
 * `messages`/`tools`/streaming-delta shape) — only the URL and the auth
 * header differ — so this module reuses `openai-chat.ts`'s extracted
 * `runOpenAiCompatibleRequest` SSE-reduction loop rather than duplicating
 * it; see that function's doc for why it was pulled out.
 *
 * **URL**: `{baseUrl}/openai/deployments/{model}/chat/completions
 * ?api-version={apiVersion}` — `model` here is the Azure *deployment name*,
 * not a model id (Azure OpenAI resources map a deployment name to a
 * specific model version at resource-creation time). `apiVersion` defaults
 * to `'2024-10-21'`, the default this repo's real OD predecessor used for
 * its own azure chat-completions proxy route (`apps/daemon/src/routes/
 * chat.ts`'s `[proxy:azure]` handler, confirmed by reading that file
 * directly in a sibling checkout — see `source-map.md`'s dated entry).
 * That source additionally branches on whether `baseUrl` already contains
 * a versioned `/openai/v1` path (a newer Azure OpenAI API preview) and
 * retries with `max_completion_tokens` instead of `max_tokens` on a 400
 * from an older deployment; both are deliberately not carried forward here
 * — this adapter targets the one documented, stable URL/body shape per
 * this task's approved scope ("byte-identical to OpenAI, only URL/auth
 * differ").
 *
 * **Auth**: `api-key: {apiKey}` header — NOT `Authorization: Bearer`,
 * Azure OpenAI's own convention (also confirmed against the same OD
 * source above).
 *
 * **No default `baseUrl`**: every Azure OpenAI resource has its own
 * endpoint (`https://{resource}.openai.azure.com`), so unlike Anthropic/
 * OpenAI/Google/Ollama, `baseUrl` is a required field on
 * {@link AzureTurnOptions}, and `apiVersion` is validated as
 * non-empty-if-supplied by the caller (`@jini/http`'s
 * `parseAzureProxyRequest` — see that module).
 */
import { validateBaseUrl } from './connection-guard.js';
import { runOpenAiCompatibleRequest, type OpenAiCompatibleRequestOutcome } from './openai-chat.js';
import { createTurnEndGuard, type TurnEndReason } from './turn-end-guard.js';

export interface AzureFunctionToolDef {
  readonly type: 'function';
  readonly function: {
    readonly name: string;
    readonly description?: string;
    readonly parameters: Record<string, unknown>;
  };
}

export interface AzureToolCallParam {
  readonly id: string;
  readonly type: 'function';
  readonly function: { readonly name: string; readonly arguments: string };
}

export interface AzureMessageParam {
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  readonly content: string | null;
  readonly tool_calls?: readonly AzureToolCallParam[];
  readonly tool_call_id?: string;
  readonly name?: string;
}

export interface AzureToolCall {
  readonly id: string;
  readonly name: string;
  readonly input: unknown;
}

export interface AzureToolResult {
  readonly content: string;
}

/** Host-owned tool execution — same "the collaborator is always supplied" convention as `anthropic-messages.ts#AnthropicToolExecutor`. */
export type AzureToolExecutor = (call: AzureToolCall) => Promise<AzureToolResult>;

export type AzureTurnEndReason = TurnEndReason;

export type AzureTurnEvent =
  | { readonly type: 'status'; readonly label: string }
  | { readonly type: 'text_delta'; readonly delta: string }
  | { readonly type: 'tool_use'; readonly id: string; readonly name: string; readonly input: unknown }
  | { readonly type: 'tool_result'; readonly toolUseId: string; readonly content: string; readonly isError: boolean }
  | { readonly type: 'usage'; readonly usage: Record<string, unknown> | null }
  | { readonly type: 'fabricated_role_marker'; readonly marker: string; readonly messageId: string }
  | { readonly type: 'error'; readonly message: string; readonly code?: string }
  | { readonly type: 'end'; readonly reason: AzureTurnEndReason };

export interface AzureTurnOptions {
  readonly apiKey: string;
  /** Required — every Azure OpenAI resource has its own endpoint, so there is no sane global default (see module doc). */
  readonly baseUrl: string;
  /** The Azure OpenAI *deployment name* (not a raw model id). */
  readonly model: string;
  /** Defaults to `'2024-10-21'` — see module doc for provenance. */
  readonly apiVersion?: string;
  readonly messages: readonly AzureMessageParam[];
  readonly tools?: readonly AzureFunctionToolDef[];
  readonly temperature?: number;
  /** Same bound and rationale as `AnthropicTurnOptions.maxToolTurns`. Defaults to 8. */
  readonly maxToolTurns?: number;
  readonly executeTool?: AzureToolExecutor;
  readonly onEvent: (event: AzureTurnEvent) => void;
  readonly signal?: AbortSignal;
  /** Caller-supplied extra headers — see `anthropic-messages.ts#AnthropicTurnOptions.extraHeaders`'s doc for why this exists and what it fixes. */
  readonly extraHeaders?: Record<string, string>;
}

export interface AzureTurnResult {
  readonly finishReason: string | null;
  readonly toolTurns: number;
}

const DEFAULT_AZURE_API_VERSION = '2024-10-21';
const DEFAULT_MAX_TOOL_TURNS = 8;

function azureRequestUrl(baseUrl: string, model: string, apiVersion: string | undefined): string {
  const base = baseUrl.replace(/\/+$/, '');
  const version = apiVersion && apiVersion.trim() ? apiVersion.trim() : DEFAULT_AZURE_API_VERSION;
  return `${base}/openai/deployments/${encodeURIComponent(model)}/chat/completions?api-version=${encodeURIComponent(version)}`;
}

function azureHeaders(options: AzureTurnOptions): Record<string, string> {
  return {
    'content-type': 'application/json',
    'api-key': options.apiKey,
    ...(options.extraHeaders ?? {}),
  };
}

function azureRequestBody(options: AzureTurnOptions, messages: readonly AzureMessageParam[]): Record<string, unknown> {
  return {
    stream: true,
    stream_options: { include_usage: true },
    messages,
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    ...(options.tools && options.tools.length > 0 ? { tools: options.tools } : {}),
  };
}

/** Validates `options.baseUrl`, then delegates to `openai-chat.ts#runOpenAiCompatibleRequest` with Azure's own URL/header/body builders. */
async function runSingleAzureRequest(
  options: AzureTurnOptions,
  messages: readonly AzureMessageParam[],
  emitEnd: (reason: AzureTurnEndReason) => void,
  hasEnded: () => boolean,
): Promise<OpenAiCompatibleRequestOutcome> {
  const baseUrlCheck = validateBaseUrl(options.baseUrl);
  if (baseUrlCheck.error) {
    options.onEvent({ type: 'error', message: baseUrlCheck.error });
    emitEnd('error');
    return { finishReason: null, toolCalls: [], text: '' };
  }

  return runOpenAiCompatibleRequest({
    url: azureRequestUrl(options.baseUrl, options.model, options.apiVersion),
    headers: azureHeaders(options),
    body: azureRequestBody(options, messages),
    ...(options.signal ? { signal: options.signal } : {}),
    redactSecretsList: [options.apiKey],
    guardMessageId: 'azure-turn',
    providerLabel: 'Azure OpenAI',
    onEvent: options.onEvent,
    emitEnd,
    hasEnded,
  });
}

/**
 * Runs a full Azure OpenAI Chat Completions turn, including the
 * tool-execution loop when `options.executeTool` is supplied and the model
 * requests a function call. See `anthropic-messages.ts#runAnthropicToolTurn`'s
 * doc for the shared event-stream/`ended`-flag contract this mirrors exactly.
 */
export async function runAzureToolTurn(options: AzureTurnOptions): Promise<AzureTurnResult> {
  const maxToolTurns = options.maxToolTurns ?? DEFAULT_MAX_TOOL_TURNS;

  const endGuard = createTurnEndGuard<AzureTurnEvent>(options.onEvent, (reason) => ({ type: 'end', reason }));
  const emitEnd = endGuard.emitEnd;

  let messages = options.messages.slice();
  let toolTurns = 0;
  let lastFinishReason: string | null = null;

  while (true) {
    const outcome = await runSingleAzureRequest(options, messages, emitEnd, endGuard.hasEnded);
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

    const assistantToolCalls: AzureToolCallParam[] = outcome.toolCalls.map((call) => ({
      id: call.id,
      type: 'function',
      function: { name: call.name, arguments: JSON.stringify(call.input) },
    }));
    const toolResultMessages: AzureMessageParam[] = [];
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
