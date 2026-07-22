// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { CommandPalette } from './CommandPalette.js';
import { I18nProvider } from '../../../i18n/index.js';
import type { CommandPaletteItem } from '../../types.js';

// jsdom doesn't implement scrollIntoView (matches the same gap already
// polyfilled in this package's useResizableSplitPane.test.tsx).
beforeAll(() => {
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = () => {};
  }
});

const items: CommandPaletteItem[] = [
  { id: 'a', name: 'apple.txt', kind: 'file', mtime: 1, path: 'src' },
  { id: 'b', name: 'banana.txt', kind: 'file', mtime: 2, path: 'src' },
];

describe('CommandPalette', () => {
  it('renders every item ranked by the empty-query rule and focuses the input', () => {
    render(<CommandPalette items={items} onSelect={vi.fn()} onClose={vi.fn()} scopeKey="cp-1" />);
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      expect.stringContaining('banana.txt'),
      expect.stringContaining('apple.txt'),
    ]);
    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  it('filters results as the user types', async () => {
    render(<CommandPalette items={items} onSelect={vi.fn()} onClose={vi.fn()} scopeKey="cp-2" />);
    await userEvent.type(screen.getByRole('textbox'), 'apple');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByText('apple.txt')).toBeInTheDocument();
  });

  it('shows a no-matches message for a non-empty query with no hits', async () => {
    render(<CommandPalette items={items} onSelect={vi.fn()} onClose={vi.fn()} scopeKey="cp-3" />);
    await userEvent.type(screen.getByRole('textbox'), 'zzz-nope');
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('shows a no-items message for an empty query with no items at all', () => {
    render(<CommandPalette items={[]} onSelect={vi.fn()} onClose={vi.fn()} scopeKey="cp-4" />);
    expect(screen.getByText('No items')).toBeInTheDocument();
  });

  it('selects a result on click, closing and notifying the host', async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<CommandPalette items={items} onSelect={onSelect} onClose={onClose} scopeKey="cp-5" />);
    await userEvent.click(screen.getByText('apple.txt'));
    expect(onSelect).toHaveBeenCalledWith(items[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on a mousedown over the overlay backdrop but not over the palette panel', async () => {
    const onClose = vi.fn();
    const { container } = render(<CommandPalette items={items} onSelect={vi.fn()} onClose={onClose} scopeKey="cp-6" />);
    const panel = container.querySelector('.jini-command-palette') as HTMLElement;
    await userEvent.click(panel);
    expect(onClose).not.toHaveBeenCalled();
    const overlay = container.querySelector('.jini-command-palette-overlay') as HTMLElement;
    await userEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape and navigates with arrow keys', async () => {
    const onClose = vi.fn();
    render(<CommandPalette items={items} onSelect={vi.fn()} onClose={onClose} scopeKey="cp-7" />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, '{ArrowDown}');
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'false');
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    await userEvent.type(input, '{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uses a custom placeholder when supplied', () => {
    render(<CommandPalette items={items} onSelect={vi.fn()} onClose={vi.fn()} placeholder="Find a file" />);
    expect(screen.getByPlaceholderText('Find a file')).toBeInTheDocument();
  });

  it('renders translated placeholder and footer hints end-to-end under an I18nProvider', () => {
    render(
      <I18nProvider
        dictionaries={{
          fr: { 'Search…': 'Rechercher…', Navigate: 'Naviguer', Select: 'Sélectionner', Close: 'Fermer' },
        }}
        initialLocale="fr"
      >
        <CommandPalette items={items} onSelect={vi.fn()} onClose={vi.fn()} />
      </I18nProvider>,
    );
    expect(screen.getByPlaceholderText('Rechercher…')).toBeInTheDocument();
    expect(screen.getByText('Naviguer')).toBeInTheDocument();
    expect(screen.getByText('Sélectionner')).toBeInTheDocument();
    expect(screen.getByText('Fermer')).toBeInTheDocument();
  });
});
