import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MentionResultItem } from '../../../react/components/MentionResultItem.js';
import type { MentionItem } from '../../../types.js';

const ITEM: MentionItem<string> = { id: '1', label: 'Alpha', category: 'skills', meta: 'A skill', icon: 'icon-alpha' };

describe('MentionResultItem', () => {
  it('renders the label, meta, and icon; calls onPick on mousedown', async () => {
    const onPick = vi.fn();
    render(<MentionResultItem item={ITEM} selected={false} onPick={onPick} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('A skill')).toBeInTheDocument();
    expect(screen.getByText('icon-alpha')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('option'));
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it('omits the meta line when the item has none', () => {
    render(<MentionResultItem item={{ ...ITEM, meta: undefined }} selected={false} onPick={vi.fn()} />);
    expect(screen.queryByText('A skill')).not.toBeInTheDocument();
  });

  it('renders the selectedIcon in place of the item icon when selected, and marks aria-selected', () => {
    render(<MentionResultItem item={ITEM} selected selectedIcon={<span data-testid="check" />} onPick={vi.fn()} />);
    expect(screen.getByRole('option')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('check')).toBeInTheDocument();
    expect(screen.queryByText('icon-alpha')).not.toBeInTheDocument();
  });

  it('does not blur focus before firing onPick (mousedown is prevented by default)', async () => {
    const onPick = vi.fn();
    render(
      <div>
        <input aria-label="source" defaultValue="hi" />
        <MentionResultItem item={ITEM} selected={false} onPick={onPick} />
      </div>,
    );
    const input = screen.getByLabelText('source');
    input.focus();
    expect(document.activeElement).toBe(input);
    await userEvent.click(screen.getByRole('option'));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(input);
  });
});
