// BrandLogo — a resilient brand/site logo with a fallback chain: a
// host-resolved brand-service URL (when a `brandId` + resolver are supplied),
// else an explicit `logoSrc`, else a favicon lookup for `host`, else a
// monogram initial. Each stage that fails to load (`onError`) advances to the
// next, so a broken brand-service image or a dead favicon never renders the
// browser's broken-image glyph.

import { useEffect, useState } from 'react';

type LogoStage = 'brand' | 'custom' | 'favicon' | 'letter';

export interface BrandLogoProps {
  /** Opaque id resolved to a logo URL via `resolveBrandLogoUrl`, when supplied. */
  brandId?: string;
  logoSrc?: string | null;
  host?: string;
  name: string;
  faviconSize: number;
  className?: string;
  fallbackClassName?: string;
  /** Builds a logo URL for `brandId`. Omit to skip the brand-service stage entirely. */
  resolveBrandLogoUrl?: (brandId: string) => string;
  /** Builds a favicon URL for `host`. Defaults to Google's public favicon service. */
  resolveFaviconUrl?: (host: string, size: number) => string;
}

export function buildFaviconUrl(host: string, size: number): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}`;
}

export function BrandLogo({
  brandId,
  logoSrc,
  host,
  name,
  faviconSize,
  className,
  fallbackClassName,
  resolveBrandLogoUrl,
  resolveFaviconUrl = buildFaviconUrl,
}: BrandLogoProps) {
  const canUseBrandStage = Boolean(brandId && resolveBrandLogoUrl);
  const first: LogoStage = canUseBrandStage ? 'brand' : logoSrc ? 'custom' : host ? 'favicon' : 'letter';
  const [stage, setStage] = useState<LogoStage>(first);
  useEffect(() => {
    setStage(first);
  }, [first, canUseBrandStage, logoSrc, host]);

  const src =
    stage === 'brand' && brandId && resolveBrandLogoUrl
      ? resolveBrandLogoUrl(brandId)
      : stage === 'custom' && logoSrc
        ? logoSrc
        : stage === 'favicon' && host
          ? resolveFaviconUrl(host, faviconSize)
          : null;

  if (!src) {
    return (
      <span className={fallbackClassName} aria-hidden>
        {name.slice(0, 1).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      className={className}
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() =>
        setStage((s) =>
          s === 'brand' ? (logoSrc ? 'custom' : host ? 'favicon' : 'letter') : s === 'custom' ? 'favicon' : 'letter',
        )
      }
    />
  );
}
