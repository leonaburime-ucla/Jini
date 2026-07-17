// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PaletteTweaks } from './PaletteTweaks.js';

describe('PaletteTweaks', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <PaletteTweaks open={false} selected={null} onChange={vi.fn()} onPreview={vi.fn()} onClose={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('marks "Original" selected when selected is null', () => {
    render(
      <PaletteTweaks open selected={null} onChange={vi.fn()} onPreview={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByText('Original').closest('li')?.getAttribute('aria-selected')).toBe('true');
  });

  it('calls onChange and onClose when a palette is picked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(
      <PaletteTweaks open selected={null} onChange={onChange} onPreview={vi.fn()} onClose={onClose} />,
    );
    await user.click(screen.getByText('Electric'));
    expect(onChange).toHaveBeenCalledWith('electric');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('deselects an already-selected palette on click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PaletteTweaks open selected="electric" onChange={onChange} onPreview={vi.fn()} onClose={vi.fn()} />,
    );
    await user.click(screen.getByText('Electric'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('previews on hover and restores the selection preview on mouse leave', async () => {
    const user = userEvent.setup();
    const onPreview = vi.fn();
    render(
      <PaletteTweaks open selected="coral" onChange={vi.fn()} onPreview={onPreview} onClose={vi.fn()} />,
    );
    await user.hover(screen.getByText('Electric'));
    expect(onPreview).toHaveBeenLastCalledWith('electric');
    await user.unhover(screen.getByText('Electric'));
    expect(onPreview).toHaveBeenLastCalledWith('coral');
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <PaletteTweaks open selected={null} onChange={vi.fn()} onPreview={vi.fn()} onClose={onClose} />,
    );
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('previews and hovers the "Original" item, and restores the selection preview on mouse leave', async () => {
    const user = userEvent.setup();
    const onPreview = vi.fn();
    render(
      <PaletteTweaks open selected="coral" onChange={vi.fn()} onPreview={onPreview} onClose={vi.fn()} />,
    );
    const original = screen.getByText('Original').closest('li')!;
    await user.hover(original);
    expect(onPreview).toHaveBeenLastCalledWith(null);
    expect(original.className).toContain('hovered');
    await user.unhover(original);
    expect(onPreview).toHaveBeenLastCalledWith('coral');
    expect(original.className).not.toContain('hovered');
  });

  it('selects "Original" (clears the selection) when its item is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(
      <PaletteTweaks open selected="coral" onChange={onChange} onPreview={vi.fn()} onClose={onClose} />,
    );
    await user.click(screen.getByText('Original'));
    expect(onChange).toHaveBeenCalledWith(null);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when a mousedown lands inside the dialog', () => {
    const onClose = vi.fn();
    render(
      <PaletteTweaks open selected={null} onChange={vi.fn()} onPreview={vi.fn()} onClose={onClose} />,
    );
    fireEvent.mouseDown(screen.getByText('Themes'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when a mousedown lands outside the dialog', () => {
    const onClose = vi.fn();
    render(
      <PaletteTweaks open selected={null} onChange={vi.fn()} onPreview={vi.fn()} onClose={onClose} />,
    );
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
