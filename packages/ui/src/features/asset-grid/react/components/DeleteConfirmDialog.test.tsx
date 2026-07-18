// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DeleteConfirmDialog } from './DeleteConfirmDialog.js';

describe('DeleteConfirmDialog', () => {
  it('renders singular copy for a single asset', () => {
    render(<DeleteConfirmDialog count={1} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText('Delete 1 asset?')).toBeInTheDocument();
  });

  it('renders plural copy for multiple assets', () => {
    render(<DeleteConfirmDialog count={3} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText('Delete 3 assets?')).toBeInTheDocument();
  });

  it('Cancel calls onCancel, the danger button calls onConfirm', async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<DeleteConfirmDialog count={2} onCancel={onCancel} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Delete 2' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('Escape closes the dialog', () => {
    const onCancel = vi.fn();
    render(<DeleteConfirmDialog count={1} onCancel={onCancel} onConfirm={vi.fn()} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('clicking the backdrop closes the dialog, clicking inside the dialog does not', async () => {
    const onCancel = vi.fn();
    render(<DeleteConfirmDialog count={1} onCancel={onCancel} onConfirm={vi.fn()} />);
    await userEvent.click(screen.getByRole('alertdialog'));
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByRole('presentation'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('focuses the confirm button on mount and locks body scroll, restoring it on unmount', () => {
    const { unmount } = render(<DeleteConfirmDialog count={1} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Delete 1' })).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});
