// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AssetTreeFileRow } from './AssetTreeFileRow.js';

const baseProps = {
  path: 'a.txt',
  displayName: 'a.txt',
  active: false,
  selected: false,
  kindLabel: 'Text',
  kindGlyph: '¶',
  size: 512,
  modifiedAt: Date.now() - 1000,
  renaming: null,
  onSelectPreview: vi.fn(),
  onOpen: vi.fn(),
  onToggleSelect: vi.fn(),
  onOpenMenu: vi.fn(),
  onRenameDraftChange: vi.fn(),
  onCommitRename: vi.fn(),
  onCancelRename: vi.fn(),
};

describe('AssetTreeFileRow', () => {
  it('single click on the name selects preview; double click opens', async () => {
    const onSelectPreview = vi.fn();
    const onOpen = vi.fn();
    render(<AssetTreeFileRow {...baseProps} onSelectPreview={onSelectPreview} onOpen={onOpen} />);
    await userEvent.click(screen.getByText('a.txt'));
    expect(onSelectPreview).toHaveBeenCalledWith('a.txt');
    await userEvent.dblClick(screen.getByText('a.txt'));
    expect(onOpen).toHaveBeenCalledWith('a.txt');
  });

  it('clicking the checkbox toggles selection without triggering preview', async () => {
    const onToggleSelect = vi.fn();
    const onSelectPreview = vi.fn();
    render(<AssetTreeFileRow {...baseProps} onToggleSelect={onToggleSelect} onSelectPreview={onSelectPreview} />);
    await userEvent.click(screen.getByRole('checkbox'));
    expect(onToggleSelect).toHaveBeenCalledWith('a.txt');
    expect(onSelectPreview).not.toHaveBeenCalled();
  });

  it('shows a checkmark and aria-checked when selected', () => {
    render(<AssetTreeFileRow {...baseProps} selected />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
  });

  it('Enter/Space on the checkbox toggles selection', async () => {
    const onToggleSelect = vi.fn();
    render(<AssetTreeFileRow {...baseProps} onToggleSelect={onToggleSelect} />);
    screen.getByRole('checkbox').focus();
    await userEvent.keyboard('{Enter}');
    expect(onToggleSelect).toHaveBeenCalledWith('a.txt');
    await userEvent.keyboard(' ');
    expect(onToggleSelect).toHaveBeenCalledTimes(2);
  });

  it('single Enter on the name previews; a second Enter within the double-activation window opens', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onSelectPreview = vi.fn();
    const onOpen = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime, delay: null });
    render(<AssetTreeFileRow {...baseProps} onSelectPreview={onSelectPreview} onOpen={onOpen} />);
    const nameButton = screen.getByText('a.txt').closest('button')!;
    nameButton.focus();
    await user.keyboard('{Enter}');
    expect(onSelectPreview).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    expect(onOpen).toHaveBeenCalledWith('a.txt');
    vi.useRealTimers();
  });

  it('an Enter after the double-activation window elapses previews again instead of opening', async () => {
    vi.useFakeTimers();
    const onSelectPreview = vi.fn();
    const onOpen = vi.fn();
    render(<AssetTreeFileRow {...baseProps} onSelectPreview={onSelectPreview} onOpen={onOpen} />);
    const nameButton = screen.getByText('a.txt').closest('button')!;
    nameButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    vi.advanceTimersByTime(1000);
    nameButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(onSelectPreview).toHaveBeenCalledTimes(2);
    expect(onOpen).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('clicking the menu trigger calls onOpenMenu with the anchor rect', async () => {
    const onOpenMenu = vi.fn();
    render(<AssetTreeFileRow {...baseProps} onOpenMenu={onOpenMenu} />);
    await userEvent.click(screen.getByTestId('asset-tree-file-menu-a.txt'));
    expect(onOpenMenu).toHaveBeenCalledTimes(1);
    expect(onOpenMenu.mock.calls[0]![0]).toBe('a.txt');
  });

  it('Enter on the menu trigger also opens the menu', async () => {
    const onOpenMenu = vi.fn();
    render(<AssetTreeFileRow {...baseProps} onOpenMenu={onOpenMenu} />);
    screen.getByTestId('asset-tree-file-menu-a.txt').focus();
    await userEvent.keyboard('{Enter}');
    expect(onOpenMenu).toHaveBeenCalledTimes(1);
  });

  it('renders an editable input in rename mode, wiring draft change/commit/cancel', async () => {
    const onRenameDraftChange = vi.fn();
    const onCommitRename = vi.fn();
    const onCancelRename = vi.fn();
    render(
      <AssetTreeFileRow
        {...baseProps}
        renaming={{ path: 'a.txt', draft: 'a.txt', saving: false }}
        onRenameDraftChange={onRenameDraftChange}
        onCommitRename={onCommitRename}
        onCancelRename={onCancelRename}
      />,
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;
    await userEvent.type(input, 'x');
    expect(onRenameDraftChange).toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(onCancelRename).toHaveBeenCalledTimes(1);
    expect(onCommitRename).not.toHaveBeenCalled();
  });

  it('Enter in the rename input commits without a duplicate commit on the following blur', async () => {
    const onCommitRename = vi.fn();
    render(
      <AssetTreeFileRow
        {...baseProps}
        renaming={{ path: 'a.txt', draft: 'a.txt', saving: false }}
        onCommitRename={onCommitRename}
      />,
    );
    const input = screen.getByRole('textbox');
    input.focus();
    await userEvent.keyboard('{Enter}');
    expect(onCommitRename).toHaveBeenCalledTimes(1);
    input.blur();
    expect(onCommitRename).toHaveBeenCalledTimes(1);
  });

  it('blurring the rename input without Enter/Escape commits once', () => {
    const onCommitRename = vi.fn();
    render(
      <AssetTreeFileRow
        {...baseProps}
        renaming={{ path: 'a.txt', draft: 'a.txt', saving: false }}
        onCommitRename={onCommitRename}
      />,
    );
    const input = screen.getByRole('textbox');
    input.focus();
    input.blur();
    expect(onCommitRename).toHaveBeenCalledTimes(1);
  });

  it('disables the rename input while saving', () => {
    render(<AssetTreeFileRow {...baseProps} renaming={{ path: 'a.txt', draft: 'a.txt', saving: true }} />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('applies the active/selected classes', () => {
    render(<AssetTreeFileRow {...baseProps} active selected />);
    const row = screen.getByTestId('asset-tree-file-row-a.txt');
    expect(row.className).toContain('active');
    expect(row.className).toContain('selected');
  });
});
