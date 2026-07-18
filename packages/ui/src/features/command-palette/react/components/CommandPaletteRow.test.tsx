// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CommandPaletteRow } from './CommandPaletteRow.js';
import type { CommandPaletteResult } from '../../types.js';

function result(overrides: Partial<CommandPaletteResult['item']> = {}): CommandPaletteResult {
  return { item: { id: 'a', name: 'apple.txt', kind: 'file', ...overrides }, score: 100 };
}

describe('CommandPaletteRow', () => {
  it('renders the name, kind badge (uppercased), and a title falling back to name', () => {
    render(<CommandPaletteRow result={result()} index={0} active={false} onHover={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByText('apple.txt')).toBeInTheDocument();
    expect(screen.getByText('FILE')).toBeInTheDocument();
    expect(screen.getByText('apple.txt')).toHaveAttribute('title', 'apple.txt');
  });

  it('prefers an explicit title over name', () => {
    render(
      <CommandPaletteRow
        result={result({ title: 'Apple (full path)' })}
        index={0}
        active={false}
        onHover={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('apple.txt')).toHaveAttribute('title', 'Apple (full path)');
  });

  it('renders the path only when present', () => {
    const { rerender } = render(
      <CommandPaletteRow result={result({ path: 'src/lib' })} index={0} active={false} onHover={vi.fn()} onSelect={vi.fn()} />,
    );
    expect(screen.getByText('src/lib')).toBeInTheDocument();
    rerender(<CommandPaletteRow result={result()} index={0} active={false} onHover={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.queryByText('src/lib')).not.toBeInTheDocument();
  });

  it('marks the active row aria-selected and applies the active class', () => {
    render(<CommandPaletteRow result={result()} index={0} active onHover={vi.fn()} onSelect={vi.fn()} />);
    const row = screen.getByRole('option');
    expect(row).toHaveAttribute('aria-selected', 'true');
    expect(row.className).toContain('jini-command-palette-row--active');
  });

  it('calls onHover on mouse enter and onSelect on click', async () => {
    const onHover = vi.fn();
    const onSelect = vi.fn();
    const r = result();
    render(<CommandPaletteRow result={r} index={2} active={false} onHover={onHover} onSelect={onSelect} />);
    const row = screen.getByRole('option');
    await userEvent.hover(row);
    expect(onHover).toHaveBeenCalledWith(2);
    await userEvent.click(row);
    expect(onSelect).toHaveBeenCalledWith(r);
  });
});
