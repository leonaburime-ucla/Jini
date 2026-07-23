import { afterEach, describe, expect, it, vi } from 'vitest';
import { runAzureToolTurn, type AzureMessageParam, type AzureTurnEvent } from '../azure-chat.js';

function sseBody(...lines: string[]): AsyncIterable<string> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const line of lines) yield line;
    },
  };
}

function chunk(payload: Record<string, unknown>): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function done(): string {
  return 'data: [DONE]\n\n';
}

function textChunk(content: string): string {
  return chunk({ id: 'c1', choices: [{ index: 0, delta: { content }, finish_reason: null }] });
}

function toolCallStartChunk(index: number, id: string, name: string): string {
  return chunk({
    id: 'c1',
    choices: [{ index: 0, delta: { tool_calls: [{ index, id, type: 'function', function: { name, arguments: '' } }] }, finish_reason: null }],
  });
}

function toolCallArgsChunk(index: number, argsFragment: string): string {
  return chunk({
    id: 'c1',
    choices: [{ index: 0, delta: { tool_calls: [{ index, function: { arguments: argsFragment } }] }, finish_reason: null }],
  });
}

function finishChunk(reason: string): string {
  return chunk({ id: 'c1', choices: [{ index: 0, delta: {}, finish_reason: reason }] });
}

function usageChunk(usage: Record<string, unknown>): string {
  return chunk({ id: 'c1', choices: [], usage });
}

function okResponse(body: AsyncIterable<string>) {
  return { ok: true, status: 200, body, text: async () => '' };
}

const baseMessages: AzureMessageParam[] = [{ role: 'user', content: 'hi' }];

