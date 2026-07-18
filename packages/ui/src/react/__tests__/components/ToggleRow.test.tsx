import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToggleRow } from '../../components/ToggleRow.js';

describe('ToggleRow', () => {
  it('reflects checked state via aria-pressed and the "on" class', () => {
    const { rerender } = render(<ToggleRow label="Animations" checked={false} onChange={() => {}} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button')).not.toHaveClass('on');
    rerender(<ToggleRow label="Animations" checked onChange={() => {}} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button')).toHaveClass('on');
  });

  it('renders the hint as inline text when provided, and omits it otherwise', () => {
    const { rerender } = render(<ToggleRow label="Animations" hint="Enable transitions" checked={false} onChange={() => {}} />);
    expect(screen.getByText('Enable transitions')).toBeInTheDocument();
    rerender(<ToggleRow label="Animations" checked={false} onChange={() => {}} />);
    expect(screen.queryByText('Enable transitions')).not.toBeInTheDocument();
  });

  it('calls onChange with the toggled value on click', async () => {
    const onChange = vi.fn();
    render(<ToggleRow label="Animations" checked={false} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not call onChange when disabled', async () => {
    const onChange = vi.fn();
    render(<ToggleRow label="Animations" checked={false} disabled onChange={onChange} />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveClass('disabled');
    await userEvent.click(button);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('appends a caller-supplied className', () => {
    render(<ToggleRow label="Animations" checked={false} onChange={() => {}} className="extra" />);
    expect(screen.getByRole('button')).toHaveClass('extra');
  });
});
