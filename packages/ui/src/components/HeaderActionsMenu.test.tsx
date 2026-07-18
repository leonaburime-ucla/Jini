// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HeaderActionsMenu, type HeaderMenuAction } from './HeaderActionsMenu.js';

function action(overrides: Partial<HeaderMenuAction> = {}): HeaderMenuAction {
  return {
    id: 'item-1',
    label: 'Item one',
    icon: 'edit',
    onClick: vi.fn(),
    ...overrides,
  };
}

describe('HeaderActionsMenu', () => {
  it('renders nothing when every group is empty', () => {
    const { container } = render(<HeaderActionsMenu groups={[[], []]} label="More actions" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when there are no groups at all', () => {
    const { container } = render(<HeaderActionsMenu groups={[]} label="More actions" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the trigger with the accessible label but keeps the popover closed', () => {
    render(<HeaderActionsMenu groups={[[action()]]} label="More actions" />);
    const trigger = screen.getByTestId('header-actions-menu-trigger');
    expect(trigger).toHaveAttribute('aria-label', 'More actions');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens the popover on trigger click and lists every item', async () => {
    const user = userEvent.setup();
    render(
      <HeaderActionsMenu
        groups={[[action({ id: 'a', label: 'Alpha' }), action({ id: 'b', label: 'Beta' })]]}
        label="More actions"
      />,
    );
    await user.click(screen.getByTestId('header-actions-menu-trigger'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('toggles closed when the trigger is clicked again', async () => {
    const user = userEvent.setup();
    render(<HeaderActionsMenu groups={[[action()]]} label="More actions" />);
    const trigger = screen.getByTestId('header-actions-menu-trigger');
    await user.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.click(trigger);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on outside click', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <div data-testid="outside">outside</div>
        <HeaderActionsMenu groups={[[action()]]} label="More actions" />
      </div>,
    );
    await user.click(screen.getByTestId('header-actions-menu-trigger'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.click(screen.getByTestId('outside'));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(<HeaderActionsMenu groups={[[action()]]} label="More actions" />);
    await user.click(screen.getByTestId('header-actions-menu-trigger'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('calls the item onClick and closes the menu', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<HeaderActionsMenu groups={[[action({ label: 'Do it', onClick })]]} label="More actions" />);
    await user.click(screen.getByTestId('header-actions-menu-trigger'));
    await user.click(screen.getByText('Do it'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('renders a divider between multiple non-empty groups but skips empty ones', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <HeaderActionsMenu
        groups={[[action({ id: 'a' })], [], [action({ id: 'b' })]]}
        label="More actions"
      />,
    );
    await user.click(screen.getByTestId('header-actions-menu-trigger'));
    expect(container.querySelectorAll('.jini-header-actions-menu-divider')).toHaveLength(1);
  });

  it('disables and marks aria-busy on a loading item, and renders its spinner icon', async () => {
    const user = userEvent.setup();
    render(<HeaderActionsMenu groups={[[action({ label: 'Saving', loading: true })]]} label="More actions" />);
    await user.click(screen.getByTestId('header-actions-menu-trigger'));
    const button = screen.getByText('Saving').closest('button')!;
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('disables a disabled item without marking it busy', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<HeaderActionsMenu groups={[[action({ label: 'Locked', disabled: true, onClick })]]} label="More actions" />);
    await user.click(screen.getByTestId('header-actions-menu-trigger'));
    const button = screen.getByText('Locked').closest('button')!;
    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute('aria-busy');
  });

  it('renders checkbox semantics and a check glyph for an active item', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <HeaderActionsMenu groups={[[action({ label: 'Toggle me', active: true })]]} label="More actions" />,
    );
    await user.click(screen.getByTestId('header-actions-menu-trigger'));
    const button = screen.getByText('Toggle me').closest('button')!;
    expect(button).toHaveAttribute('role', 'menuitemcheckbox');
    expect(button).toHaveAttribute('aria-checked', 'true');
    expect(container.querySelectorAll('.jini-header-actions-menu-item-check')).toHaveLength(1);
  });

  it('renders plain menuitem semantics for a non-toggle item', async () => {
    const user = userEvent.setup();
    render(<HeaderActionsMenu groups={[[action({ label: 'Plain' })]]} label="More actions" />);
    await user.click(screen.getByTestId('header-actions-menu-trigger'));
    const button = screen.getByText('Plain').closest('button')!;
    expect(button).toHaveAttribute('role', 'menuitem');
    expect(button).not.toHaveAttribute('aria-checked');
  });
});
