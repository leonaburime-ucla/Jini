// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AssetGridToolbar, type AssetGridToolbarProps } from './AssetGridToolbar.js';

function baseProps(overrides: Partial<AssetGridToolbarProps> = {}): AssetGridToolbarProps {
  return {
    search: '',
    onSearchChange: vi.fn(),
    kind: '',
    onKindChange: vi.fn(),
    kindFacets: [
      { value: '', label: 'All kinds' },
      { value: 'image', label: 'Images' },
    ],
    source: '',
    onSourceChange: vi.fn(),
    sourceFacets: [],
    viewMode: 'grid',
    onViewModeChange: vi.fn(),
    onRefresh: vi.fn(),
    loading: false,
    ...overrides,
  };
}

describe('AssetGridToolbar', () => {
  it('typing in the search box calls onSearchChange', async () => {
    const onSearchChange = vi.fn();
    render(<AssetGridToolbar {...baseProps({ onSearchChange })} />);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'cat');
    expect(onSearchChange).toHaveBeenCalled();
    expect(onSearchChange.mock.calls.map((c) => c[0]).join('')).toBe('cat');
  });

  it('renders the kind facet select and reports changes', async () => {
    const onKindChange = vi.fn();
    render(<AssetGridToolbar {...baseProps({ onKindChange })} />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Filter by kind' }), 'image');
    expect(onKindChange).toHaveBeenCalledWith('image');
  });

  it('omits the source select entirely when no source facets are supplied', () => {
    render(<AssetGridToolbar {...baseProps()} />);
    expect(screen.queryByRole('combobox', { name: 'Filter by source' })).not.toBeInTheDocument();
  });

  it('renders the source facet select when facets are supplied', () => {
    render(<AssetGridToolbar {...baseProps({ sourceFacets: [{ value: 'clipper', label: 'Clipper' }] })} />);
    expect(screen.getByRole('combobox', { name: 'Filter by source' })).toBeInTheDocument();
  });

  it('the view toggle switches modes and reflects the active one', async () => {
    const onViewModeChange = vi.fn();
    render(<AssetGridToolbar {...baseProps({ onViewModeChange, viewMode: 'grid' })} />);
    const gridBtn = screen.getByRole('button', { name: 'Grid' });
    const timelineBtn = screen.getByRole('button', { name: 'Timeline' });
    expect(gridBtn).toHaveAttribute('aria-pressed', 'true');
    expect(timelineBtn).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(timelineBtn);
    expect(onViewModeChange).toHaveBeenCalledWith('timeline');
  });

  it('refresh button calls onRefresh and reflects loading via aria-busy', async () => {
    const onRefresh = vi.fn();
    const { rerender } = render(<AssetGridToolbar {...baseProps({ onRefresh, loading: false })} />);
    const refreshBtn = screen.getByRole('button', { name: 'Refresh' });
    expect(refreshBtn).toHaveAttribute('aria-busy', 'false');
    await userEvent.click(refreshBtn);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    rerender(<AssetGridToolbar {...baseProps({ onRefresh, loading: true })} />);
    expect(screen.getByRole('button', { name: 'Refresh' })).toHaveAttribute('aria-busy', 'true');
  });

  it('renders host-supplied toolbarActions', () => {
    render(<AssetGridToolbar {...baseProps({ toolbarActions: <button type="button">Upload</button> })} />);
    expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument();
  });
});
