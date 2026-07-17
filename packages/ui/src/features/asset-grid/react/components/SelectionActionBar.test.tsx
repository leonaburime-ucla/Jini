// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SelectionActionBar } from './SelectionActionBar.js';

describe('SelectionActionBar', () => {
  it('shows the selected count and wires select-all/clear/delete', async () => {
    const onSelectAll = vi.fn();
    const onClear = vi.fn();
    const onRequestDelete = vi.fn();
    render(
      <SelectionActionBar
        selectedIds={['a', 'b']}
        onSelectAll={onSelectAll}
        onClear={onClear}
        onRequestDelete={onRequestDelete}
      />,
    );
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Select all' }));
    expect(onSelectAll).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onClear).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Delete 2' }));
    expect(onRequestDelete).toHaveBeenCalledTimes(1);
  });

  it('renders host-supplied bulk actions, passed the selected ids', () => {
    render(
      <SelectionActionBar
        selectedIds={['a', 'b', 'c']}
        onSelectAll={vi.fn()}
        onClear={vi.fn()}
        onRequestDelete={vi.fn()}
        renderBulkActions={(ids) => <span data-testid="bulk">{ids.join(',')}</span>}
      />,
    );
    expect(screen.getByTestId('bulk')).toHaveTextContent('a,b,c');
  });
});
