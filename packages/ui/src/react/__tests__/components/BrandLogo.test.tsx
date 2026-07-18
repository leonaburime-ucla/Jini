// @vitest-environment jsdom
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  advanceLogoStage,
  BrandLogo,
  brandMonogram,
  buildFaviconUrl,
  firstLogoStage,
  resolveLogoSrc,
  useBrandLogo,
  useLogoStage,
  useResolvedLogoSrc,
  type LogoStage,
} from '../../components/BrandLogo.js';

// `alt=""` gives the <img> an implicit role="presentation", removing it from
// the accessibility tree — so every lookup here goes through the container
// rather than `screen.getByRole('img')`.

const favicon = (host: string, size: number) => `fav:${host}:${size}`;

// ---------------------------------------------------------------------------
// Pure helpers — no rendering required.
// ---------------------------------------------------------------------------

describe('buildFaviconUrl', () => {
  it('builds a Google favicon URL for the given host and size', () => {
    expect(buildFaviconUrl('example.com', 64)).toBe(
      'https://www.google.com/s2/favicons?domain=example.com&sz=64',
    );
  });

  it('encodes special characters in the host', () => {
    expect(buildFaviconUrl('exa mple.com', 32)).toBe(
      'https://www.google.com/s2/favicons?domain=exa%20mple.com&sz=32',
    );
  });
});

describe('brandMonogram', () => {
  it('is the first letter, uppercased', () => {
    expect(brandMonogram('acme')).toBe('A');
    expect(brandMonogram('Zebra')).toBe('Z');
  });
});

describe('firstLogoStage', () => {
  it('prefers brand, then custom, then favicon, then letter', () => {
    expect(firstLogoStage({ canUseBrandStage: true, logoSrc: 'x', host: 'h' })).toBe('brand');
    expect(firstLogoStage({ canUseBrandStage: false, logoSrc: 'x', host: 'h' })).toBe('custom');
    expect(firstLogoStage({ canUseBrandStage: false, logoSrc: null, host: 'h' })).toBe('favicon');
    expect(firstLogoStage({ canUseBrandStage: false })).toBe('letter');
  });
});

describe('advanceLogoStage', () => {
  it('advances brand to the next available source', () => {
    expect(advanceLogoStage('brand', { logoSrc: 'x', host: 'h' })).toBe('custom');
    expect(advanceLogoStage('brand', { host: 'h' })).toBe('favicon');
    expect(advanceLogoStage('brand', {})).toBe('letter');
  });

  it('advances custom to favicon and everything else to letter', () => {
    expect(advanceLogoStage('custom', {})).toBe('favicon');
    expect(advanceLogoStage('favicon', {})).toBe('letter');
    expect(advanceLogoStage('letter', {})).toBe('letter');
  });
});

