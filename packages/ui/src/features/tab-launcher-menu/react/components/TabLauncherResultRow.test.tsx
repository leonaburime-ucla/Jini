// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TabLauncherResultRow } from './TabLauncherResultRow.js';
import type { TabLauncherResultItem } from '../../types.js';

const item: TabLauncherResultItem = { id: 'f1', name: 'apple.png', kind: 'image', meta: '12 KB' };

describe('TabLauncherResultRow', () => {
  it('renders the name and meta', () => {
    render(<TabLauncherResultRow item={item} selectableIndex={0} selected={false} openLabel="Open" onHover={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByText('apple.png')).toBeInTheDocument();
    expect(screen.getByText('12 KB')).toBeInTheDocument();
  });

  it('omits the meta span when absent', () => {
    render(
      <TabLauncherResultRow
        item={{ id: 'f2', name: 'no-meta.png', kind: 'image' }}
        selectableIndex={0}
        selected={false}
        openLabel="Open"
        onHover={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.queryByText('12 KB')).not.toBeInTheDocument();
  });

  it('shows the open badge only when isOpen is true', () => {
    const { rerender } = render(
      <TabLauncherResultRow item={{ ...item, isOpen: true }} selectableIndex={0} selected={false} openLabel="Open" onHover={vi.fn()} onSelect={vi.fn()} />,
    );
    expect(screen.getByText('Open')).toBeInTheDocument();
    rerender(<TabLauncherResultRow item={item} selectableIndex={0} selected={false} openLabel="Open" onHover={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.queryByText('Open')).not.toBeInTheDocument();
  });

  it('applies the selected class when selected', () => {
    render(<TabLauncherResultRow item={item} selectableIndex={0} selected onHover={vi.fn()} onSelect={vi.fn()} openLabel="Open" />);
    expect(screen.getByRole('button').className).toContain('jini-tab-launcher-menu__row--selected');
  });

  it('renders a host-supplied icon via renderIcon', () => {
    render(
      <TabLauncherResultRow
        item={{ ...item, iconName: 'image' }}
        selectableIndex={0}
        selected={false}
        openLabel="Open"
        onHover={vi.fn()}
        onSelect={vi.fn()}
        renderIcon={(name) => <span data-testid="icon">{name}</span>}
      />,
    );
    expect(screen.getByTestId('icon')).toHaveTextContent('image');
  });

  it('calls onHover on mouse enter and onSelect on click', async () => {
    const onHover = vi.fn();
    const onSelect = vi.fn();
    render(<TabLauncherResultRow item={item} selectableIndex={3} selected={false} openLabel="Open" onHover={onHover} onSelect={onSelect} />);
    const button = screen.getByRole('button');
    await userEvent.hover(button);
    expect(onHover).toHaveBeenCalledWith(3);
    await userEvent.click(button);
    expect(onSelect).toHaveBeenCalledWith(item);
  });
});
