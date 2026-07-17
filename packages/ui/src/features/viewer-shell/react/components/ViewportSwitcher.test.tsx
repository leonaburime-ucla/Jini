import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_VIEWPORT_PRESETS } from '../../constants.js';
import { ViewportSwitcher } from './ViewportSwitcher.js';

describe('ViewportSwitcher', () => {
  it('shows the active preset label on the trigger', () => {
    render(<ViewportSwitcher presets={DEFAULT_VIEWPORT_PRESETS} viewport="tablet" onViewport={() => {}} ariaLabel="Viewport" />);
    expect(screen.getByRole('button', { name: 'Viewport' })).toHaveTextContent('Tablet');
  });

  it('opens the listbox on click and lists every preset', async () => {
    render(<ViewportSwitcher presets={DEFAULT_VIEWPORT_PRESETS} viewport="desktop" onViewport={() => {}} ariaLabel="Viewport" />);
    await userEvent.click(screen.getByRole('button', { name: 'Viewport' }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('calls onViewport and closes when an option is picked', async () => {
    const onViewport = vi.fn();
    render(<ViewportSwitcher presets={DEFAULT_VIEWPORT_PRESETS} viewport="desktop" onViewport={onViewport} ariaLabel="Viewport" />);
    await userEvent.click(screen.getByRole('button', { name: 'Viewport' }));
    await userEvent.click(screen.getByRole('option', { name: /Mobile/ }));
    expect(onViewport).toHaveBeenCalledWith('mobile');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes on Escape', async () => {
    render(<ViewportSwitcher presets={DEFAULT_VIEWPORT_PRESETS} viewport="desktop" onViewport={() => {}} ariaLabel="Viewport" />);
    await userEvent.click(screen.getByRole('button', { name: 'Viewport' }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes on an outside pointer-down', async () => {
    render(
      <div>
        <button>outside</button>
        <ViewportSwitcher presets={DEFAULT_VIEWPORT_PRESETS} viewport="desktop" onViewport={() => {}} ariaLabel="Viewport" />
      </div>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Viewport' }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await userEvent.click(screen.getByText('outside'));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('marks the selected option in the list', async () => {
    render(<ViewportSwitcher presets={DEFAULT_VIEWPORT_PRESETS} viewport="mobile" onViewport={() => {}} ariaLabel="Viewport" />);
    await userEvent.click(screen.getByRole('button', { name: 'Viewport' }));
    expect(screen.getByRole('option', { name: /Mobile/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: /Desktop/ })).toHaveAttribute('aria-selected', 'false');
  });
});
