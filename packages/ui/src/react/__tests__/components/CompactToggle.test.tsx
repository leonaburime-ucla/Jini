import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CompactToggle } from '../../components/CompactToggle.js';

describe('CompactToggle', () => {
  it('reflects checked state via aria-pressed and the "on" class', () => {
    const { rerender } = render(<CompactToggle label="Widgets" checked={false} onChange={() => {}} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button')).not.toHaveClass('on');
    rerender(<CompactToggle label="Widgets" checked onChange={() => {}} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button')).toHaveClass('on');
  });

  it('calls onChange with the toggled value on click', async () => {
    const onChange = vi.fn();
    render(<CompactToggle label="Widgets" checked={false} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('renders the hint as a native title tooltip', () => {
    render(<CompactToggle label="Widgets" hint="Adds OS widgets" checked={false} onChange={() => {}} />);
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Adds OS widgets');
  });

  it('does not call onChange when disabled', async () => {
    const onChange = vi.fn();
    render(<CompactToggle label="Widgets" checked={false} disabled onChange={onChange} />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveClass('disabled');
    await userEvent.click(button);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('appends a caller-supplied className', () => {
    render(<CompactToggle label="Widgets" checked={false} onChange={() => {}} className="extra" />);
    expect(screen.getByRole('button')).toHaveClass('extra');
  });
});
