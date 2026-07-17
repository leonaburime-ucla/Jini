import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SegmentedToggle } from './SegmentedToggle.js';

describe('SegmentedToggle', () => {
  const options = [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Beta', icon: 'check' },
  ];

  it('marks the active option as pressed', () => {
    render(<SegmentedToggle options={options} value="b" onChange={() => {}} ariaLabel="Toggle" />);
    expect(screen.getByRole('button', { name: 'Alpha' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Beta' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onChange with the clicked option value', async () => {
    const onChange = vi.fn();
    render(<SegmentedToggle options={options} value="a" onChange={onChange} ariaLabel="Toggle" />);
    await userEvent.click(screen.getByRole('button', { name: 'Alpha' }));
    expect(onChange).toHaveBeenCalledWith('a');
    await userEvent.click(screen.getByRole('button', { name: 'Beta' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('exposes a group role with the given aria-label', () => {
    render(<SegmentedToggle options={options} value="a" onChange={() => {}} ariaLabel="View mode" />);
    expect(screen.getByRole('group', { name: 'View mode' })).toBeInTheDocument();
  });
});
