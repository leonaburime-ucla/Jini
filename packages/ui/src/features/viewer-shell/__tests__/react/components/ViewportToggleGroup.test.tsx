import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_VIEWPORT_PRESETS } from '../../../constants.js';
import { ViewportToggleGroup } from '../../../react/components/ViewportToggleGroup.js';

describe('ViewportToggleGroup', () => {
  it('renders every preset as an always-visible toggle button', () => {
    render(<ViewportToggleGroup presets={DEFAULT_VIEWPORT_PRESETS} viewport="desktop" onViewport={() => {}} ariaLabel="Viewport" />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('marks the active preset pressed', () => {
    render(<ViewportToggleGroup presets={DEFAULT_VIEWPORT_PRESETS} viewport="tablet" onViewport={() => {}} ariaLabel="Viewport" />);
    expect(screen.getByRole('button', { name: 'Tablet' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Desktop' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onViewport when a preset button is clicked', async () => {
    const onViewport = vi.fn();
    render(<ViewportToggleGroup presets={DEFAULT_VIEWPORT_PRESETS} viewport="desktop" onViewport={onViewport} ariaLabel="Viewport" />);
    await userEvent.click(screen.getByRole('button', { name: 'Mobile' }));
    expect(onViewport).toHaveBeenCalledWith('mobile');
  });
});
