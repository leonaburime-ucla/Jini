import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../../../../features/i18n/index.js';
import type { PrivacyConsentState } from '../../types.js';
import { PrivacyTab } from './PrivacyTab.js';

const NOW = 1_700_000_000_000;

function undecidedState(): PrivacyConsentState {
  return { telemetry: {}, installationId: null, privacyDecisionAt: null };
}

function decidedState(overrides: Partial<PrivacyConsentState> = {}): PrivacyConsentState {
  return {
    telemetry: { metrics: true, content: false },
    installationId: 'abc-123',
    privacyDecisionAt: NOW - 1000,
    ...overrides,
  };
}

describe('PrivacyTab', () => {
  it('shows only the consent card (no toggles/installation id) before a decision is made', () => {
    render(<PrivacyTab state={undecidedState()} onChange={() => {}} now={() => NOW} />);
    expect(screen.getByRole('button', { name: 'Share usage' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Anonymous metrics/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Installation ID')).not.toBeInTheDocument();
  });

  it('shows the toggles and installation id once a decision has been made', () => {
    render(<PrivacyTab state={decidedState()} onChange={() => {}} now={() => NOW} />);
    expect(screen.getByLabelText('Installation ID')).toHaveValue('abc-123');
    expect(screen.getByRole('button', { name: /Anonymous metrics/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Conversation and tool content/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('"Share usage" opts into both categories and generates an installation id', async () => {
    const onChange = vi.fn();
    render(<PrivacyTab state={undecidedState()} onChange={onChange} now={() => NOW} />);
    await userEvent.click(screen.getByRole('button', { name: 'Share usage' }));
    const next = onChange.mock.calls[0]![0] as PrivacyConsentState;
    expect(next.telemetry).toEqual({ metrics: true, content: true });
    expect(next.installationId).toBeTruthy();
    expect(next.privacyDecisionAt).toBe(NOW);
  });

  it('"Don\'t share" declines both categories and clears the installation id', async () => {
    const onChange = vi.fn();
    render(<PrivacyTab state={decidedState()} onChange={onChange} now={() => NOW} />);
    await userEvent.click(screen.getByRole('button', { name: "Don't share" }));
    const next = onChange.mock.calls[0]![0] as PrivacyConsentState;
    expect(next.telemetry).toEqual({ metrics: false, content: false });
    expect(next.installationId).toBeNull();
  });

  it('toggling a category calls onChange with the patched telemetry', async () => {
    const onChange = vi.fn();
    render(<PrivacyTab state={decidedState()} onChange={onChange} now={() => NOW} />);
    await userEvent.click(screen.getByRole('button', { name: /Conversation and tool content/ }));
    const next = onChange.mock.calls[0]![0] as PrivacyConsentState;
    expect(next.telemetry.content).toBe(true);
  });

  it('"Delete my data" rotates the installation id', async () => {
    const onChange = vi.fn();
    render(<PrivacyTab state={decidedState()} onChange={onChange} now={() => NOW} />);
    await userEvent.click(screen.getByRole('button', { name: /Delete my data/ }));
    const next = onChange.mock.calls[0]![0] as PrivacyConsentState;
    expect(next.installationId).not.toBe('abc-123');
    expect(next.telemetry).toEqual({ metrics: false, content: false });
  });

  it('shows the opted-out label instead of a raw id when installationId is null', () => {
    render(<PrivacyTab state={decidedState({ installationId: null })} onChange={() => {}} now={() => NOW} />);
    expect(screen.getByLabelText('Installation ID')).toHaveValue('Not sharing');
  });

  it('renders translated copy when mounted under an I18nProvider with a matching dictionary', () => {
    render(
      <I18nProvider dictionaries={{ fr: { 'Share usage': 'Partager' } }} initialLocale="fr">
        <PrivacyTab state={undecidedState()} onChange={() => {}} now={() => NOW} />
      </I18nProvider>,
    );
    expect(screen.getByRole('button', { name: 'Partager' })).toBeInTheDocument();
  });
});
