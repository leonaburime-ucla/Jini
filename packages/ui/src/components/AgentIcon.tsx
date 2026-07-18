import type { CSSProperties } from 'react';

interface Props {
  id: string;
  size?: number;
  className?: string;
  /** Base path assets are served from. Defaults to `/agent-icons`. */
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
 * Renders a coding-agent's brand mark by id, with a graceful initial-letter
 * fallback for ids the host hasn't shipped artwork for. Assets are expected
 * to live under `${basePath}/<id>.<ext>` (default basePath `/agent-icons`).
 */
export function AgentIcon({ id, size = 36, className, basePath = '/agent-icons' }: Props) {
  const cls = 'agent-icon' + (className ? ' ' + className : '');
  const ext = ICON_EXT[id];
  if (ext) {
    if (ext === 'svg' && MONO_ICONS.has(id)) {
      const src = `${basePath}/${id}.svg`;
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
        src={`${basePath}/${id}.${ext}`}
        alt=""
        width={size}
        height={size}
        className={cls}
        aria-hidden="true"
        draggable={false}
      />
    );
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
