import { afterEach, describe, expect, it, vi } from 'vitest';
import { runOllamaToolTurn, type OllamaMessageParam, type OllamaTurnEvent } from '../ollama-chat.js';

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

const baseMessages: OllamaMessageParam[] = [{ role: 'user', content: 'hi' }];

describe('runOllamaToolTurn', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to http://localhost:11434 and sends no authorization header when apiKey is omitted', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(sseBody(finishChunk('stop'), done())));
    vi.stubGlobal('fetch', fetchMock);
    const events: OllamaTurnEvent[] = [];
    const result = await runOllamaToolTurn({ model: 'llama3', messages: baseMessages, onEvent: (e) => events.push(e) });
    expect(result).toEqual({ finishReason: 'stop', toolTurns: 0 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://localhost:11434/v1/chat/completions');
    expect(init.headers.authorization).toBeUndefined();
    expect('authorization' in init.headers).toBe(false);
  });

  it('does not reject the default loopback base url via the SSRF guard (Ollama is local-first)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(sseBody(finishChunk('stop'), done())));
    vi.stubGlobal('fetch', fetchMock);
    const events: OllamaTurnEvent[] = [];
    await runOllamaToolTurn({ model: 'llama3', messages: baseMessages, onEvent: (e) => events.push(e) });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(events.some((e) => e.type === 'error')).toBe(false);
  });

  it('still rejects a non-loopback internal base url', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const events: OllamaTurnEvent[] = [];
    const result = await runOllamaToolTurn({
      model: 'llama3',
      baseUrl: 'http://192.168.1.5:11434',
      messages: baseMessages,
      onEvent: (e) => events.push(e),
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(events.filter((e) => e.type === 'end')).toEqual([{ type: 'end', reason: 'error' }]);
    expect(result.finishReason).toBeNull();
  });

  it('sends a Bearer authorization header when apiKey is supplied (remote Ollama-compatible gateway)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(sseBody(finishChunk('stop'), done())));
    vi.stubGlobal('fetch', fetchMock);
    await runOllamaToolTurn({
      apiKey: 'gw-secret',
      baseUrl: 'https://ollama-gateway.example.com',
      model: 'llama3',
      messages: baseMessages,
      onEvent: () => {},
    });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.headers.authorization).toBe('Bearer gw-secret');
  });

  it('reports a network error, redacting the api key when supplied', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:11434')));
    const events: OllamaTurnEvent[] = [];
    await runOllamaToolTurn({ apiKey: 'sk-local', model: 'llama3', messages: baseMessages, onEvent: (e) => events.push(e) });
    expect(events).toEqual([
      { type: 'error', message: 'connect ECONNREFUSED 127.0.0.1:11434' },
      { type: 'end', reason: 'error' },
    ]);
  });

  it('reports a non-ok error response with status code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, body: null, text: async () => 'model "llama3" not found' }));
    const events: OllamaTurnEvent[] = [];
    await runOllamaToolTurn({ model: 'llama3', messages: baseMessages, onEvent: (e) => events.push(e) });
    expect(events).toEqual([
      { type: 'error', message: 'model "llama3" not found', code: '404' },
      { type: 'end', reason: 'error' },
    ]);
  });

  it('reports a missing response body as an error, using the Ollama provider label', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, body: null, text: async () => '' }));
    const events: OllamaTurnEvent[] = [];
    await runOllamaToolTurn({ model: 'llama3', messages: baseMessages, onEvent: (e) => events.push(e) });
    expect(events).toEqual([
      { type: 'error', message: 'Ollama response had no body' },
      { type: 'end', reason: 'error' },
    ]);
  });

  it('streams text_delta/usage events and ends with reason stop for a plain text response', async () => {
    const body = sseBody(textChunk('Hello'), textChunk(' world'), usageChunk({ total_tokens: 12 }), finishChunk('stop'), done());
    const fetchMock = vi.fn().mockResolvedValue(okResponse(body));
    vi.stubGlobal('fetch', fetchMock);
    const events: OllamaTurnEvent[] = [];
    const result = await runOllamaToolTurn({ model: 'llama3', messages: baseMessages, onEvent: (e) => events.push(e) });
    expect(events).toEqual([
      { type: 'status', label: 'requesting' },
      { type: 'text_delta', delta: 'Hello' },
      { type: 'text_delta', delta: ' world' },
      { type: 'usage', usage: { total_tokens: 12 } },
      { type: 'end', reason: 'stop' },
    ]);
    expect(result).toEqual({ finishReason: 'stop', toolTurns: 0 });
  });

  it('merges caller-supplied extraHeaders verbatim (no hardcoded product-identity header)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(sseBody(finishChunk('stop'), done())));
    vi.stubGlobal('fetch', fetchMock);
    await runOllamaToolTurn({
      model: 'llama3',
      messages: baseMessages,
      onEvent: () => {},
      extraHeaders: { 'X-Caller-App': 'my-app' },
    });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.headers['X-Caller-App']).toBe('my-app');
    expect(Object.keys(init.headers)).not.toContain('X-Title');
    expect(Object.keys(init.headers)).not.toContain('HTTP-Referer');
  });

  it('resolves a baseUrl that already ends in a versioned path without adding a second /v1', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(sseBody(finishChunk('stop'), done())));
    vi.stubGlobal('fetch', fetchMock);
    await runOllamaToolTurn({ baseUrl: 'http://localhost:11434/v1/', model: 'llama3', messages: baseMessages, onEvent: () => {} });
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://localhost:11434/v1/chat/completions');
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
    const events: OllamaTurnEvent[] = [];
    const result = await runOllamaToolTurn({
      model: 'llama3',
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
    const events: OllamaTurnEvent[] = [];
    const result = await runOllamaToolTurn({
      model: 'llama3',
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
    const events: OllamaTurnEvent[] = [];
    const result = await runOllamaToolTurn({ model: 'llama3', messages: baseMessages, onEvent: (e) => events.push(e) });
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
    const events: OllamaTurnEvent[] = [];
    const result = await runOllamaToolTurn({ model: 'llama3', messages: baseMessages, onEvent: (e) => events.push(e) });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ finishReason: 'tool_calls', toolTurns: 0 });
    expect(events.filter((e) => e.type === 'end')).toEqual([{ type: 'end', reason: 'stop' }]);
  });
});
