import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PopoverItem } from '../../components/PopoverItem.js';

describe('PopoverItem', () => {
  it('renders the label and calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<PopoverItem label="New project each run" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'New project each run' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders a hint line when provided, and omits it when absent', () => {
    const { rerender } = render(<PopoverItem label="Hourly" hint="Every hour" onClick={() => {}} />);
    expect(screen.getByText('Every hour')).toBeInTheDocument();
    rerender(<PopoverItem label="Hourly" onClick={() => {}} />);
    expect(screen.queryByText('Every hour')).not.toBeInTheDocument();
  });

  it('marks the item selected and renders the selectedIcon slot only when selected', () => {
    const { rerender, container } = render(
      <PopoverItem label="Acme" selected selectedIcon={<span data-testid="check" />} onClick={() => {}} />,
    );
    expect(container.querySelector('.jini-popover__item')?.className).toContain('is-selected');
    expect(screen.getByTestId('check')).toBeInTheDocument();

    rerender(<PopoverItem label="Acme" selectedIcon={<span data-testid="check" />} onClick={() => {}} />);
    expect(container.querySelector('.jini-popover__item')?.className).not.toContain('is-selected');
    expect(screen.queryByTestId('check')).not.toBeInTheDocument();
  });

  it('sets a title attribute for the native tooltip when provided', () => {
    render(<PopoverItem label="A very long project name" title="A very long project name" onClick={() => {}} />);
    expect(screen.getByRole('button')).toHaveAttribute('title', 'A very long project name');
  });
});
