// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AssetTreeToolbar } from '../../../react/components/AssetTreeToolbar.js';

describe('AssetTreeToolbar', () => {
  it('renders nothing when there are no actions', () => {
    const { container } = render(<AssetTreeToolbar actions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders each action and wires its onSelect', async () => {
    const onSelect = vi.fn();
    render(
      <AssetTreeToolbar
        actions={[{ key: 'upload', label: 'Upload', onSelect, testId: 'upload-action', icon: 'upload' }]}
      />,
    );
    const button = screen.getByTestId('upload-action');
    expect(button).toHaveAttribute('data-icon', 'upload');
    await userEvent.click(button);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('respects a disabled action', () => {
    render(<AssetTreeToolbar actions={[{ key: 'x', label: 'X', onSelect: vi.fn(), disabled: true }]} />);
    expect(screen.getByRole('button', { name: 'X' })).toBeDisabled();
  });
});
