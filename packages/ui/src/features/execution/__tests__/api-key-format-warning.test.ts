import { describe, expect, it } from 'vitest';
import { DEFAULT_PROVIDER_PRESETS } from '../constants.js';
import { apiKeyFormatWarning, missingRequiredFields, resolveSelectedPreset } from '../rules.js';
import type { ByokConfig, ProviderPreset } from '../types.js';

/**
 * @file `apiKeyFormatWarning` as a rule, plus the two properties that make it safe to ship: it is
 * DATA (a preset row, not a provider-id branch) and it is ADVISORY (absent from the gate).
 */

function configWith(apiKey: string, preset: ProviderPreset | null): ByokConfig {
  return {
    protocol: preset?.protocol ?? 'openai',
    providerId: preset?.id ?? null,
    apiKey,
    baseUrl: preset?.baseUrl ?? 'https://example.com',
    model: 'some-model',
  };
}

function presetById(id: string): ProviderPreset {
  const found = DEFAULT_PROVIDER_PRESETS.find((preset) => preset.id === id);
  if (!found) throw new Error(`no preset '${id}' in DEFAULT_PROVIDER_PRESETS`);
  return found;
}

describe('apiKeyFormatWarning', () => {
  it('warns on a key that fails the preset pattern', () => {
    const preset = presetById('google-gemini');
    expect(apiKeyFormatWarning(configWith('hunter2-hunter2-hu', preset), preset)).toBe(preset.apiKeyFormatHint);
  });

  it('is silent on a matching key, an empty key, and a null preset', () => {
    const preset = presetById('google-gemini');
    expect(apiKeyFormatWarning(configWith('AIzaSyDUMMY0000000000000000000000000000', preset), preset)).toBeNull();
    expect(apiKeyFormatWarning(configWith('', preset), preset)).toBeNull();
    expect(apiKeyFormatWarning(configWith('anything', null), null)).toBeNull();
  });

  it('trims before judging, so a pasted key with stray whitespace is not condemned for it', () => {
    const preset = presetById('google-gemini');
    expect(apiKeyFormatWarning(configWith('  AIzaSyDUMMY000  ', preset), preset)).toBeNull();
  });

  it('is silent when a preset supplies a pattern but no message — nothing to say', () => {
    // Guards the half-configured row: a pattern without a hint must not render an empty warning.
    const halfConfigured: ProviderPreset = {
      id: 'half',
      title: 'Half',
      protocol: 'openai',
      baseUrl: 'https://half.example.com',
      preferredModels: [],
      apiKeyPattern: /^zz-/,
    };
    expect(apiKeyFormatWarning(configWith('nope', halfConfigured), halfConfigured)).toBeNull();
  });

  it('is DATA: a host-supplied preset the package has never heard of warns with its own message', () => {
    // The property that makes "add a provider" a catalog edit rather than a code edit. If this ever
    // needs a change in `rules.ts` to pass, the rule has grown a provider-id branch.
    const hostPreset: ProviderPreset = {
      id: 'acme-llm',
      title: 'Acme LLM',
      protocol: 'openai',
      baseUrl: 'https://acme.example.com/v1',
      preferredModels: [],
      apiKeyPattern: /^acme_/,
      apiKeyFormatHint: 'Acme keys start with "acme_".',
    };
    expect(apiKeyFormatWarning(configWith('sk-wrong-vendor', hostPreset), hostPreset)).toBe('Acme keys start with "acme_".');
    expect(apiKeyFormatWarning(configWith('acme_abc123', hostPreset), hostPreset)).toBeNull();
  });

  it('is ADVISORY: a wrong-shaped key is not a missing required field', () => {
    // `missingRequiredFields` is the gate (it disables Test connection). The warning must never
    // reach it, or a format guess becomes a block.
    const preset = presetById('google-gemini');
    const config = configWith('definitely-not-a-google-key', preset);
    expect(apiKeyFormatWarning(config, preset)).not.toBeNull();
    expect(missingRequiredFields(config, preset)).toEqual([]);
  });
});

describe('DEFAULT_PROVIDER_PRESETS key patterns', () => {
  it.each([
    ['google-gemini', 'AIzaSyDUMMY0000000000000000000000000000', 'hunter2-hunter2-hu'],
    ['anthropic', 'sk-ant-api03-dummy', 'hunter2-hunter2-hu'],
    ['openai', 'sk-dummy', 'hunter2-hunter2-hu'],
    ['openrouter', 'sk-or-v1-dummy', 'sk-not-openrouter'],
  ])('%s accepts its own key shape and rejects a foreign one', (id, good, bad) => {
    const preset = presetById(id);
    expect(apiKeyFormatWarning(configWith(good, preset), preset)).toBeNull();
    expect(apiKeyFormatWarning(configWith(bad, preset), preset)).toBe(preset.apiKeyFormatHint);
  });

  it('azure-openai and ollama ship NO pattern — silence is the default when the shape is unknown', () => {
    // Azure keys carry no vendor prefix and Ollama needs no key at all. A guess for either would
    // fire on valid input, which is the failure mode this catalog is written to avoid.
    expect(presetById('azure-openai').apiKeyPattern).toBeUndefined();
    expect(presetById('ollama').apiKeyPattern).toBeUndefined();
  });

  it('the shipped catalog is what the live Gemini form resolves, so the warning actually reaches it', () => {
    // Ties the catalog row to the selection path the screen uses — a pattern on an unreachable
    // preset would pass every test above and warn nobody.
    const google = presetById('google-gemini');
    const selected = resolveSelectedPreset(DEFAULT_PROVIDER_PRESETS, configWith('x', google));
    expect(selected?.id).toBe('google-gemini');
    expect(apiKeyFormatWarning(configWith('x', selected), selected)).toBe(google.apiKeyFormatHint);
  });
});