describe('resolveLogoSrc', () => {
  const base = { faviconSize: 32, resolveFaviconUrl: favicon } as const;

  it('resolves the brand URL only when the resolver and id are both present', () => {
    expect(
      resolveLogoSrc({ ...base, stage: 'brand', brandId: 'b1', resolveBrandLogoUrl: (id) => `brand:${id}` }),
    ).toBe('brand:b1');
    // Missing id, or missing resolver, falls through to null.
    expect(resolveLogoSrc({ ...base, stage: 'brand', resolveBrandLogoUrl: (id) => `brand:${id}` })).toBeNull();
    expect(resolveLogoSrc({ ...base, stage: 'brand', brandId: 'b1' })).toBeNull();
  });

  it('resolves the custom logoSrc when present, else null', () => {
    expect(resolveLogoSrc({ ...base, stage: 'custom', logoSrc: 'logo.png' })).toBe('logo.png');
    expect(resolveLogoSrc({ ...base, stage: 'custom', logoSrc: null })).toBeNull();
  });

  it('resolves the favicon when a host is present, else null', () => {
    expect(resolveLogoSrc({ ...base, stage: 'favicon', host: 'example.com' })).toBe('fav:example.com:32');
    expect(resolveLogoSrc({ ...base, stage: 'favicon' })).toBeNull();
  });

  it('is null at the letter stage', () => {
    expect(resolveLogoSrc({ ...base, stage: 'letter' })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Hooks — via renderHook, isolated from the rendered component.
// ---------------------------------------------------------------------------

describe('useLogoStage', () => {
  it('starts at first and advances one stage per fallback call', () => {
    const { result } = renderHook(() =>
      useLogoStage({ first: 'brand', logoSrc: 'logo.png', host: 'example.com', canUseBrandStage: true }),
    );
    expect(result.current.stage).toBe('brand');
    act(() => result.current.fallback());
    expect(result.current.stage).toBe('custom');
    act(() => result.current.fallback());
    expect(result.current.stage).toBe('favicon');
    act(() => result.current.fallback());
    expect(result.current.stage).toBe('letter');
  });

  it('resets to first when the resolvable inputs change', () => {
    const { result, rerender } = renderHook((props) => useLogoStage(props), {
      initialProps: {
        first: 'favicon' as LogoStage,
        logoSrc: null as string | null,
        host: 'example.com' as string | undefined,
        canUseBrandStage: false,
      },
    });
    act(() => result.current.fallback());
    expect(result.current.stage).toBe('letter');
    rerender({ first: 'custom', logoSrc: 'logo.png', host: undefined, canUseBrandStage: false });
    expect(result.current.stage).toBe('custom');
  });
});

describe('useResolvedLogoSrc', () => {
  it('resolves the src for the current stage', () => {
    const { result } = renderHook(() =>
      useResolvedLogoSrc({ stage: 'favicon', host: 'example.com', faviconSize: 40, resolveFaviconUrl: favicon }),
    );
    expect(result.current).toBe('fav:example.com:40');
  });
});

describe('useBrandLogo', () => {
  it('derives the src from the highest available stage and exposes a fallback', () => {
    const { result } = renderHook(() =>
      useBrandLogo({ name: 'Acme', host: 'example.com', faviconSize: 32 }),
    );
    expect(result.current.src).toBe(buildFaviconUrl('example.com', 32));
    act(() => result.current.fallback());
    expect(result.current.src).toBeNull(); // favicon -> letter
  });

  it('returns a null src (monogram fallback) when nothing resolves', () => {
    const { result } = renderHook(() => useBrandLogo({ name: 'Acme', faviconSize: 32 }));
    expect(result.current.src).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Component — the dumb render.
// ---------------------------------------------------------------------------

describe('BrandLogo', () => {
  it('renders the monogram fallback when no source is resolvable', () => {
    const { container } = render(<BrandLogo name="Acme" faviconSize={32} fallbackClassName="fallback" />);
    const fallback = screen.getByText('A');
    expect(fallback.className).toBe('fallback');
    expect(fallback).toHaveAttribute('aria-hidden');
    expect(container.querySelector('img')).toBeNull();
  });

  it('uses the first letter of the name, uppercased, as the fallback', () => {
    render(<BrandLogo name="zebra" faviconSize={32} />);
    expect(screen.getByText('Z')).toBeInTheDocument();
  });

  it('renders logoSrc directly when no brand resolver is supplied', () => {
    const { container } = render(
      <BrandLogo name="Acme" logoSrc="https://cdn.example/logo.png" faviconSize={32} className="logo" />,
    );
    const img = container.querySelector('img')!;
    expect(img).toHaveAttribute('src', 'https://cdn.example/logo.png');
    expect(img.className).toBe('logo');
  });

  it('falls back to the favicon stage when only host is supplied', () => {
    const { container } = render(<BrandLogo name="Acme" host="example.com" faviconSize={40} />);
    const img = container.querySelector('img')!;
    expect(img).toHaveAttribute('src', buildFaviconUrl('example.com', 40));
  });

  it('never enters the brand stage without a resolveBrandLogoUrl even if brandId is given', () => {
    const { container } = render(<BrandLogo name="Acme" brandId="brand-1" host="example.com" faviconSize={40} />);
    const img = container.querySelector('img')!;
    expect(img).toHaveAttribute('src', buildFaviconUrl('example.com', 40));
  });

  it('resolves the brand stage via resolveBrandLogoUrl when both brandId and the resolver are supplied', () => {
    const resolveBrandLogoUrl = vi.fn((id: string) => `https://brands.example/${id}.png`);
    const { container } = render(
      <BrandLogo
        name="Acme"
        brandId="brand-1"
        faviconSize={32}
        resolveBrandLogoUrl={resolveBrandLogoUrl}
      />,
    );
    expect(resolveBrandLogoUrl).toHaveBeenCalledWith('brand-1');
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://brands.example/brand-1.png');
  });

  it('respects a custom resolveFaviconUrl override', () => {
    const resolveFaviconUrl = vi.fn((host: string, size: number) => `https://favicons.example/${host}/${size}`);
    const { container } = render(
      <BrandLogo name="Acme" host="example.com" faviconSize={24} resolveFaviconUrl={resolveFaviconUrl} />,
    );
    expect(resolveFaviconUrl).toHaveBeenCalledWith('example.com', 24);
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://favicons.example/example.com/24');
  });

  it('falls back from brand -> custom -> favicon -> letter as each stage errors', () => {
    const { container } = render(
      <BrandLogo
        name="Acme"
        brandId="brand-1"
        logoSrc="https://cdn.example/logo.png"
        host="example.com"
        faviconSize={32}
        resolveBrandLogoUrl={(id) => `https://brands.example/${id}.png`}
        fallbackClassName="fallback"
      />,
    );
    // Stage 1: brand.
    let img = container.querySelector('img')!;
    expect(img).toHaveAttribute('src', 'https://brands.example/brand-1.png');

    // Stage 2: custom.
    fireEvent.error(img);
    img = container.querySelector('img')!;
    expect(img).toHaveAttribute('src', 'https://cdn.example/logo.png');

    // Stage 3: favicon.
    fireEvent.error(img);
    img = container.querySelector('img')!;
    expect(img).toHaveAttribute('src', buildFaviconUrl('example.com', 32));

    // Stage 4: letter fallback.
    fireEvent.error(img);
    expect(screen.getByText('A')).toHaveClass('fallback');
    expect(container.querySelector('img')).toBeNull();
  });

  it('falls back from brand straight to favicon when there is no logoSrc', () => {
    const { container } = render(
      <BrandLogo
        name="Acme"
        brandId="brand-1"
        host="example.com"
        faviconSize={32}
        resolveBrandLogoUrl={(id) => `https://brands.example/${id}.png`}
      />,
    );
    const img = container.querySelector('img')!;
    expect(img).toHaveAttribute('src', 'https://brands.example/brand-1.png');
    fireEvent.error(img);
    expect(container.querySelector('img')).toHaveAttribute('src', buildFaviconUrl('example.com', 32));
  });

  it('falls back from brand straight to the letter when there is neither logoSrc nor host', () => {
    const { container } = render(
      <BrandLogo
        name="Acme"
        brandId="brand-1"
        faviconSize={32}
        resolveBrandLogoUrl={(id) => `https://brands.example/${id}.png`}
      />,
    );
    const img = container.querySelector('img')!;
    fireEvent.error(img);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('falls back straight from custom to favicon to letter when there is no brand stage', () => {
    const { container } = render(
      <BrandLogo name="Acme" logoSrc="https://cdn.example/logo.png" host="example.com" faviconSize={32} />,
    );
    let img = container.querySelector('img')!;
    expect(img).toHaveAttribute('src', 'https://cdn.example/logo.png');

    fireEvent.error(img);
    img = container.querySelector('img')!;
    expect(img).toHaveAttribute('src', buildFaviconUrl('example.com', 32));

    fireEvent.error(img);
    expect(container.querySelector('img')).toBeNull();
  });

  it('falls back straight from custom to letter when there is no host', () => {
    const { container } = render(<BrandLogo name="Acme" logoSrc="https://cdn.example/logo.png" faviconSize={32} />);
    const img = container.querySelector('img')!;
    fireEvent.error(img);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('falls back straight from favicon to letter when there is no logoSrc', () => {
    const { container } = render(<BrandLogo name="Acme" host="example.com" faviconSize={32} />);
    const img = container.querySelector('img')!;
    fireEvent.error(img);
    expect(container.querySelector('img')).toBeNull();
  });

  it('re-derives the stage when the resolvable props change', () => {
    const { container, rerender } = render(<BrandLogo name="Acme" host="example.com" faviconSize={32} />);
    expect(container.querySelector('img')).toHaveAttribute('src', buildFaviconUrl('example.com', 32));

    rerender(<BrandLogo name="Acme" logoSrc="https://cdn.example/logo.png" faviconSize={32} />);
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://cdn.example/logo.png');
  });

  it('sets loading and referrer attributes for real image stages', () => {
    const { container } = render(<BrandLogo name="Acme" logoSrc="https://cdn.example/logo.png" faviconSize={32} />);
    const img = container.querySelector('img')!;
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(img).toHaveAttribute('alt', '');
  });
});
