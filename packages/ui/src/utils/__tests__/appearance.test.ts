import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ACCENT_SWATCHES,
  DEFAULT_ACCENT_COLOR,
  applyAppearanceToDocument,
  normalizeAccentColor,
  resolveAccentColor,
} from '../appearance.js';

describe('normalizeAccentColor', () => {
  it('accepts a lowercase 6-digit hex color unchanged', () => {
    expect(normalizeAccentColor('#2563eb')).toBe('#2563eb');
  });

  it('lowercases an uppercase hex color', () => {
    expect(normalizeAccentColor('#ABCDEF')).toBe('#abcdef');
  });

  it('rejects non-string, malformed, and short-hex values', () => {
    expect(normalizeAccentColor(undefined)).toBeNull();
    expect(normalizeAccentColor(123)).toBeNull();
    expect(normalizeAccentColor('#abc')).toBeNull();
    expect(normalizeAccentColor('not-a-color')).toBeNull();
  });
});

describe('resolveAccentColor', () => {
  it('falls back to the default when the input is invalid', () => {
    expect(resolveAccentColor('nope')).toBe(DEFAULT_ACCENT_COLOR);
  });

  it('passes through a valid color', () => {
    expect(resolveAccentColor('#ff0000')).toBe('#ff0000');
  });
});

describe('ACCENT_SWATCHES', () => {
  it('leads with the default accent color', () => {
    expect(ACCENT_SWATCHES[0]).toBe(DEFAULT_ACCENT_COLOR);
  });
});

describe('applyAppearanceToDocument', () => {
  function installFakeDocumentElement() {
    const setAttribute = vi.fn();
    const removeAttribute = vi.fn();
    const setProperty = vi.fn();
    vi.stubGlobal('document', {
      documentElement: {
        setAttribute,
        removeAttribute,
        style: { setProperty },
      },
    });
    return { setAttribute, removeAttribute, setProperty };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets data-theme for a valid theme and writes all five accent vars', () => {
    const { setAttribute, removeAttribute, setProperty } = installFakeDocumentElement();

    applyAppearanceToDocument({ theme: 'dark', accentColor: '#ff0000' });

    expect(setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
    expect(removeAttribute).not.toHaveBeenCalled();
    expect(setProperty).toHaveBeenCalledWith('--accent', '#ff0000');
    expect(setProperty).toHaveBeenCalledTimes(5);
  });

  it('removes data-theme when theme is omitted (system/auto)', () => {
    const { removeAttribute, setAttribute } = installFakeDocumentElement();

    applyAppearanceToDocument({});

    expect(removeAttribute).toHaveBeenCalledWith('data-theme');
    expect(setAttribute).not.toHaveBeenCalled();
  });

  it('falls back to the default accent color when accentColor is invalid', () => {
    const { setProperty } = installFakeDocumentElement();

    applyAppearanceToDocument({ accentColor: 'garbage' });

    expect(setProperty).toHaveBeenCalledWith('--accent', DEFAULT_ACCENT_COLOR);
  });
});
