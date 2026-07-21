import { describe, expect, it } from 'vitest';
import {
  buildToolIndex,
  errorResult,
  handleToolCall,
  okResult,
  requireString,
  toolsToList,
  type McpToolContext,
  type McpToolDef,
} from '../tool-protocol.js';

const ctx: McpToolContext = { baseUrl: 'http://d.example', fetchImpl: fetch };

function makeTool(overrides: Partial<McpToolDef> = {}): McpToolDef {
  return {
    name: 'noop',
    description: 'does nothing',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: () => ({ ok: true }),
    ...overrides,
  };
}

describe('okResult', () => {
  it('wraps a string payload as-is (no JSON-stringify quoting)', () => {
    expect(okResult('hello')).toEqual({ content: [{ type: 'text', text: 'hello' }] });
  });

  it('JSON-stringifies a non-string payload', () => {
    expect(okResult({ a: 1 })).toEqual({ content: [{ type: 'text', text: JSON.stringify({ a: 1 }, null, 2) }] });
  });
});

describe('errorResult', () => {
  it('marks isError and wraps the message as text content', () => {
    expect(errorResult('boom')).toEqual({ isError: true, content: [{ type: 'text', text: 'boom' }] });
  });
});

describe('requireString', () => {
  it('does not throw for a non-empty string', () => {
    expect(() => requireString('x', 'field')).not.toThrow();
  });

  it('throws for undefined', () => {
    expect(() => requireString(undefined, 'field')).toThrow('field is required (string).');
  });

  it('throws for an empty string', () => {
    expect(() => requireString('', 'field')).toThrow('field is required (string).');
  });

  it('throws for a non-string value', () => {
    expect(() => requireString(42, 'field')).toThrow('field is required (string).');
  });
});

describe('toolsToList', () => {
  it('projects name/description/inputSchema and omits annotations when unset', () => {
    const tool = makeTool();
    expect(toolsToList([tool])).toEqual([
      { name: 'noop', description: 'does nothing', inputSchema: tool.inputSchema },
    ]);
  });

  it('includes annotations when set', () => {
    const tool = makeTool({ annotations: { readOnlyHint: true } });
    expect(toolsToList([tool])[0]).toEqual({
      name: 'noop',
      description: 'does nothing',
      inputSchema: tool.inputSchema,
      annotations: { readOnlyHint: true },
    });
  });
});

describe('buildToolIndex', () => {
  it('indexes tools by name', () => {
    const a = makeTool({ name: 'a' });
    const b = makeTool({ name: 'b' });
    const index = buildToolIndex([a, b]);
    expect(index.get('a')).toBe(a);
    expect(index.get('b')).toBe(b);
    expect(index.size).toBe(2);
  });

  it('throws on a duplicate tool name', () => {
    expect(() => buildToolIndex([makeTool({ name: 'dup' }), makeTool({ name: 'dup' })])).toThrow(
      'createMcpToolServer: duplicate tool name "dup"',
    );
  });
});

describe('handleToolCall', () => {
  it('returns an error result for an unknown tool name', async () => {
    const result = await handleToolCall('missing', {}, buildToolIndex([]), ctx);
    expect(result).toEqual({ isError: true, content: [{ type: 'text', text: 'unknown tool: missing' }] });
  });

  it('invokes the matched handler with args defaulted to {} and wraps a successful result', async () => {
    const handler = (args: Record<string, unknown>) => ({ received: args });
    const tools = buildToolIndex([makeTool({ name: 't', handler })]);
    const result = await handleToolCall('t', undefined, tools, ctx);
    expect(result).toEqual(okResult({ received: {} }));
  });

  it('passes through the raw arguments and context to the handler', async () => {
    let seenArgs: unknown;
    let seenCtx: unknown;
    const tools = buildToolIndex([
      makeTool({ name: 't', handler: (args, toolCtx) => { seenArgs = args; seenCtx = toolCtx; return 'ok'; } }),
    ]);
    await handleToolCall('t', { runId: 'r1' }, tools, ctx);
    expect(seenArgs).toEqual({ runId: 'r1' });
    expect(seenCtx).toBe(ctx);
  });

  it('converts a thrown Error into an isError result with the (sanitized) message', async () => {
    const tools = buildToolIndex([makeTool({ name: 't', handler: () => { throw new Error('runId is required (string).'); } })]);
    const result = await handleToolCall('t', {}, tools, ctx);
    expect(result).toEqual({ isError: true, content: [{ type: 'text', text: 'runId is required (string).' }] });
  });

  it('converts a thrown non-Error value into an isError result via String()', async () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    const tools = buildToolIndex([makeTool({ name: 't', handler: () => { throw 'oops'; } })]);
    const result = await handleToolCall('t', {}, tools, ctx);
    expect(result).toEqual({ isError: true, content: [{ type: 'text', text: 'oops' }] });
  });

  it('sanitizes a secret-looking thrown message before it reaches the result', async () => {
    const tools = buildToolIndex([
      makeTool({ name: 't', handler: () => { throw new Error('daemon 400: apikey=abcdefghijklmnopqrstuvwxyz123456'); } }),
    ]);
    const result = await handleToolCall('t', {}, tools, ctx);
    expect((result.content[0] as { text: string }).text).toContain('[redacted]');
  });

  it('awaits an async handler', async () => {
    const tools = buildToolIndex([makeTool({ name: 't', handler: async () => Promise.resolve('async-ok') })]);
    const result = await handleToolCall('t', {}, tools, ctx);
    expect(result).toEqual(okResult('async-ok'));
  });
});
