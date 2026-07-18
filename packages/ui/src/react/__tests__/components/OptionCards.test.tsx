import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OptionCards } from '../../components/OptionCards.js';

describe('OptionCards', () => {
  const options = [
    { value: 'a', title: 'Option A', hint: 'First choice' },
    { value: 'b', title: 'Option B' },
  ];

  it('renders the label, every option title, and marks the active one pressed', () => {
    render(<OptionCards label="Pick one" options={options} value="a" onChange={() => {}} />);
    expect(screen.getByText('Pick one')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Option A/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Option B/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders an option hint only when provided', () => {
    render(<OptionCards label="Pick one" options={options} value="a" onChange={() => {}} />);
    expect(screen.getByText('First choice')).toBeInTheDocument();
  });

  it('calls onChange with the clicked option value', async () => {
    const onChange = vi.fn();
    render(<OptionCards label="Pick one" options={options} value="a" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /Option B/ }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('appends a caller-supplied className', () => {
    const { container } = render(
      <OptionCards label="Pick one" options={options} value="a" onChange={() => {}} className="extra" />,
    );
    expect(container.firstChild).toHaveClass('newproj-media-field');
    expect(container.firstChild).toHaveClass('extra');
  });

  it('supports numeric option values', async () => {
    const numericOptions = [
      { value: 1, title: 'One' },
      { value: 2, title: 'Two' },
    ];
    const onChange = vi.fn();
    render(<OptionCards label="Pick a number" options={numericOptions} value={1} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Two' }));
    expect(onChange).toHaveBeenCalledWith(2);
  });
});
