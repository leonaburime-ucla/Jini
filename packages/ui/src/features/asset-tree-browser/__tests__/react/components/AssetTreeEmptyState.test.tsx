// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AssetTreeEmptyState } from '../../../react/components/AssetTreeEmptyState.js';

describe('AssetTreeEmptyState', () => {
  it('shows the empty message with no actions by default', () => {
    render(<AssetTreeEmptyState />);
    expect(screen.getByText('No files yet')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders and wires host-supplied actions', async () => {
    const onSelect = vi.fn();
    render(<AssetTreeEmptyState actions={[{ key: 'new', label: 'New file', onSelect, testId: 'empty-new' }]} />);
    await userEvent.click(screen.getByTestId('empty-new'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
