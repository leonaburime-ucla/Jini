// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TokenChip } from './TokenChip.js';

describe('TokenChip', () => {
  it('renders the label and the raw hex value', () => {
    render(<TokenChip label="colorPrimary" hex="#cc6344" />);
    expect(screen.getByText('colorPrimary')).toBeInTheDocument();
    expect(screen.getByText('#cc6344')).toBeInTheDocument();
  });

  it('swatches the hex as the background of a decorative element', () => {
    const { container } = render(<TokenChip label="colorPrimary" hex="#cc6344" />);
    const swatch = container.querySelector('.jini-token-chip__swatch');
    expect(swatch).toHaveAttribute('aria-hidden', 'true');
    expect((swatch as HTMLElement).style.background).toBe('rgb(204, 99, 68)');
  });
});
