import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConnectorLogo } from './ConnectorLogo.js';

describe('ConnectorLogo', () => {
  it('renders an initials fallback when no logoUrl is given', () => {
    const { container } = render(<ConnectorLogo connectorId="slack" connectorName="Slack" />);
    expect(container.querySelector('.connector-logo-fallback')?.textContent).toBe('Sl');
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders an image when a logoUrl is given, falling back to initials on error', () => {
    const { container } = render(<ConnectorLogo connectorId="slack" connectorName="Slack" logoUrl="https://example.com/slack.png" />);
    const img = container.querySelector('img')!;
    expect(img).toBeTruthy();
    act(() => {
      img.dispatchEvent(new Event('error'));
    });
    expect(container.querySelector('.connector-logo')?.className).toContain('is-fallback');
  });

  it('marks state as loaded when the image fires a load event', () => {
    const { container } = render(<ConnectorLogo connectorId="slack" connectorName="Slack" logoUrl="https://example.com/slack.png" />);
    const img = container.querySelector('img')!;
    act(() => {
      img.dispatchEvent(new Event('load'));
    });
    expect(container.querySelector('.connector-logo')?.className).toContain('state-loaded');
  });

  it('is decorative (aria-hidden) since the caption is the accessible label elsewhere', () => {
    render(<ConnectorLogo connectorId="slack" connectorName="Slack" />);
    expect(screen.getByText('Sl').closest('[aria-hidden]')).toBeTruthy();
  });

  it('falls back to the connector name for the fallback-palette seed when connectorId is empty', () => {
    const { container } = render(<ConnectorLogo connectorId="" connectorName="Slack" />);
    // No throw, and a palette index is still assigned from the name.
    expect(container.querySelector('.connector-logo')?.getAttribute('data-palette')).not.toBeNull();
  });

  it('re-derives state as error when the image element is already "complete" but has no real pixels', () => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'complete');
    Object.defineProperty(HTMLImageElement.prototype, 'complete', { configurable: true, get: () => true });
    try {
      const { container } = render(
        <ConnectorLogo connectorId="slack" connectorName="Slack" logoUrl="https://example.com/slack.png" />,
      );
      // naturalWidth defaults to 0 in jsdom, so an already-"complete" image with
      // no real pixels resolves to the error/fallback state via the same
      // synchronous check.
      expect(container.querySelector('.connector-logo')?.className).toContain('state-error');
    } finally {
      if (descriptor) {
        Object.defineProperty(HTMLImageElement.prototype, 'complete', descriptor);
      } else {
        delete (HTMLImageElement.prototype as unknown as { complete?: unknown }).complete;
      }
    }
  });

  it('re-derives state as loaded synchronously when the image element is already complete with real pixels at mount time', () => {
    const completeDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'complete');
    const widthDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'naturalWidth');
    Object.defineProperty(HTMLImageElement.prototype, 'complete', { configurable: true, get: () => true });
    Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', { configurable: true, get: () => 32 });
    try {
      const { container } = render(
        <ConnectorLogo connectorId="slack" connectorName="Slack" logoUrl="https://example.com/slack.png" />,
      );
      expect(container.querySelector('.connector-logo')?.className).toContain('state-loaded');
    } finally {
      if (completeDescriptor) {
        Object.defineProperty(HTMLImageElement.prototype, 'complete', completeDescriptor);
      } else {
        delete (HTMLImageElement.prototype as unknown as { complete?: unknown }).complete;
      }
      if (widthDescriptor) {
        Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', widthDescriptor);
      } else {
        delete (HTMLImageElement.prototype as unknown as { naturalWidth?: unknown }).naturalWidth;
      }
    }
  });

  it('re-checks image completeness without a mounted image element when logoUrl changes on a live component', () => {
    // Render with no logoUrl first (state starts 'error', no <img> is mounted),
    // then supply a logoUrl. On the render that reacts to the prop change the
    // fallback is still showing (state hasn't flipped to 'pending' yet), so
    // the effect's `imageRef.current` read is null — exercising the
    // `image?.complete` short-circuit path for real.
    const { container, rerender } = render(<ConnectorLogo connectorId="slack" connectorName="Slack" />);
    expect(container.querySelector('img')).toBeNull();
    rerender(<ConnectorLogo connectorId="slack" connectorName="Slack" logoUrl="https://example.com/slack.png" />);
    expect(container.querySelector('.connector-logo')?.className).toContain('state-pending');
    expect(container.querySelector('img')).toBeTruthy();
  });
});
