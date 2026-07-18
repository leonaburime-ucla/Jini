import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MODEL_OPTION,
  isKnownModel,
  getRememberedLiveModels,
  preferFreshLiveModels,
  rememberLiveModels,
  resolveModelForAgent,
  sanitizeCustomModel,
} from './models.js';
import type { RuntimeAgentDef } from './types.js';

function makeDef(overrides: Partial<RuntimeAgentDef> = {}): RuntimeAgentDef {
  return {
    id: 'test-agent',
    name: 'Test Agent',
    bin: 'test-agent',
    versionArgs: [],
    buildArgs: () => [],
    fallbackModels: [],
    streamFormat: 'plain',
    ...overrides,
  } as RuntimeAgentDef;
}

describe('rememberLiveModels / getRememberedLiveModels / isKnownModel', () => {
  it('is a no-op for a non-array models value', () => {
    rememberLiveModels('agent-x', 'not-an-array' as unknown as never, undefined);
    expect(getRememberedLiveModels('agent-x')).toEqual([]);
  });

  it('remembers a list of live models scoped by agent id', () => {
    rememberLiveModels('agent-a', [{ id: 'm1', label: 'Model 1' }]);
    expect(getRememberedLiveModels('agent-a')).toEqual([{ id: 'm1', label: 'm1' }]);
  });

  it('filters out entries without a string id', () => {
    rememberLiveModels('agent-b', [
      { id: 'm1', label: 'Model 1' },
      null as unknown as { id: string; label: string },
      { id: 42 as unknown as string, label: 'bad' },
    ]);
    expect(getRememberedLiveModels('agent-b')).toEqual([{ id: 'm1', label: 'm1' }]);
  });

  it('scopes the cache by an optional scope string, trimmed', () => {
    rememberLiveModels('agent-c', [{ id: 'default-scope', label: 'x' }]);
    rememberLiveModels('agent-c', [{ id: 'scoped', label: 'x' }], '  profile-1  ');
    expect(getRememberedLiveModels('agent-c')).toEqual([{ id: 'default-scope', label: 'default-scope' }]);
    expect(getRememberedLiveModels('agent-c', 'profile-1')).toEqual([{ id: 'scoped', label: 'scoped' }]);
  });

  it('returns an empty array for an unknown agent/scope', () => {
    expect(getRememberedLiveModels('never-remembered')).toEqual([]);
  });

  it('isKnownModel returns false for a nullish modelId', () => {
    const def = makeDef();
    expect(isKnownModel(def, null)).toBe(false);
    expect(isKnownModel(def, undefined)).toBe(false);
  });

  it('isKnownModel finds a model from the live cache', () => {
    rememberLiveModels('agent-live', [{ id: 'm1', label: 'x' }]);
    expect(isKnownModel(makeDef({ id: 'agent-live' }), 'm1')).toBe(true);
    expect(isKnownModel(makeDef({ id: 'agent-live' }), 'unknown-id')).toBe(false);
  });

  it('isKnownModel falls back to fallbackModels when there is no live cache entry', () => {
    const def = makeDef({ id: 'agent-no-live', fallbackModels: [{ id: 'fallback-1', label: 'x' }] });
    expect(isKnownModel(def, 'fallback-1')).toBe(true);
    expect(isKnownModel(def, 'not-in-fallback')).toBe(false);
  });

  it('isKnownModel returns false when fallbackModels is not an array', () => {
    const def = makeDef({ id: 'agent-bad-fallback', fallbackModels: undefined as unknown as [] });
    expect(isKnownModel(def, 'anything')).toBe(false);
  });
});

describe('preferFreshLiveModels', () => {
  it('prefers the fresh list when non-empty', () => {
    const fresh = [{ id: 'fresh', label: 'Fresh' }];
    const remembered = [{ id: 'old', label: 'Old' }];
    expect(preferFreshLiveModels(fresh, remembered)).toBe(fresh);
  });

  it('falls back to the remembered list when fresh is empty', () => {
    const remembered = [{ id: 'old', label: 'Old' }];
    expect(preferFreshLiveModels([], remembered)).toBe(remembered);
  });
});

