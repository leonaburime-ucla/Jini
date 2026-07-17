import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider, useI18n, useT } from './context.js';
import type { TranslationDict } from './types.js';

interface Dict extends TranslationDict {
  greeting: string;
  withVar: string;
}

const EN: Dict = { greeting: 'Hello', withVar: 'Hello {name}' };
const FR: Dict = { greeting: 'Bonjour', withVar: 'Bonjour {name}' };

function Probe() {
  const { locale, t } = useI18n();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="greeting">{t('greeting')}</span>
      <span data-testid="withVar">{t('withVar', { name: 'Ada' })}</span>
      <span data-testid="missing">{t('missingKey')}</span>
    </div>
  );
}

describe('useI18n / useT without a provider', () => {
  it('behaves as a passthrough translator (key back as-is)', () => {
    render(<Probe />);
    expect(screen.getByTestId('locale').textContent).toBe('en');
    expect(screen.getByTestId('greeting').textContent).toBe('greeting');
    expect(screen.getByTestId('withVar').textContent).toBe('withVar');
  });

  it('useT() returns just the translator function', () => {
    function OnlyT() {
      const t = useT();
      return <span data-testid="t">{t('greeting')}</span>;
    }
    render(<OnlyT />);
    expect(screen.getByTestId('t').textContent).toBe('greeting');
  });
});

describe('I18nProvider', () => {
  it('translates from the dictionary for the active locale', () => {
    render(
      <I18nProvider initialLocale="en" dictionaries={{ en: EN, fr: FR }}>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId('locale').textContent).toBe('en');
    expect(screen.getByTestId('greeting').textContent).toBe('Hello');
  });

  it('interpolates {vars} into the translated string', () => {
    render(
      <I18nProvider initialLocale="en" dictionaries={{ en: EN, fr: FR }}>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId('withVar').textContent).toBe('Hello Ada');
  });

  it('falls back to the raw key when it is missing from every dictionary', () => {
    render(
      <I18nProvider initialLocale="en" dictionaries={{ en: EN, fr: FR }}>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId('missing').textContent).toBe('missingKey');
  });

  it('falls back to the fallbackLocale dictionary when a key is missing from the active locale', () => {
    interface PartialDict extends TranslationDict {
      onlyInFr: string;
    }
    const partialFr: PartialDict = { onlyInFr: 'Seulement en français' };
    function OnlyInFrProbe() {
      const t = useT();
      return <span data-testid="onlyInFr">{t('onlyInFr')}</span>;
    }
    render(
      <I18nProvider initialLocale="en" fallbackLocale="fr" dictionaries={{ en: EN, fr: partialFr }}>
        <OnlyInFrProbe />
      </I18nProvider>,
    );
    expect(screen.getByTestId('onlyInFr').textContent).toBe('Seulement en français');
  });

  it('runs in passthrough mode when mounted with no dictionaries at all', () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId('greeting').textContent).toBe('greeting');
  });

  it('setLocale updates the active locale and persists the choice', () => {
    const setStoredLocale = vi.fn();
    function Switcher() {
      const { locale, setLocale, t } = useI18n();
      return (
        <div>
          <span data-testid="locale">{locale}</span>
          <span data-testid="greeting">{t('greeting')}</span>
          <button onClick={() => setLocale('fr')}>switch</button>
        </div>
      );
    }
    render(
      <I18nProvider
        initialLocale="en"
        dictionaries={{ en: EN, fr: FR }}
        persistence={{ getStoredLocale: () => null, setStoredLocale }}
      >
        <Switcher />
      </I18nProvider>,
    );
    expect(screen.getByTestId('locale').textContent).toBe('en');
    act(() => {
      screen.getByRole('button', { name: 'switch' }).click();
    });
    expect(screen.getByTestId('locale').textContent).toBe('fr');
    expect(screen.getByTestId('greeting').textContent).toBe('Bonjour');
    expect(setStoredLocale).toHaveBeenCalledWith('fr');
  });

  it('syncs <html lang/dir> and flips dir for an RTL locale', () => {
    render(
      <I18nProvider initialLocale="en" dictionaries={{ en: EN }}>
        <Probe />
      </I18nProvider>,
    );
    expect(document.documentElement.getAttribute('lang')).toBe('en');
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
  });

  it('treats a locale in rtlLocales as right-to-left', () => {
    interface ArDict extends TranslationDict {
      greeting: string;
    }
    const ar: ArDict = { greeting: 'مرحبا' };
    render(
      <I18nProvider initialLocale="ar" dictionaries={{ ar }}>
        <Probe />
      </I18nProvider>,
    );
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  });

  it('does not touch document attributes when syncDocumentAttributes is false', () => {
    document.documentElement.removeAttribute('lang');
    document.documentElement.removeAttribute('dir');
    render(
      <I18nProvider initialLocale="fr" dictionaries={{ fr: FR }} syncDocumentAttributes={false}>
        <Probe />
      </I18nProvider>,
    );
    expect(document.documentElement.getAttribute('lang')).toBeNull();
    expect(document.documentElement.getAttribute('dir')).toBeNull();
  });
});
