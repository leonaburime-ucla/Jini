// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ComponentKitPreview, type ComponentKitPreviewTokens } from './ComponentKitPreview.js';
import { I18nProvider } from '../../features/i18n/index.js';

const tokens: ComponentKitPreviewTokens = {
  name: 'Acme',
  description: 'A friendly, modern system.',
  displayFont: 'Inter',
  bodyFont: 'Inter',
  radius: 8,
  fontSize: 14,
  colorPrimary: '#cc6344',
  colorPrimaryBg: '#f4e6e1',
  colorPrimaryHover: '#e8bcae',
  colorPrimaryActive: '#20120d',
  light: { background: '#ffffff', surface: '#f5f4f0', foreground: '#1f1f22', muted: '#8a8a8d', border: '#e5e4e0' },
  dark: { background: '#101012', surface: '#1c1c1f', foreground: '#f5f4f0', muted: '#6f6f73', border: '#2b2b2e' },
};

describe('ComponentKitPreview', () => {
  it('renders the light theme tokens as CSS custom properties by default', () => {
    const { container } = render(<ComponentKitPreview tokens={tokens} theme="light" onThemeChange={vi.fn()} />);
    const root = container.querySelector('.jini-component-kit-preview') as HTMLElement;
    expect(root.getAttribute('data-theme')).toBe('light');
    expect(root.style.getPropertyValue('--jini-kit-preview-bg')).toBe(tokens.light.background);
    expect(root.style.getPropertyValue('--jini-kit-preview-radius')).toBe('8px');
  });

  it('switches to the dark theme tokens when theme="dark"', () => {
    const { container } = render(<ComponentKitPreview tokens={tokens} theme="dark" onThemeChange={vi.fn()} />);
    const root = container.querySelector('.jini-component-kit-preview') as HTMLElement;
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(root.style.getPropertyValue('--jini-kit-preview-bg')).toBe(tokens.dark.background);
  });

  it('calls onThemeChange when the Light/Dark tabs are clicked', async () => {
    const onThemeChange = vi.fn();
    render(<ComponentKitPreview tokens={tokens} theme="light" onThemeChange={onThemeChange} />);
    await userEvent.click(screen.getByText('Dark'));
    expect(onThemeChange).toHaveBeenCalledWith('dark');
    await userEvent.click(screen.getByText('Light'));
    expect(onThemeChange).toHaveBeenCalledWith('light');
  });

  it('falls back to a default description when none is given', () => {
    render(<ComponentKitPreview tokens={{ ...tokens, description: undefined }} theme="light" onThemeChange={vi.fn()} />);
    expect(screen.getByText('A generated component style guide.')).toBeInTheDocument();
  });

  it('renders the extracted token/value chips', () => {
    render(<ComponentKitPreview tokens={tokens} theme="light" onThemeChange={vi.fn()} />);
    expect(screen.getByText('colorPrimary')).toBeInTheDocument();
    expect(screen.getByText(tokens.colorPrimary)).toBeInTheDocument();
    expect(screen.getByText('fontSize')).toBeInTheDocument();
    expect(screen.getByText('borderRadius')).toBeInTheDocument();
  });

  it('renders translated labels end-to-end under an I18nProvider', () => {
    render(
      <I18nProvider
        dictionaries={{
          fr: { Preview: 'Aperçu', 'Component kit': 'Kit de composants', Light: 'Clair', Dark: 'Sombre' },
        }}
        initialLocale="fr"
      >
        <ComponentKitPreview tokens={tokens} theme="light" onThemeChange={vi.fn()} />
      </I18nProvider>,
    );
    expect(screen.getByText('Aperçu')).toBeInTheDocument();
    expect(screen.getAllByText('Kit de composants').length).toBeGreaterThan(0);
    expect(screen.getByText('Clair')).toBeInTheDocument();
    expect(screen.getByText('Sombre')).toBeInTheDocument();
  });
});
