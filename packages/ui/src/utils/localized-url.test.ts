import { describe, expect, it } from 'vitest';
import { buildLocalizedUrl } from './localized-url.js';

describe('buildLocalizedUrl', () => {
  const options = {
    baseUrl: 'https://example.com/docs',
    localeSegments: { 'zh-CN': 'zh', ja: 'ja' },
  };

  it('appends the mapped segment for a supported locale', () => {
    expect(buildLocalizedUrl('zh-CN', options)).toBe('https://example.com/docs/zh/');
  });

  it('falls back to the bare base for an unsupported locale', () => {
    expect(buildLocalizedUrl('fr', options)).toBe('https://example.com/docs/');
  });

  it('falls back to the bare base with no localeSegments supplied', () => {
    expect(buildLocalizedUrl('en', { baseUrl: 'https://example.com' })).toBe('https://example.com/');
  });

  it('strips a trailing slash from baseUrl before joining', () => {
    expect(buildLocalizedUrl('ja', { ...options, baseUrl: 'https://example.com/docs/' })).toBe(
      'https://example.com/docs/ja/',
    );
  });
});
