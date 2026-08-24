import type { CSSProperties } from 'react';

interface Props {
  id: string;
  size?: number;
  className?: string;
  /** Overrides where assets are served from as `${basePath}/<id>.<ext>`. Omit to use this
   *  package's own bundled icon set (`BUNDLED_ICON_URLS`) instead. */
  basePath?: string;
}

// Coding-agent CLIs that ship a bundled brand asset under the host's
// `<basePath>/` (e.g. a public `/agent-icons/` directory). SVG is preferred
// (resolution-independent, single file ≤ a few KB); PNG is the fallback for
// vendors that don't publish an SVG mark. New brand: drop the optimised file
// in that folder and add the id here.
const ICON_EXT: Record<string, 'svg' | 'png'> = {
  amr: 'svg',
  claude: 'svg',
  codex: 'svg',
  gemini: 'svg',
  opencode: 'svg',
  'cursor-agent': 'svg',
  copilot: 'svg',
  qwen: 'svg',
  qoder: 'svg',
  deepseek: 'svg',
  reasonix: 'svg',
  mimo: 'svg',
  hermes: 'svg',
  'grok-build': 'svg',
  kimi: 'svg',
  pi: 'svg',
  kiro: 'svg',
  kilo: 'svg',
  vibe: 'svg',
  antigravity: 'svg',
  aider: 'png',
  'trae-cli': 'png',
  devin: 'png',
};

// SVG marks that are single-color silhouettes (no baked brand colors).
// Rendered as a CSS-masked `<span>` so `background-color: currentColor`
// can paint them in whatever text color the surrounding theme resolves
// to — light text under dark theme, dark text under light theme. The
// SVG file itself uses an explicit dark fill (baked) instead of
// `currentColor`, so if anything outside this component ever loads
// the asset through `<img>` it still renders as a legible dark mark
// rather than collapsing to the SVG document's default black-on-…-black.
const MONO_ICONS = new Set([
  'cursor-agent',
  'opencode',
  'hermes',
  'mimo',
  'kilo',
  'grok-build',
]);

/**
 * This package's own bundled brand marks, resolved relative to wherever `@jini-ai/ui` itself was
 * loaded from. `new URL('./file', import.meta.url)` is rewritten correctly by Vite/Rollup/webpack
 * at build time — the same fix already applied to `RemixIcon.tsx`'s font loading — so it resolves
 * under a bundler dev server AND after a production build loaded over `file://`, unlike the old
 * hardcoded `/agent-icons` root-absolute default: that default 404s outright under `file://` (an
 * absolute path resolves against the OS filesystem root there, not the app bundle) and required
 * every host to vendor the actual image files themselves, which none had — every agent icon 404'd
 * with no host-facing way to fix it, since `basePath` was never threaded through `ChatPane`.
 *
 * Only lists ids this package actually ships artwork for (a subset of `ICON_EXT` — the three PNG
 * brands aren't bundled here yet). A host that already vendors its own assets and passes an
 * explicit `basePath` is unaffected by this map; see the `basePath` branch below.
 */
const BUNDLED_ICON_URLS: Partial<Record<string, string>> = {
  amr: new URL('./agent-icons/amr.svg', import.meta.url).href,
  claude: new URL('./agent-icons/claude.svg', import.meta.url).href,
  codex: new URL('./agent-icons/codex.svg', import.meta.url).href,
  gemini: new URL('./agent-icons/gemini.svg', import.meta.url).href,
  opencode: new URL('./agent-icons/opencode.svg', import.meta.url).href,
  'cursor-agent': new URL('./agent-icons/cursor-agent.svg', import.meta.url).href,
  copilot: new URL('./agent-icons/copilot.svg', import.meta.url).href,
  qwen: new URL('./agent-icons/qwen.svg', import.meta.url).href,
  qoder: new URL('./agent-icons/qoder.svg', import.meta.url).href,
  deepseek: new URL('./agent-icons/deepseek.svg', import.meta.url).href,
  reasonix: new URL('./agent-icons/reasonix.svg', import.meta.url).href,
  mimo: new URL('./agent-icons/mimo.svg', import.meta.url).href,
  hermes: new URL('./agent-icons/hermes.svg', import.meta.url).href,
  'grok-build': new URL('./agent-icons/grok-build.svg', import.meta.url).href,
  kimi: new URL('./agent-icons/kimi.svg', import.meta.url).href,
  pi: new URL('./agent-icons/pi.svg', import.meta.url).href,
  kiro: new URL('./agent-icons/kiro.svg', import.meta.url).href,
  kilo: new URL('./agent-icons/kilo.svg', import.meta.url).href,
  vibe: new URL('./agent-icons/vibe.svg', import.meta.url).href,
  antigravity: new URL('./agent-icons/antigravity.svg', import.meta.url).href,
};

/**
 * Renders a coding-agent's brand mark by id, with a graceful initial-letter
 * fallback for ids the host hasn't shipped artwork for. A host-supplied
 * `basePath` always wins (backward compatible with hosts already vendoring
 * their own copies); otherwise this falls back to `BUNDLED_ICON_URLS`.
 */
export function AgentIcon({ id, size = 36, className, basePath }: Props) {
  const cls = 'agent-icon' + (className ? ' ' + className : '');
  const ext = ICON_EXT[id];
  if (ext) {
    const src = basePath !== undefined ? `${basePath}/${id}.${ext}` : BUNDLED_ICON_URLS[id];
    if (src !== undefined) {
      if (ext === 'svg' && MONO_ICONS.has(id)) {
        const style: CSSProperties = {
          width: size,
          height: size,
          WebkitMaskImage: `url("${src}")`,
          maskImage: `url("${src}")`,
        };
        return (
          <span
            className={cls + ' agent-icon-mono'}
            style={style}
            aria-hidden="true"
          />
        );
      }
      return (
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          className={cls}
          aria-hidden="true"
          draggable={false}
        />
      );
    }
  }
  // Fallback for brands we don't ship artwork for. A neutral rounded
  // square with the initial letter — reads as "no official mark yet"
  // without inventing brand artwork we can't license.
  const initial = (id.match(/[a-z]/i)?.[0] ?? '?').toUpperCase();
  return (
    <span
      className={cls + ' agent-icon-fallback'}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        lineHeight: 1,
      }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
