import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AgentCliEnvFields } from '../../../react/components/AgentCliEnvFields.js';
import { ByokProviderForm } from '../../../react/components/ByokProviderForm.js';
import type { AgentCliEnvFieldSpec, ByokConfig, LocalCliConfig, ProviderPreset } from '../../../types.js';

/**
 * @file Two defects reported together on one screen, which turned out to be one defect and one
 * missing guard.
 *
 * REPORTED: an operator's Google BYOK form kept answering "API key not valid. Please pass a valid
 * API key." with a valid key in hand. The field actually held a 15-character value with no `AIza`
 * prefix — Chrome had autofilled a saved PASSWORD into it, because `autoComplete="off"` is
 * deliberately ignored by Chrome on credential-shaped fields. The provider's rejection was true and
 * unactionable: it described a string the operator never typed.
 *
 * So: `new-password` stops the wrong value arriving, and `apiKeyFormatWarning` names it if one
 * arrives anyway (a different browser, a paste from the wrong clipboard entry).
 *
 * Every assertion here reads the RENDERED DOM ATTRIBUTE rather than a prop, because the prop is not
 * the thing Chrome consults and a test on the prop would have passed against the broken version.
 */

const GOOGLE_PRESET: ProviderPreset = {
  id: 'google-gemini',
  title: 'Google Gemini',
  protocol: 'google',
  baseUrl: 'https://generativelanguage.googleapis.com',
  preferredModels: ['gemini-3.6-flash'],
  apiKeyPattern: /^AIza/,
  apiKeyFormatHint: 'This does not look like a Google API key — those start with "AIza".',
};

/** Same provider, no pattern — the "silence is the default" case a host's own catalog gets. */
const NO_PATTERN_PRESET: ProviderPreset = {
  id: 'mystery',
  title: 'Mystery Provider',
  protocol: 'openai',
  baseUrl: 'https://mystery.example.com',
  preferredModels: ['m-1'],
};

function configWith(preset: ProviderPreset, apiKey: string): ByokConfig {
  return {
    protocol: preset.protocol,
    providerId: preset.id,
    apiKey,
    baseUrl: preset.baseUrl,
    model: preset.preferredModels[0] ?? '',
  };
}

function renderForm(preset: ProviderPreset, apiKey: string) {
  return render(
    <ByokProviderForm
      config={configWith(preset, apiKey)}
      onConfigChange={vi.fn()}
      preset={preset}
      modelDiscovery={{ status: 'idle' }}
      connectionTest={{ status: 'idle' }}
      onTestConnection={vi.fn()}
    />,
  );
}

function keyInput(): HTMLInputElement {
  return screen.getByLabelText(/API key/i, { exact: false }) as HTMLInputElement;
}

describe('ByokProviderForm — API-key autofill suppression', () => {
  it('renders autocomplete="new-password" on the API-key input, NOT "off"', () => {
    renderForm(GOOGLE_PRESET, '');
    // The literal attribute, not the React prop: `off` is what Chrome ignores, and `new-password`
    // is the only value it honors as "not a saved-login field".
    expect(keyInput().getAttribute('autocomplete')).toBe('new-password');
  });

  it('keeps autocomplete="new-password" while the key is revealed as plain text', () => {
    // `type` flips to `text` on reveal; the autofill suppression must not flip with it, or a
    // revealed field becomes fillable again.
    const { container } = renderForm(GOOGLE_PRESET, 'AIzaSyExample');
    const revealButton = container.querySelector('.jini-input-affix-btn') as HTMLButtonElement;
    revealButton.click();
    expect(keyInput().getAttribute('autocomplete')).toBe('new-password');
  });
});

describe('ByokProviderForm — key-format warning', () => {
  it('warns with the preset’s own message when a non-empty key fails its pattern', () => {
    renderForm(GOOGLE_PRESET, 'not-a-real-key-1234567890');
    expect(
      screen.getByText('This does not look like a Google API key — those start with "AIza".'),
    ).toBeInTheDocument();
  });

  it('is advisory only — Test connection stays enabled with a wrong-shaped key', () => {
    // The whole point: a client-side format guess must never be able to lock an operator out of a
    // credential the vendor would actually accept. A disabled button here would be the regression.
    renderForm(GOOGLE_PRESET, 'not-a-real-key-1234567890');
    expect(screen.getByRole('button', { name: /Test connection/i })).toBeEnabled();
  });

  it('stays silent for a key that matches the pattern', () => {
    renderForm(GOOGLE_PRESET, 'AIzaSyDUMMY0000000000000000000000000000');
    expect(screen.queryByText(/does not look like/i)).not.toBeInTheDocument();
  });

  it('stays silent for an empty field — a stored-key screen legitimately renders one', () => {
    renderForm(GOOGLE_PRESET, '');
    expect(screen.queryByText(/does not look like/i)).not.toBeInTheDocument();
  });

  it('stays silent for a whitespace-only field rather than judging the trimmed empty string', () => {
    renderForm(GOOGLE_PRESET, '   ');
    expect(screen.queryByText(/does not look like/i)).not.toBeInTheDocument();
  });

  it('stays silent for a preset carrying no pattern, whatever is typed', () => {
    renderForm(NO_PATTERN_PRESET, 'literally anything at all');
    expect(screen.queryByText(/does not look like/i)).not.toBeInTheDocument();
  });
});

describe('AgentCliEnvFields — autofill suppression is per-field', () => {
  const FIELDS: readonly AgentCliEnvFieldSpec[] = [
    { agentId: 'claude', envKey: 'ANTHROPIC_AUTH_TOKEN', label: 'Auth token', secret: true },
    { agentId: 'claude', envKey: 'ANTHROPIC_BASE_URL', label: 'Proxy base URL' },
  ];
  const CONFIG: LocalCliConfig = { selectedAgentId: 'claude' } as LocalCliConfig;

  it('a secret field gets new-password; a non-secret one keeps off', () => {
    // Split deliberately: `new-password` on a file-path field invites Chrome to offer to GENERATE a
    // password for it, which is a worse experience than the autofill it would be guarding against.
    render(<AgentCliEnvFields agentId="claude" fields={FIELDS} config={CONFIG} onChange={vi.fn()} />);
    const secret = screen.getByTestId('jini-agent-cli-env-claude-ANTHROPIC_AUTH_TOKEN');
    const plain = screen.getByTestId('jini-agent-cli-env-claude-ANTHROPIC_BASE_URL');
    expect(secret.getAttribute('autocomplete')).toBe('new-password');
    expect(plain.getAttribute('autocomplete')).toBe('off');
  });
});
