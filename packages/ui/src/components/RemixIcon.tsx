import type { CSSProperties } from 'react';

interface RemixIconProps {
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * Thin wrapper around a RemixIcon webfont glyph (`ri-<name>`). The host is
 * responsible for loading the RemixIcon CSS/font — this component only
 * emits the marker element and sizing.
 */
export function RemixIcon({ name, size = 14, className, style }: RemixIconProps) {
  return (
    <i
      className={`ri-${name}${className ? ` ${className}` : ''}`}
      aria-hidden="true"
      style={{
        fontSize: size,
        lineHeight: 1,
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    />
  );
}
