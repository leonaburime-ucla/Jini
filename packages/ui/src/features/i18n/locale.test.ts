import { describe, expect, it, vi } from 'vitest';
import { detectInitialLocale, resolveSystemLocale } from './locale.js';
import type { LocalePersistencePort } from './locale.js';

describe('resolveSystemLocale', () => {
  const supported = ['en', 'fr', 'zh-CN', 'zh-TW', 'pt-BR'];

  it('returns an exact case-insensitive match', () => {
    expect(resolveSystemLocale(['FR'], supported)).toBe('fr');
    expect(resolveSystemLocale(['pt-br'], supported)).toBe('pt-BR');
  });

  it('resolves a bare base-language tag to the matching supported locale', () => {
    expect(resolveSystemLocale(['en-GB'], supported)).toBe('en');
  });

  it('resolves Chinese script/region signals to simplified vs traditional', () => {
    expect(resolveSystemLocale(['zh-Hant'], supported)).toBe('zh-TW');
    expect(resolveSystemLocale(['zh-TW'], supported)).toBe('zh-TW');
    expect(resolveSystemLocale(['zh-HK'], supported)).toBe('zh-TW');
    expect(resolveSystemLocale(['zh'], supported)).toBe('zh-CN');
    expect(resolveSystemLocale(['zh-SG'], supported)).toBe('zh-CN');
  });

  it('does not resolve the Chinese special-case to an unsupported candidate', () => {
    expect(resolveSystemLocale(['zh-Hant'], ['en', 'zh-CN'])).toBe('zh-CN');
  });

  it('falls through a list of preferred languages in order', () => {
    expect(resolveSystemLocale(['xx', 'de', 'fr'], supported)).toBe('fr');
  });

  it('skips blank entries without throwing', () => {
    expect(resolveSystemLocale(['', '  ', 'fr'], supported)).toBe('fr');
  });

  it('returns null when nothing matches', () => {
    expect(resolveSystemLocale(['xx', 'yy'], supported)).toBeNull();
  });

  it('returns null for an empty language list', () => {
    expect(resolveSystemLocale([], supported)).toBeNull();
  });
});

describe('detectInitialLocale', () => {
  const supportedLocales = ['en', 'fr'];

  it('prefers a persisted locale when it is supported', () => {
    const persistence: LocalePersistencePort = {
      getStoredLocale: () => 'fr',
      setStoredLocale: vi.fn(),
    };
    const result = detectInitialLocale({
      supportedLocales,
      fallbackLocale: 'en',
      persistence,
      detectSystemLocale: () => 'en',
    });
    expect(result).toBe('fr');
  });

  it('ignores a persisted locale outside the supported set', () => {
    const persistence: LocalePersistencePort = {
      getStoredLocale: () => 'de',
      setStoredLocale: vi.fn(),
    };
    const result = detectInitialLocale({
      supportedLocales,
      fallbackLocale: 'en',
      persistence,
      detectSystemLocale: () => 'fr',
    });
    expect(result).toBe('fr');
  });

  it('falls back to system detection when there is no persisted locale', () => {
    const result = detectInitialLocale({
      supportedLocales,
      fallbackLocale: 'en',
      detectSystemLocale: () => 'fr',
    });
    expect(result).toBe('fr');
  });

  it('falls back to fallbackLocale when nothing resolves', () => {
    const result = detectInitialLocale({
      supportedLocales,
      fallbackLocale: 'en',
      detectSystemLocale: () => 'de',
    });
    expect(result).toBe('en');
  });

  it('returns fallbackLocale outside a window context (SSR)', () => {
    const original = globalThis.window;
    // @ts-expect-error -- simulate an SSR environment for this one assertion
    delete globalThis.window;
    try {
      const result = detectInitialLocale({
        supportedLocales,
        fallbackLocale: 'en',
        detectSystemLocale: () => 'fr',
      });
      expect(result).toBe('en');
    } finally {
      globalThis.window = original;
    }
  });
});
