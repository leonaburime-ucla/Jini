import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProviderTabBar } from './ProviderTabBar.js';

const tabs = [
  { id: 'a', label: 'A', match: () => true },
  { id: 'b', label: 'B', match: () => true },
];

describe('ProviderTabBar', () => {
  it('marks the selected tab aria-selected and calls onSelect for the other', async () => {
    const onSelect = vi.fn();
    render(<ProviderTabBar tabs={tabs} selectedId="a" onSelect={onSelect} />);
    expect(screen.getByTestId('connectors-provider-tab-a').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('connectors-provider-tab-b').getAttribute('aria-selected')).toBe('false');
    await userEvent.click(screen.getByTestId('connectors-provider-tab-b'));
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('renders a single tab fine for a single-provider host', () => {
    render(<ProviderTabBar tabs={[tabs[0]!]} selectedId="a" onSelect={() => {}} />);
    expect(screen.getAllByRole('tab')).toHaveLength(1);
  });
});
