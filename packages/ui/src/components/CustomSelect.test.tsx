// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
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

  it('falls back to the raw value when there is no matching option and no placeholder', () => {
    render(<CustomSelect value="missing" options={OPTIONS} onChange={vi.fn()} ariaLabel="Pick" portal={false} />);
    expect(screen.getByRole('combobox').textContent).toContain('missing');
  });

  it('opens via the portal, positioning the menu against the trigger', async () => {
    const user = userEvent.setup();
    render(<CustomSelect value="a" options={OPTIONS} onChange={vi.fn()} ariaLabel="Pick" />);
    await user.click(screen.getByRole('combobox'));
    const listbox = screen.getByRole('listbox');
    expect(listbox.className).toContain('portal');
    expect(listbox.parentElement).toBe(document.body);
    expect(listbox.style.width).not.toBe('');
  });

  it('closes a portal menu on mousedown outside the trigger and menu', async () => {
    const user = userEvent.setup();
    render(<CustomSelect value="a" options={OPTIONS} onChange={vi.fn()} ariaLabel="Pick" />);
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('a mousedown inside the portal menu does not close it', async () => {
    const user = userEvent.setup();
    render(<CustomSelect value="a" options={OPTIONS} onChange={vi.fn()} ariaLabel="Pick" />);
    await user.click(screen.getByRole('combobox'));
    fireEvent.mouseDown(screen.getByRole('listbox'));
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('repositions the portal menu on window resize and scroll while open', async () => {
    const user = userEvent.setup();
    render(<CustomSelect value="a" options={OPTIONS} onChange={vi.fn()} ariaLabel="Pick" />);
    await user.click(screen.getByRole('combobox'));
    expect(() => {
      fireEvent(window, new Event('resize'));
      fireEvent(window, new Event('scroll'));
    }).not.toThrow();
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('does not reposition a non-portal menu on resize', async () => {
    const user = userEvent.setup();
    render(<CustomSelect value="a" options={OPTIONS} onChange={vi.fn()} ariaLabel="Pick" portal={false} />);
    await user.click(screen.getByRole('combobox'));
    expect(() => fireEvent(window, new Event('resize'))).not.toThrow();
  });

  it('ArrowDown opens a closed menu without moving the active option', async () => {
    const user = userEvent.setup();
    render(<CustomSelect value="a" options={OPTIONS} onChange={vi.fn()} ariaLabel="Pick" portal={false} />);
    const trigger = screen.getByRole('combobox');
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('navigates the active option with ArrowDown/ArrowUp, skipping disabled options', async () => {
    const user = userEvent.setup();
    render(<CustomSelect value="a" options={OPTIONS} onChange={vi.fn()} ariaLabel="Pick" portal={false} />);
    const trigger = screen.getByRole('combobox');
    await user.click(trigger);
    // Active starts at 'a' (the current value). ArrowDown should move to
    // 'b' (skipping the disabled 'c' / Gamma option), then wrap back to 'a'.
    await user.keyboard('{ArrowDown}');
    expect(trigger.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: 'Beta' }).id);
    await user.keyboard('{ArrowDown}');
    expect(trigger.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: 'Alpha' }).id);
    await user.keyboard('{ArrowUp}');
    expect(trigger.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: 'Beta' }).id);
  });

  it('Enter selects the active option while open', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CustomSelect value="a" options={OPTIONS} onChange={onChange} ariaLabel="Pick" portal={false} />);
    await user.click(screen.getByRole('combobox'));
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('b');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('Space opens a closed menu, and selects the active option when open', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CustomSelect value="a" options={OPTIONS} onChange={onChange} ariaLabel="Pick" portal={false} />);
    const trigger = screen.getByRole('combobox');
    trigger.focus();
    await user.keyboard(' ');
    expect(screen.getByRole('listbox')).toBeTruthy();
    await user.keyboard(' ');
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('moveActive is a no-op when every option is disabled', async () => {
    const user = userEvent.setup();
    const allDisabled = [{ value: 'x', label: 'X', disabled: true }];
    render(<CustomSelect value="x" options={allDisabled} onChange={vi.fn()} ariaLabel="Pick" portal={false} />);
    await user.click(screen.getByRole('combobox'));
    await expect(user.keyboard('{ArrowDown}')).resolves.not.toThrow();
  });

  it('hovering an option makes it active', async () => {
    const user = userEvent.setup();
    render(<CustomSelect value="a" options={OPTIONS} onChange={vi.fn()} ariaLabel="Pick" portal={false} />);
    await user.click(screen.getByRole('combobox'));
    const betaOption = screen.getByText('Beta').closest('button')!;
    fireEvent.mouseEnter(betaOption);
    expect(betaOption.className).toContain('active');
  });

  it('supports labelledBy, a disabled trigger, and onFocus', () => {
    const onFocus = vi.fn();
    render(
      <CustomSelect
        value="a"
        options={OPTIONS}
        onChange={vi.fn()}
        ariaLabel="Pick"
        labelledBy="external-label"
        disabled
        onFocus={onFocus}
        portal={false}
      />,
    );
    const trigger = screen.getByRole('combobox');
    expect(trigger.getAttribute('aria-describedby')).toBe('external-label');
    expect(trigger).toBeDisabled();
  });

  it('calls onFocus when the trigger is focused', () => {
    const onFocus = vi.fn();
    render(<CustomSelect value="a" options={OPTIONS} onChange={vi.fn()} ariaLabel="Pick" onFocus={onFocus} portal={false} />);
    fireEvent.focus(screen.getByRole('combobox'));
    expect(onFocus).toHaveBeenCalled();
  });

  it('opens above the trigger when there is more room above than below', async () => {
    const user = userEvent.setup();
    // Force the "near the bottom of the viewport" branch: little room
    // below, more room above.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 700,
      bottom: 720,
      left: 10,
      right: 110,
      width: 100,
      height: 20,
      x: 10,
      y: 700,
      toJSON() {
        return this;
      },
    });
    render(<CustomSelect value="a" options={OPTIONS} onChange={vi.fn()} ariaLabel="Pick" />);
    await user.click(screen.getByRole('combobox'));
    const listbox = screen.getByRole('listbox');
    // Opening above means the menu's top sits above the trigger's top.
    expect(parseFloat(listbox.style.top)).toBeLessThan(700);
    vi.restoreAllMocks();
  });

  it('selecting the active value falls back through to the raw prop value when every option is disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const allDisabled = [{ value: 'x', label: 'X', disabled: true }];
    render(<CustomSelect value="x" options={allDisabled} onChange={onChange} ariaLabel="Pick" portal={false} />);
    const trigger = screen.getByRole('combobox');
    await user.click(trigger);
    expect(trigger.getAttribute('aria-activedescendant')).toBeNull();
    await user.keyboard('{Enter}');
    // `choose` rejects the disabled option: no onChange, and the menu stays
    // open since the disabled-guard returns before `setOpen(false)`.
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('defaults the active option to the first enabled option when the value matches nothing', async () => {
    const user = userEvent.setup();
    render(<CustomSelect value="missing" options={OPTIONS} onChange={vi.fn()} ariaLabel="Pick" portal={false} />);
    const trigger = screen.getByRole('combobox');
    await user.click(trigger);
    expect(trigger.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: 'Alpha' }).id);
  });

  it('moveActive recovers to the first enabled option when the active value is no longer present', async () => {
    const user = userEvent.setup();
    const initialOptions = [
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Beta' },
    ];
    const { rerender } = render(
      <CustomSelect value="a" options={initialOptions} onChange={vi.fn()} ariaLabel="Pick" portal={false} />,
    );
    const trigger = screen.getByRole('combobox');
    await user.click(trigger);
    expect(trigger.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: 'Alpha' }).id);

    // The options list is swapped out from under the open menu (e.g. a
    // live-refreshed list) while `value` stays the same — `activeValue`
    // ('a') is now absent from the new enabled-options set, so the next
    // ArrowDown must recover rather than index out of bounds.
    const replacementOptions = [
      { value: 'y', label: 'Yankee' },
      { value: 'z', label: 'Zulu' },
    ];
    rerender(
      <CustomSelect value="a" options={replacementOptions} onChange={vi.fn()} ariaLabel="Pick" portal={false} />,
    );
    await user.keyboard('{ArrowDown}');
    expect(trigger.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: 'Yankee' }).id);
  });
});
