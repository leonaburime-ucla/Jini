import { describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({ getDaemonJson: vi.fn(), postDaemonJson: vi.fn() }));
const { getDaemonJson, postDaemonJson } = hoisted;
vi.mock('../../daemon-client.js', () => hoisted);

import {
  RUN_TOOLS,
  cancelRunTool,
  getActiveContextTool,
  getRunTool,
  listAgentsTool,
  startRunTool,
} from '../run-tools.js';
import type { McpToolContext } from '../../tool-protocol.js';

const ctx: McpToolContext = { baseUrl: 'http://d.example', fetchImpl: fetch };

describe('RUN_TOOLS', () => {
  it('exports all five tools with unique names', () => {
    expect(RUN_TOOLS.map((t) => t.name)).toEqual([
      'start_run',
      'get_run',
      'cancel_run',
      'get_active_context',
      'list_agents',
    ]);
  });
});

describe('startRunTool', () => {
  it('requires contextRef', async () => {
    await expect(startRunTool.handler({}, ctx)).rejects.toThrow('contextRef is required (string).');
  });

  it('posts {contextRef} only when agentId/idempotencyKey are omitted', async () => {
    postDaemonJson.mockResolvedValueOnce({ run: { id: 'r1' }, started: true });
    const result = await startRunTool.handler({ contextRef: 'c1' }, ctx);
    expect(postDaemonJson).toHaveBeenCalledWith('http://d.example', '/api/runs', { contextRef: 'c1' }, { fetchImpl: ctx.fetchImpl });
    expect(result).toEqual({ run: { id: 'r1' }, started: true });
  });

  it('includes agentId and idempotencyKey when supplied as non-empty strings', async () => {
    postDaemonJson.mockResolvedValueOnce({ run: { id: 'r1' }, started: true });
    await startRunTool.handler({ contextRef: 'c1', agentId: 'a1', idempotencyKey: 'k1' }, ctx);
    expect(postDaemonJson).toHaveBeenCalledWith(
      'http://d.example',
      '/api/runs',
      { contextRef: 'c1', agentId: 'a1', idempotencyKey: 'k1' },
      { fetchImpl: ctx.fetchImpl },
    );
  });

  it('omits agentId/idempotencyKey when they are empty strings or non-strings', async () => {
    postDaemonJson.mockResolvedValueOnce({});
    await startRunTool.handler({ contextRef: 'c1', agentId: '', idempotencyKey: 42 }, ctx);
    expect(postDaemonJson).toHaveBeenCalledWith('http://d.example', '/api/runs', { contextRef: 'c1' }, { fetchImpl: ctx.fetchImpl });
  });

  it('declares its input schema and write annotations', () => {
    expect(startRunTool.inputSchema).toMatchObject({ type: 'object', required: ['contextRef'] });
    expect(startRunTool.annotations).toMatchObject({ readOnlyHint: false, title: 'Start a run' });
  });
});

describe('getRunTool', () => {
  it('requires runId', async () => {
    await expect(getRunTool.handler({}, ctx)).rejects.toThrow('runId is required (string).');
  });

  it('GETs the run status route with the runId URI-encoded', async () => {
    getDaemonJson.mockResolvedValueOnce({ run: { id: 'r/1' } });
    const result = await getRunTool.handler({ runId: 'r/1' }, ctx);
    expect(getDaemonJson).toHaveBeenCalledWith('http://d.example', '/api/runs/r%2F1', { fetchImpl: ctx.fetchImpl });
    expect(result).toEqual({ run: { id: 'r/1' } });
  });

  it('declares read-only annotations', () => {
    expect(getRunTool.annotations).toMatchObject({ readOnlyHint: true, title: 'Check a run' });
  });
});

describe('cancelRunTool', () => {
  it('requires runId', async () => {
    await expect(cancelRunTool.handler({}, ctx)).rejects.toThrow('runId is required (string).');
  });

  it('posts an empty body when reason is omitted', async () => {
    postDaemonJson.mockResolvedValueOnce({ run: { id: 'r1' } });
    await cancelRunTool.handler({ runId: 'r1' }, ctx);
    expect(postDaemonJson).toHaveBeenCalledWith('http://d.example', '/api/runs/r1/cancel', {}, { fetchImpl: ctx.fetchImpl });
  });

  it('includes a non-empty reason', async () => {
    postDaemonJson.mockResolvedValueOnce({ run: { id: 'r1' } });
    await cancelRunTool.handler({ runId: 'r1', reason: 'user requested' }, ctx);
    expect(postDaemonJson).toHaveBeenCalledWith('http://d.example', '/api/runs/r1/cancel', { reason: 'user requested' }, { fetchImpl: ctx.fetchImpl });
  });

  it('omits an empty-string reason', async () => {
    postDaemonJson.mockResolvedValueOnce({});
    await cancelRunTool.handler({ runId: 'r1', reason: '' }, ctx);
    expect(postDaemonJson).toHaveBeenCalledWith('http://d.example', '/api/runs/r1/cancel', {}, { fetchImpl: ctx.fetchImpl });
  });
});

describe('getActiveContextTool', () => {
  it('returns the daemon payload unchanged when active is true', async () => {
    getDaemonJson.mockResolvedValueOnce({ active: true, resourceRef: 'x', detail: null, ts: 1, ageMs: 0 });
    const result = await getActiveContextTool.handler({}, ctx);
    expect(getDaemonJson).toHaveBeenCalledWith('http://d.example', '/api/active', { fetchImpl: ctx.fetchImpl });
    expect(result).toEqual({ active: true, resourceRef: 'x', detail: null, ts: 1, ageMs: 0 });
  });

  it('adds a hint when the daemon reports active:false', async () => {
    getDaemonJson.mockResolvedValueOnce({ active: false });
    const result = await getActiveContextTool.handler({}, ctx);
    expect(result).toMatchObject({ active: false, hint: expect.stringContaining('No active resource') });
  });
});

describe('listAgentsTool', () => {
  it('GETs /api/agents', async () => {
    getDaemonJson.mockResolvedValueOnce({ agents: [{ id: 'claude', name: 'Claude' }] });
    const result = await listAgentsTool.handler({}, ctx);
    expect(getDaemonJson).toHaveBeenCalledWith('http://d.example', '/api/agents', { fetchImpl: ctx.fetchImpl });
    expect(result).toEqual({ agents: [{ id: 'claude', name: 'Claude' }] });
  });
});
