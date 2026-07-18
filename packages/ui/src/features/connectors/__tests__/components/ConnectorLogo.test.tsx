import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConnectorLogo } from '../../components/ConnectorLogo.js';

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

  it('is decorative (aria-hidden) since the caption is the accessible label elsewhere', () => {
    render(<ConnectorLogo connectorId="slack" connectorName="Slack" />);
    expect(screen.getByText('Sl').closest('[aria-hidden]')).toBeTruthy();
  });
});
