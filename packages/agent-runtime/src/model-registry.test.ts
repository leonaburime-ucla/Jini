import { describe, expect, it } from 'vitest';
import {
  effectiveAgentModelChoice,
  fingerprintCredential,
  mergeModelOptions,
  modelCatalogCacheKey,
  normalizeAgentModelChoice,
  resolveCredentialStatus,
} from './model-registry.js';

describe('resolveCredentialStatus', () => {
  it('returns "available" when the provider does not require credentials', () => {
    expect(resolveCredentialStatus({ credentialsRequired: false }, false)).toBe('available');
    expect(resolveCredentialStatus({ credentialsRequired: false }, true)).toBe('available');
  });

  it('returns "configured" when a credential is stored', () => {
    expect(resolveCredentialStatus({ credentialsRequired: true }, true)).toBe('configured');
  });

  it('returns "unconfigured" when no credential is stored and one is required', () => {
    expect(resolveCredentialStatus({ credentialsRequired: true }, false)).toBe('unconfigured');
  });

  it('defaults to requiring credentials when credentialsRequired is omitted', () => {
    expect(resolveCredentialStatus({}, false)).toBe('unconfigured');
    expect(resolveCredentialStatus({}, true)).toBe('configured');
  });
});

describe('mergeModelOptions', () => {
  it('keeps fetched models first and appends non-duplicate suggested models', () => {
    const merged = mergeModelOptions(
      [{ id: 'gpt-5', label: 'GPT-5', providerId: 'openai' }],
      [
        { id: 'gpt-5', label: 'stale suggested label', providerId: 'openai' },
        { id: 'gpt-5-mini', label: 'GPT-5 mini', providerId: 'openai' },
      ],
    );
    expect(merged).toEqual([
      { id: 'gpt-5', label: 'GPT-5', providerId: 'openai' },
      { id: 'gpt-5-mini', label: 'GPT-5 mini', providerId: 'openai' },
    ]);
  });

  it('drops blank ids and falls back to id when label is blank', () => {
    const merged = mergeModelOptions(
      [{ id: '  ', label: 'ignored', providerId: 'openai' }],
      [{ id: 'model-x', label: '   ', providerId: 'openai' }],
    );
    expect(merged).toEqual([{ id: 'model-x', label: 'model-x', providerId: 'openai' }]);
  });

  it('trims ids and labels', () => {
    const merged = mergeModelOptions([{ id: ' spaced-id ', label: ' Spaced Label ', providerId: 'openai' }], []);
    expect(merged).toEqual([{ id: 'spaced-id', label: 'Spaced Label', providerId: 'openai' }]);
  });
});

describe('fingerprintCredential', () => {
  it('is deterministic for the same input', () => {
    expect(fingerprintCredential('sk-abc123')).toBe(fingerprintCredential('sk-abc123'));
  });

  it('differs for different inputs', () => {
    expect(fingerprintCredential('sk-abc123')).not.toBe(fingerprintCredential('sk-abc124'));
  });

  it('never contains the raw credential', () => {
    expect(fingerprintCredential('sk-super-secret')).not.toContain('sk-super-secret');
  });

  it('encodes the input length as a prefix', () => {
    expect(fingerprintCredential('abc')).toMatch(/^3:/);
    expect(fingerprintCredential('')).toMatch(/^0:/);
  });
});

describe('modelCatalogCacheKey', () => {
  it('produces the same key for equivalent inputs modulo trailing slashes/whitespace', () => {
    const a = modelCatalogCacheKey('openai', 'https://api.openai.com/', ' sk-key ');
    const b = modelCatalogCacheKey('openai', 'https://api.openai.com', 'sk-key');
    expect(a).toBe(b);
  });

  it('differs when the provider, base URL, credential, or variant differs', () => {
    const base = modelCatalogCacheKey('openai', 'https://api.openai.com', 'sk-key');
    expect(modelCatalogCacheKey('azure', 'https://api.openai.com', 'sk-key')).not.toBe(base);
    expect(modelCatalogCacheKey('openai', 'https://other.example.com', 'sk-key')).not.toBe(base);
    expect(modelCatalogCacheKey('openai', 'https://api.openai.com', 'sk-other')).not.toBe(base);
    expect(modelCatalogCacheKey('openai', 'https://api.openai.com', 'sk-key', '2024-01-01')).not.toBe(base);
  });

  it('does not leak the raw credential', () => {
    expect(modelCatalogCacheKey('openai', 'https://api.openai.com', 'sk-super-secret')).not.toContain('sk-super-secret');
  });
});

describe('normalizeAgentModelChoice', () => {
  const agent = { models: [{ id: 'model-a', label: 'A', providerId: 'p' }, { id: 'model-b', label: 'B', providerId: 'p' }] };

  it('returns null when no model is configured', () => {
    expect(normalizeAgentModelChoice(agent, undefined)).toBeNull();
    expect(normalizeAgentModelChoice(agent, {})).toBeNull();
  });

  it('returns null when the configured model is still in the catalogue', () => {
    expect(normalizeAgentModelChoice(agent, { model: 'model-b' })).toBeNull();
  });

  it('falls back to the first model when the configured model is stale', () => {
    expect(normalizeAgentModelChoice(agent, { model: 'model-gone', reasoning: 'high' })).toEqual({
      model: 'model-a',
      reasoning: 'high',
    });
  });

  it('returns null when the agent has no models to fall back to', () => {
    expect(normalizeAgentModelChoice({ models: [] }, { model: 'model-gone' })).toBeNull();
    expect(normalizeAgentModelChoice(null, { model: 'model-gone' })).toBeNull();
    expect(normalizeAgentModelChoice(undefined, { model: 'model-gone' })).toBeNull();
  });
});

describe('effectiveAgentModelChoice', () => {
  const agent = { models: [{ id: 'model-a', label: 'A', providerId: 'p' }] };

  it('returns the normalized choice when normalization applies', () => {
    expect(effectiveAgentModelChoice(agent, { model: 'model-gone' })).toEqual({ model: 'model-a' });
  });

  it('returns the original choice unchanged when normalization does not apply', () => {
    const choice = { model: 'model-a' };
    expect(effectiveAgentModelChoice(agent, choice)).toBe(choice);
  });

  it('passes through undefined', () => {
    expect(effectiveAgentModelChoice(agent, undefined)).toBeUndefined();
  });
});
