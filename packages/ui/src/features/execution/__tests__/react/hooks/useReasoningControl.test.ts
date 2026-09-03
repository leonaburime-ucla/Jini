import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CUSTOM_MODEL_SENTINEL } from '../../../constants.js';
import type { DetectedAgent, LocalCliConfig } from '../../../types.js';
import { useReasoningControl } from '../../../react/hooks/useReasoningControl.js';

const AGY_MODELS = [
  { id: 'default', label: 'Default (CLI config)' },
  { id: 'gemini-3.8-flash-high', label: 'Gemini 3.8 Flash (High)' },
  { id: 'gemini-3.8-flash-medium', label: 'Gemini 3.8 Flash (Medium)' },
  { id: 'gemini-3.8-flash-low', label: 'Gemini 3.8 Flash (Low)' },
  { id: 'gemini-3.1-pro-high', label: 'Gemini 3.1 Pro (High)' },
  { id: 'gemini-3.1-pro-low', label: 'Gemini 3.1 Pro (Low)' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (Thinking)' },
  { id: 'gpt-oss-120b-medium', label: 'GPT-OSS 120B (Medium)' },
];

const REASONING_IN_MODEL_ID = {
  levels: [
    { id: 'high', label: 'High' },
    { id: 'medium', label: 'Medium' },
    { id: 'low', label: 'Low' },
  ],
};

function agyAgent(overrides: Partial<DetectedAgent> = {}): DetectedAgent {
  return {
    id: 'antigravity',
    label: 'Antigravity',
    installed: true,
    supportsCustomModel: false,
    models: AGY_MODELS,
    modelsSource: 'live',
    reasoningInModelId: REASONING_IN_MODEL_ID,
    ...overrides,
  };
}

function claudeAgent(overrides: Partial<DetectedAgent> = {}): DetectedAgent {
  return {
    id: 'claude',
    label: 'Claude Code',
    installed: true,
    models: [
      { id: 'claude-sonnet-4-6', label: 'Claude 3.7 Sonnet' },
      { id: 'claude-opus-4-6', label: 'Claude 3.7 Opus' },
    ],
    reasoningOptions: [
      { id: 'default', label: 'Default' },
      { id: 'low', label: 'Low' },
      { id: 'high', label: 'High' },
    ],
    ...overrides,
  };
}

describe('useReasoningControl — flat reasoning options (flag-based)', () => {
  it('derives flat reasoning options and preserves models directly', () => {
    const agent = claudeAgent();
    const config: LocalCliConfig = { agentId: 'claude', reasoningByAgentId: { claude: 'high' } };
    const { result } = renderHook(() => useReasoningControl({ agent, config }));

    expect(result.current.modelGroups).toBeNull();
    expect(result.current.activeGroup).toBeNull();
    expect(result.current.activeLevel).toBeNull();
    expect(result.current.hasReasoning).toBe(true);
    expect(result.current.reasoningOptions).toEqual(agent.reasoningOptions);
    expect(result.current.reasoningValue).toBe('high');
    expect(result.current.reasoningDisabled).toBe(false);
    expect(result.current.allowCustomModel).toBe(true);
    expect(result.current.modelChoices).toEqual(agent.models);
    expect(result.current.selectValue).toBe('claude-sonnet-4-6');
    expect(result.current.resolveNextModelId('claude-opus-4-6')).toBe('claude-opus-4-6');
    expect(result.current.resolveReasoningModelId('high')).toBeNull();
  });

  it('supports positional arguments (agent, config, explicitCustomMode)', () => {
    const agent = claudeAgent();
    const config: LocalCliConfig = { agentId: 'claude' };
    const { result } = renderHook(() => useReasoningControl(agent, config));

    expect(result.current.hasReasoning).toBe(true);
    expect(result.current.selectValue).toBe('claude-sonnet-4-6');
  });

  it('handles custom model mode for flag-based agents', () => {
    const agent = claudeAgent();
    const config: LocalCliConfig = { agentId: 'claude', modelByAgentId: { claude: 'custom-model-1' } };
    const { result } = renderHook(() => useReasoningControl({ agent, config, explicitCustomMode: true }));

    expect(result.current.customActive).toBe(true);
    expect(result.current.selectValue).toBe(CUSTOM_MODEL_SENTINEL);
    expect(result.current.customModelInputValue).toBe('custom-model-1');
  });
});

describe('useReasoningControl — suffix-in-model-id reasoning', () => {
  it('groups models by base and strips qualifiers from base labels', () => {
    const agent = agyAgent();
    const config: LocalCliConfig = { agentId: 'antigravity', modelByAgentId: { antigravity: 'gemini-3.1-pro-high' } };
    const { result } = renderHook(() => useReasoningControl({ agent, config }));

    expect(result.current.modelGroups).not.toBeNull();
    expect(result.current.activeGroup?.baseId).toBe('gemini-3.1-pro');
    expect(result.current.activeLevel).toBe('high');
    expect(result.current.selectValue).toBe('gemini-3.1-pro');
    expect(result.current.hasReasoning).toBe(true);
    expect(result.current.reasoningOptions.map((opt) => opt.id)).toEqual(['high', 'low']);
    expect(result.current.reasoningValue).toBe('high');
    expect(result.current.allowCustomModel).toBe(false);

    const baseLabels = result.current.modelChoices.map((choice) => choice.label);
    expect(baseLabels).toEqual([
      'Default (CLI config)',
      'Gemini 3.8 Flash',
      'Gemini 3.1 Pro',
      'Claude Sonnet 4.6 (Thinking)',
      'GPT-OSS 120B',
    ]);
  });

  it('hides reasoning control for base model with no variants', () => {
    const agent = agyAgent();
    const config: LocalCliConfig = { agentId: 'antigravity', modelByAgentId: { antigravity: 'claude-sonnet-4-6' } };
    const { result } = renderHook(() => useReasoningControl({ agent, config }));

    expect(result.current.activeGroup?.levels).toEqual([]);
    expect(result.current.hasReasoning).toBe(false);
    expect(result.current.reasoningOptions).toEqual([]);
  });

  it('disables reasoning control for base model with exactly one variant', () => {
    const agent = agyAgent();
    const config: LocalCliConfig = { agentId: 'antigravity', modelByAgentId: { antigravity: 'gpt-oss-120b-medium' } };
    const { result } = renderHook(() => useReasoningControl({ agent, config }));

    expect(result.current.hasReasoning).toBe(true);
    expect(result.current.reasoningOptions.map((opt) => opt.id)).toEqual(['medium']);
    expect(result.current.reasoningDisabled).toBe(true);
    expect(result.current.reasoningValue).toBe('medium');
  });

  it('carries active level over to new base model when supported', () => {
    const agent = agyAgent();
    const config: LocalCliConfig = { agentId: 'antigravity', modelByAgentId: { antigravity: 'gemini-3.1-pro-low' } };
    const { result } = renderHook(() => useReasoningControl({ agent, config }));

    expect(result.current.resolveNextModelId('gemini-3.8-flash')).toBe('gemini-3.8-flash-low');
  });

  it('falls back to a valid level on the target base when current level is not supported', () => {
    const agent = agyAgent();
    const config: LocalCliConfig = { agentId: 'antigravity', modelByAgentId: { antigravity: 'gemini-3.8-flash-medium' } };
    const { result } = renderHook(() => useReasoningControl({ agent, config }));

    // gemini-3.1-pro has only high and low; carrying medium must fall back to high, not compose gemini-3.1-pro-medium
    expect(result.current.resolveNextModelId('gemini-3.1-pro')).toBe('gemini-3.1-pro-high');
  });

  it('resolves model ID when reasoning level is picked', () => {
    const agent = agyAgent();
    const config: LocalCliConfig = { agentId: 'antigravity', modelByAgentId: { antigravity: 'gemini-3.1-pro-high' } };
    const { result } = renderHook(() => useReasoningControl({ agent, config }));

    expect(result.current.resolveReasoningModelId('low')).toBe('gemini-3.1-pro-low');
  });
});