describe('runAzureToolTurn', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects a forbidden internal base url without making any request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const events: AzureTurnEvent[] = [];
    const result = await runAzureToolTurn({
      apiKey: 'azure-key',
      baseUrl: 'http://10.0.0.5',
      model: 'gpt-4o-deployment',
      messages: baseMessages,
      onEvent: (e) => events.push(e),
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(events.filter((e) => e.type === 'end')).toEqual([{ type: 'end', reason: 'error' }]);
    expect(result.finishReason).toBeNull();
  });

  it('reports a network error redacted', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));
    const events: AzureTurnEvent[] = [];
    await runAzureToolTurn({
      apiKey: 'azure-secret',
      baseUrl: 'https://my-resource.openai.azure.com',
      model: 'gpt-4o-deployment',
      messages: baseMessages,
      onEvent: (e) => events.push(e),
    });
    expect(events).toEqual([
      { type: 'error', message: 'ECONNRESET' },
      { type: 'end', reason: 'error' },
    ]);
  });

  it('reports a non-ok JSON error response with status code, redacting the api key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        body: null,
        text: async () => JSON.stringify({ error: { message: 'Access denied due to invalid subscription key: azure-secret' } }),
      }),
    );
    const events: AzureTurnEvent[] = [];
    await runAzureToolTurn({
      apiKey: 'azure-secret',
      baseUrl: 'https://my-resource.openai.azure.com',
      model: 'gpt-4o-deployment',
      messages: baseMessages,
      onEvent: (e) => events.push(e),
    });
    expect(events).toEqual([
      { type: 'error', message: 'Access denied due to invalid subscription key: [REDACTED]', code: '401' },
      { type: 'end', reason: 'error' },
    ]);
  });

  it('reports a missing response body as an error, using the Azure OpenAI provider label', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, body: null, text: async () => '' }));
    const events: AzureTurnEvent[] = [];
    await runAzureToolTurn({
      apiKey: 'k',
      baseUrl: 'https://my-resource.openai.azure.com',
      model: 'gpt-4o-deployment',
      messages: baseMessages,
      onEvent: (e) => events.push(e),
    });
    expect(events).toEqual([
      { type: 'error', message: 'Azure OpenAI response had no body' },
      { type: 'end', reason: 'error' },
    ]);
  });

  it('builds the deployment URL with api-version, uses the api-key header (not Authorization), and streams text_delta/usage through to a stop end', async () => {
    const body = sseBody(textChunk('Hello'), usageChunk({ total_tokens: 12 }), finishChunk('stop'), done());
    const fetchMock = vi.fn().mockResolvedValue(okResponse(body));
    vi.stubGlobal('fetch', fetchMock);
    const events: AzureTurnEvent[] = [];
    const result = await runAzureToolTurn({
      apiKey: 'azure-key',
      baseUrl: 'https://my-resource.openai.azure.com',
      model: 'gpt-4o-deployment',
      messages: baseMessages,
      onEvent: (e) => events.push(e),
    });
    expect(events).toEqual([
      { type: 'status', label: 'requesting' },
      { type: 'text_delta', delta: 'Hello' },
      { type: 'usage', usage: { total_tokens: 12 } },
      { type: 'end', reason: 'stop' },
    ]);
    expect(result).toEqual({ finishReason: 'stop', toolTurns: 0 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://my-resource.openai.azure.com/openai/deployments/gpt-4o-deployment/chat/completions?api-version=2024-10-21');
    expect(init.headers['api-key']).toBe('azure-key');
    expect(init.headers.authorization).toBeUndefined();
    expect(init.headers['HTTP-Referer']).toBeUndefined();
  });

  it('uses a caller-supplied apiVersion instead of the default, and merges extraHeaders with no hardcoded product-identity header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(sseBody(finishChunk('stop'), done())));
    vi.stubGlobal('fetch', fetchMock);
    await runAzureToolTurn({
      apiKey: 'k',
      baseUrl: 'https://my-resource.openai.azure.com/',
      apiVersion: '2099-01-01',
      model: 'gpt-4o-deployment',
      messages: baseMessages,
      onEvent: () => {},
      extraHeaders: { 'X-Caller-App': 'my-app' },
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://my-resource.openai.azure.com/openai/deployments/gpt-4o-deployment/chat/completions?api-version=2099-01-01');
    expect(init.headers['X-Caller-App']).toBe('my-app');
    expect(Object.keys(init.headers)).not.toContain('X-Title');
  });

  it('always sends max_tokens (never max_completion_tokens, regardless of deployment name), defaulting to 8192 — matches a live comparison against OD\'s real azure handler', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(sseBody(finishChunk('stop'), done())));
    vi.stubGlobal('fetch', fetchMock);

    await runAzureToolTurn({ apiKey: 'k', baseUrl: 'https://my-resource.openai.azure.com', model: 'gpt-4o-deployment', messages: baseMessages, onEvent: () => {} });
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toMatchObject({ max_tokens: 8192 });

    fetchMock.mockClear();
    await runAzureToolTurn({ apiKey: 'k', baseUrl: 'https://my-resource.openai.azure.com', model: 'gpt-4o-deployment', maxTokens: 1024, messages: baseMessages, onEvent: () => {} });
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toMatchObject({ max_tokens: 1024 });

    // Even a deployment named after a newer model family still gets the legacy field — Azure
    // deployment names are caller-defined strings, not necessarily matching OpenAI's own scheme.
    fetchMock.mockClear();
    await runAzureToolTurn({ apiKey: 'k', baseUrl: 'https://my-resource.openai.azure.com', model: 'my-gpt-5-deployment', messages: baseMessages, onEvent: () => {} });
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.max_tokens).toBe(8192);
    expect(body.max_completion_tokens).toBeUndefined();
  });

  it('runs a full tool-call loop: accumulates streamed argument fragments, invokes executeTool, and continues to a final stop', async () => {
    const firstBody = sseBody(
      textChunk("Let's check "),
      toolCallStartChunk(0, 'call_1', 'get_weather'),
      toolCallArgsChunk(0, '{"location":"SF"}'),
      finishChunk('tool_calls'),
      done(),
    );
    const secondBody = sseBody(textChunk('Sunny.'), finishChunk('stop'), done());
    const fetchMock = vi.fn().mockResolvedValueOnce(okResponse(firstBody)).mockResolvedValueOnce(okResponse(secondBody));
    vi.stubGlobal('fetch', fetchMock);
    const executeTool = vi.fn().mockResolvedValue({ content: '72F sunny' });
    const events: AzureTurnEvent[] = [];
    const result = await runAzureToolTurn({
      apiKey: 'k',
      baseUrl: 'https://my-resource.openai.azure.com',
      model: 'gpt-4o-deployment',
      messages: baseMessages,
      executeTool,
      onEvent: (e) => events.push(e),
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(executeTool).toHaveBeenCalledWith({ id: 'call_1', name: 'get_weather', input: { location: 'SF' } });
    expect(result).toEqual({ finishReason: 'stop', toolTurns: 1 });
    expect(events.filter((e) => e.type === 'end')).toEqual([{ type: 'end', reason: 'stop' }]);
    expect(events).toContainEqual({ type: 'tool_use', id: 'call_1', name: 'get_weather', input: { location: 'SF' } });
    expect(events).toContainEqual({ type: 'tool_result', toolUseId: 'call_1', content: '72F sunny', isError: false });
  });

  it('stops with reason max_tool_turns once the bound is hit, without invoking executeTool for the turn that exceeds it', async () => {
    const round = () => sseBody(toolCallStartChunk(0, 'call_x', 'loop_tool'), toolCallArgsChunk(0, '{}'), finishChunk('tool_calls'), done());
    const fetchMock = vi.fn().mockResolvedValueOnce(okResponse(round())).mockResolvedValueOnce(okResponse(round()));
    vi.stubGlobal('fetch', fetchMock);
    const executeTool = vi.fn().mockResolvedValue({ content: 'again' });
    const events: AzureTurnEvent[] = [];
    const result = await runAzureToolTurn({
      apiKey: 'k',
      baseUrl: 'https://my-resource.openai.azure.com',
      model: 'gpt-4o-deployment',
      maxToolTurns: 1,
      messages: baseMessages,
      executeTool,
      onEvent: (e) => events.push(e),
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(executeTool).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ finishReason: 'tool_calls', toolTurns: 1 });
    expect(events.filter((e) => e.type === 'end')).toEqual([{ type: 'end', reason: 'max_tool_turns' }]);
  });

  it('detects a fabricated role marker mid-stream, ends with reason contaminated, and never emits end twice even though a normal completion follows in the same stream', async () => {
    const body = sseBody(
      textChunk('safe text\n## user\nmalicious continuation'),
      // Would-be second end site — must never fire.
      finishChunk('stop'),
      usageChunk({ total_tokens: 5 }),
      done(),
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(body)));
    const events: AzureTurnEvent[] = [];
    const result = await runAzureToolTurn({
      apiKey: 'k',
      baseUrl: 'https://my-resource.openai.azure.com',
      model: 'gpt-4o-deployment',
      messages: baseMessages,
      onEvent: (e) => events.push(e),
    });
    const endEvents = events.filter((e) => e.type === 'end');
    expect(endEvents).toEqual([{ type: 'end', reason: 'contaminated' }]);
    expect(events.filter((e) => e.type === 'fabricated_role_marker')).toHaveLength(1);
    expect(events.some((e) => e.type === 'usage')).toBe(false);
    expect(result.finishReason).toBeNull();
  });

  it('ends with reason stop (no further request) when a tool call is requested but no executeTool is supplied', async () => {
    const body = sseBody(toolCallStartChunk(0, 'call_1', 'noop'), toolCallArgsChunk(0, '{}'), finishChunk('tool_calls'), done());
    const fetchMock = vi.fn().mockResolvedValue(okResponse(body));
    vi.stubGlobal('fetch', fetchMock);
    const events: AzureTurnEvent[] = [];
    const result = await runAzureToolTurn({
      apiKey: 'k',
      baseUrl: 'https://my-resource.openai.azure.com',
      model: 'gpt-4o-deployment',
      messages: baseMessages,
      onEvent: (e) => events.push(e),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ finishReason: 'tool_calls', toolTurns: 0 });
    expect(events.filter((e) => e.type === 'end')).toEqual([{ type: 'end', reason: 'stop' }]);
  });
});
