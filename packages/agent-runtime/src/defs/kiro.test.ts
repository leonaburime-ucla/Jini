import { afterEach, describe, expect, it } from 'vitest';
import { setAcpModelProbe, type AcpModelProbe } from '../acp-model-probe.js';
import { kiroAgentDef } from './kiro.js';
import { DEFAULT_MODEL_OPTION } from './shared.js';

afterEach(() => {
  setAcpModelProbe(null);
});

describe('kiroAgentDef.fetchModels', () => {
  it('delegates to detectAcpModels with the ACP handshake args for the resolved binary', async () => {
    const seen: Array<{ bin: string; args: string[] }> = [];
    const stub: AcpModelProbe = {
      detectModels: async (request) => {
        seen.push({ bin: request.bin, args: request.args });
        return [{ id: 'x', label: 'x' }];
      },
    };
    setAcpModelProbe(stub);
    const models = await kiroAgentDef.fetchModels!('kiro-cli', {});
    expect(models).toEqual([{ id: 'x', label: 'x' }]);
    expect(seen).toEqual([{ bin: 'kiro-cli', args: ['acp'] }]);
  });
});

describe('kiroAgentDef.buildArgs', () => {
  it('always returns the ACP argv, ignoring any input params', () => {
    expect(kiroAgentDef.buildArgs('prompt', ['img.png'], ['/extra'], { model: 'x' }, { cwd: '/a' })).toEqual([
      'acp',
    ]);
  });
});

describe('kiroAgentDef shape', () => {
  it('declares the expected static metadata', () => {
    expect(kiroAgentDef.id).toBe('kiro');
    expect(kiroAgentDef.bin).toBe('kiro-cli');
    expect(kiroAgentDef.fallbackModels).toEqual([DEFAULT_MODEL_OPTION]);
    expect(kiroAgentDef.streamFormat).toBe('acp-json-rpc');
    expect(kiroAgentDef.externalMcpInjection).toBe('acp-merge');
  });
});
