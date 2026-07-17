// Generic light/dark theme + accent-color application: writes a
// `data-theme` attribute and a small set of `--accent*` CSS custom
// properties onto `document.documentElement`. Framework-free — a host
// calls `applyAppearanceToDocument` from whatever state layer it uses
// (a settings store, a React effect, etc.).

export type AppearanceTheme = 'light' | 'dark';

const ACCENT_VARS = [
  '--accent',
  '--accent-strong',
  '--accent-soft',
  '--accent-tint',
  '--accent-hover',
] as const;

/** Neutral default accent — hosts are expected to override via their own
 *  config/branding; this only guarantees the CSS vars are always set. */
export const DEFAULT_ACCENT_COLOR = '#2563eb';

export const ACCENT_SWATCHES = [
  DEFAULT_ACCENT_COLOR,
  '#c96442',
  '#7c3aed',
  '#059669',
  '#dc2626',
  '#d97706',
  '#0891b2',
  '#db2777',
] as const;

/**
 * Validate and lowercase a `#rrggbb` accent color string.
 *
 * @param value - Candidate accent color, typically from persisted config.
 * @returns The lowercased 6-digit hex string, or `null` if `value` is not a
 *   string or does not match `#rrggbb`.
 * @complexity O(1).
 */
export function normalizeAccentColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toLowerCase() : null;
}

/** `normalizeAccentColor(value) ?? DEFAULT_ACCENT_COLOR` — always returns a
 *  usable color. */
export function resolveAccentColor(value: unknown): string {
  return normalizeAccentColor(value) ?? DEFAULT_ACCENT_COLOR;
}

function accentVars(accentColor: string): Record<(typeof ACCENT_VARS)[number], string> {
  return {
    '--accent': accentColor,
    '--accent-strong': `color-mix(in srgb, ${accentColor} 86%, var(--text-strong))`,
    '--accent-soft': `color-mix(in srgb, ${accentColor} 22%, var(--bg-panel))`,
    '--accent-tint': `color-mix(in srgb, ${accentColor} 12%, var(--bg-panel))`,
    '--accent-hover': `color-mix(in srgb, ${accentColor} 90%, var(--text-strong))`,
  };
}

/**
 * Apply a theme + accent color to `document.documentElement`: sets/clears
 * `data-theme` and writes the five `--accent*` custom properties (using
 * `resolveAccentColor`'s fallback when `accentColor` is missing/invalid).
 *
 * @param options.theme - `'light'` / `'dark'` to set `data-theme`, or
 *   `undefined` to remove the attribute (system/auto).
 * @param options.accentColor - Candidate accent color; validated before use.
 * @complexity O(1) — five DOM property writes.
 */
export function applyAppearanceToDocument({
  theme,
  accentColor,
}: {
  theme?: AppearanceTheme;
  accentColor?: string;
}): void {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') {
    root.setAttribute('data-theme', theme);
  } else {
    root.removeAttribute('data-theme');
  }

  const normalized = resolveAccentColor(accentColor);
  const vars = accentVars(normalized);
  for (const name of ACCENT_VARS) {
    root.style.setProperty(name, vars[name]);
  }
}
