/**
 * @module Icon
 *
 * A minimal inline-SVG icon set covering only the glyphs this package's own
 * components use. `@jini/chat-react` cannot depend on `@jini/ui` (not an
 * allowed dependency per r4b §1), so this is a small self-contained subset —
 * not a public export — rather than a full icon library. Stroke paths
 * (Feather/Lucide-style `currentColor` strokes) match `@jini/ui`'s
 * `components/Icon.tsx` for visual consistency across packages, without
 * creating a dependency edge between them.
 */
import type { SVGProps } from 'react';

export type IconName = 'spinner' | 'check' | 'close' | 'chevron-down' | 'chevron-right' | 'send' | 'attach' | 'x';

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number | string;
}

export function Icon({ name, size = 14, strokeWidth = 1.6, ...rest }: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: 'false' as const,
    ...rest,
  };
  switch (name) {
    case 'spinner':
      return (
        <svg {...common} className={`jini-icon-spin ${rest.className ?? ''}`.trim()}>
          <path d="M21 12a9 9 0 1 1-6.22-8.56" />
        </svg>
      );
    case 'check':
      return (
        <svg {...common}>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      );
    case 'close':
    case 'x':
      return (
        <svg {...common}>
          <path d="M20 4 4 20" />
          <path d="m4 4 16 16" />
        </svg>
      );
    case 'chevron-down':
      return (
        <svg {...common}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      );
    case 'chevron-right':
      return (
        <svg {...common}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      );
    case 'send':
      return (
        <svg {...common}>
          <path d="M12 19V5" />
          <path d="m5 12 7-7 7 7" />
        </svg>
      );
    case 'attach':
      return (
        <svg {...common}>
          <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
      );
  }
}
