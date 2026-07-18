// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CustomSelect } from './CustomSelect.js';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma', disabled: true },
];

describe('CustomSelect', () => {
  it('shows the selected option label on the trigger', () => {
    render(<CustomSelect value="b" options={OPTIONS} onChange={vi.fn()} ariaLabel="Pick" portal={false} />);
    expect(screen.getByRole('combobox').textContent).toContain('Beta');
  });

  it('opens the listbox and calls onChange when an option is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CustomSelect value="a" options={OPTIONS} onChange={onChange} ariaLabel="Pick" portal={false} />);
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeTruthy();
    await user.click(screen.getByText('Beta'));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('does not select a disabled option', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CustomSelect value="a" options={OPTIONS} onChange={onChange} ariaLabel="Pick" portal={false} />);
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Gamma'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('groups options under their group label', async () => {
    const user = userEvent.setup();
    const grouped = [{ label: 'Greek letters', options: OPTIONS.slice(0, 2) }];
    render(<CustomSelect value="a" options={grouped} onChange={vi.fn()} ariaLabel="Pick" portal={false} />);
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByText('Greek letters')).toBeTruthy();
  });

  it('closes on Escape without changing the value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CustomSelect value="a" options={OPTIONS} onChange={onChange} ariaLabel="Pick" portal={false} />);
    const trigger = screen.getByRole('combobox');
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('falls back to the placeholder when the value matches no option', () => {
    render(
      <CustomSelect
        value="missing"
        options={OPTIONS}
        onChange={vi.fn()}
        ariaLabel="Pick"
        placeholder="Choose one"
        portal={false}
      />,
    );
    expect(screen.getByRole('combobox').textContent).toContain('Choose one');
  });
});
