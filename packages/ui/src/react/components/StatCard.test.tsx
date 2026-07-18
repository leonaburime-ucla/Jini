import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatCard } from './StatCard.js';

describe('StatCard', () => {
  it('renders the value and label', () => {
    render(<StatCard label="Installed" value={7} />);
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Installed')).toBeInTheDocument();
  });

  it('renders a zero value', () => {
    render(<StatCard label="Installed" value={0} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('appends a caller-supplied className', () => {
    const { container } = render(<StatCard label="Installed" value={7} className="extra" />);
    expect(container.firstChild).toHaveClass('plugins-view__stat');
    expect(container.firstChild).toHaveClass('extra');
  });
});
