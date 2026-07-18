import { describe, expect, it } from 'vitest';
import { AGENT_DEFS, BASE_AGENT_DEFS, getAgentDef } from './registry.js';

describe('registry', () => {
  it('exposes a non-empty catalog of built-in agent defs', () => {
    expect(BASE_AGENT_DEFS.length).toBeGreaterThan(20);
    expect(AGENT_DEFS).toEqual(BASE_AGENT_DEFS);
  });

  it('has no duplicate ids in the built-in catalog', () => {
    const ids = BASE_AGENT_DEFS.map((def) => def.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every def has the minimum required RuntimeAgentDef shape', () => {
    for (const def of BASE_AGENT_DEFS) {
      expect(typeof def.id).toBe('string');
      expect(def.id.length).toBeGreaterThan(0);
      expect(typeof def.name).toBe('string');
      expect(typeof def.bin).toBe('string');
      expect(Array.isArray(def.versionArgs)).toBe(true);
      expect(Array.isArray(def.fallbackModels)).toBe(true);
      expect(typeof def.buildArgs).toBe('function');
      expect(typeof def.streamFormat).toBe('string');
    }
  });

  it('getAgentDef finds a known agent by id', () => {
    const claude = getAgentDef('claude');
    expect(claude?.id).toBe('claude');
    expect(claude?.bin).toBe('claude');
  });

  it('getAgentDef returns null for an unknown id', () => {
    expect(getAgentDef('not-a-real-agent')).toBeNull();
  });

  it('claude buildArgs composes stream-json argv', () => {
    const claude = getAgentDef('claude')!;
    const args = claude.buildArgs('hello', [], [], { model: 'sonnet' }, {});
    expect(args).toContain('--model');
    expect(args).toContain('sonnet');
    expect(args).toContain('--output-format');
  });

  it('the amr def declares supportsCustomModel: false (ACP-driven model selection)', () => {
    const amr = getAgentDef('amr')!;
    expect(amr.supportsCustomModel).toBe(false);
    expect(amr.streamFormat).toBe('acp-json-rpc');
  });
});
