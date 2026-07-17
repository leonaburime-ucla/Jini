import { afterEach, describe, expect, it } from 'vitest';
import { setAcpModelProbe, type AcpModelProbe } from '../acp-model-probe.js';
import { hermesAgentDef } from './hermes.js';
import { DEFAULT_MODEL_OPTION } from './shared.js';

afterEach(() => {
  setAcpModelProbe(null);
});

describe('hermesAgentDef.fetchModels', () => {
  it('delegates to detectAcpModels with the ACP handshake args for the resolved binary', async () => {
    const seen: Array<{ bin: string; args: string[]; env?: unknown; timeoutMs?: number; defaultModelOption?: unknown }> = [];
    const stub: AcpModelProbe = {
      detectModels: async (request) => {
        seen.push(request);
        return [{ id: 'grok-4.3', label: 'grok-4.3' }];
      },
    };
    setAcpModelProbe(stub);
    const models = await hermesAgentDef.fetchModels!('hermes', { FOO: 'bar' });
    expect(models).toEqual([{ id: 'grok-4.3', label: 'grok-4.3' }]);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      bin: 'hermes',
      args: ['acp', '--accept-hooks'],
      env: { FOO: 'bar' },
      timeoutMs: 15_000,
      defaultModelOption: DEFAULT_MODEL_OPTION,
    });
  });
});

describe('hermesAgentDef.buildArgs', () => {
  it('always returns the ACP handshake argv, ignoring any input params', () => {
    expect(hermesAgentDef.buildArgs('prompt', ['img.png'], ['/extra'], { model: 'x' }, { cwd: '/a' })).toEqual([
      'acp',
      '--accept-hooks',
    ]);
    expect(hermesAgentDef.buildArgs('', [], [], {}, {})).toEqual(['acp', '--accept-hooks']);
  });
});

describe('hermesAgentDef shape', () => {
  it('declares the expected static metadata', () => {
    expect(hermesAgentDef.id).toBe('hermes');
    expect(hermesAgentDef.bin).toBe('hermes');
    expect(hermesAgentDef.fallbackModels).toContainEqual(DEFAULT_MODEL_OPTION);
    expect(hermesAgentDef.fallbackModels.length).toBeGreaterThan(1);
    expect(hermesAgentDef.streamFormat).toBe('acp-json-rpc');
    expect(hermesAgentDef.mcpDiscovery).toBe('mature-acp');
    expect(hermesAgentDef.externalMcpInjection).toBe('acp-merge');
  });
});
