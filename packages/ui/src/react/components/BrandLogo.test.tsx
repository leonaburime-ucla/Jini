// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BrandLogo, buildFaviconUrl } from './BrandLogo.js';

// `alt=""` gives the <img> an implicit role="presentation", removing it from
// the accessibility tree — so every lookup here goes through the container
// rather than `screen.getByRole('img')`.

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