describe('sanitizeCustomModel', () => {
  it('rejects non-string input', () => {
    expect(sanitizeCustomModel(null)).toBeNull();
    expect(sanitizeCustomModel(undefined)).toBeNull();
    expect(sanitizeCustomModel(42 as unknown as string)).toBeNull();
  });

  it('rejects an empty or all-whitespace string', () => {
    expect(sanitizeCustomModel('')).toBeNull();
    expect(sanitizeCustomModel('   ')).toBeNull();
  });

  it('rejects a string over 200 chars', () => {
    expect(sanitizeCustomModel('a'.repeat(201))).toBeNull();
  });

  it('rejects a string that does not start with an alphanumeric', () => {
    expect(sanitizeCustomModel('-leading-dash')).toBeNull();
    expect(sanitizeCustomModel('.leading-dot')).toBeNull();
  });

  it('rejects a string containing disallowed characters', () => {
    expect(sanitizeCustomModel('model with spaces')).toBeNull();
    expect(sanitizeCustomModel('model;rm -rf')).toBeNull();
  });

  it('accepts a well-formed model id and trims surrounding whitespace', () => {
    expect(sanitizeCustomModel('  gpt-5/mini_v2.1:latest@east  ')).toBe('gpt-5/mini_v2.1:latest@east');
  });
});

describe('resolveModelForAgent', () => {
  it('returns the resolved model unchanged when it is a non-default string', () => {
    const def = makeDef();
    expect(resolveModelForAgent(def, 'explicit-model')).toBe('explicit-model');
  });

  it('honors defaultModelEnvVar when resolved is null and the env var is set', () => {
    const def = makeDef({ defaultModelEnvVar: 'MY_DEFAULT_MODEL' });
    expect(resolveModelForAgent(def, null, { MY_DEFAULT_MODEL: 'env-model' })).toBe('env-model');
  });

  it('ignores an empty/whitespace-only defaultModelEnvVar value', () => {
    const def = makeDef({ defaultModelEnvVar: 'MY_DEFAULT_MODEL', fallbackModels: [{ id: 'fb-1', label: 'x' }] });
    expect(resolveModelForAgent(def, null, { MY_DEFAULT_MODEL: '   ' })).toBe('fb-1');
  });

  it('returns resolved unchanged when fallbackModels declares the synthetic "default" option', () => {
    const def = makeDef({ fallbackModels: [DEFAULT_MODEL_OPTION, { id: 'fb-1', label: 'x' }] });
    expect(resolveModelForAgent(def, 'default', {})).toBe('default');
    expect(resolveModelForAgent(def, null, {})).toBe(null);
  });

  it('prefers the first remembered live model when fallbackModels omits "default"', () => {
    rememberLiveModels('agent-omits-default', [{ id: 'live-1', label: 'x' }]);
    const def = makeDef({ id: 'agent-omits-default', fallbackModels: [{ id: 'fb-1', label: 'x' }] });
    expect(resolveModelForAgent(def, null, {})).toBe('live-1');
  });

  it('falls back to the first fallback model id when there is no live list', () => {
    const def = makeDef({ id: 'agent-no-live-no-default', fallbackModels: [{ id: 'fb-1', label: 'x' }, { id: 'fb-2', label: 'y' }] });
    expect(resolveModelForAgent(def, null, {})).toBe('fb-1');
  });

  it('returns resolved unchanged when fallbackModels is empty and there is no live list', () => {
    const def = makeDef({ id: 'agent-empty-fallback', fallbackModels: [] });
    expect(resolveModelForAgent(def, null, {})).toBe(null);
  });

  it('is scoped by liveModelScope', () => {
    rememberLiveModels('agent-scoped-resolve', [{ id: 'scoped-live', label: 'x' }], 'scope-1');
    const def = makeDef({ id: 'agent-scoped-resolve', fallbackModels: [{ id: 'fb-1', label: 'x' }] });
    expect(resolveModelForAgent(def, null, {}, 'scope-1')).toBe('scoped-live');
    expect(resolveModelForAgent(def, null, {}, 'other-scope')).toBe('fb-1');
  });

  it('defaults env to process.env when omitted', () => {
    const def = makeDef({ defaultModelEnvVar: '__AGENT_RUNTIME_TEST_ENV_VAR__' });
    process.env.__AGENT_RUNTIME_TEST_ENV_VAR__ = 'from-process-env';
    try {
      expect(resolveModelForAgent(def, null)).toBe('from-process-env');
    } finally {
      delete process.env.__AGENT_RUNTIME_TEST_ENV_VAR__;
    }
  });
});
