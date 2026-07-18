// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AssetTreeBreadcrumbs } from './AssetTreeBreadcrumbs.js';

describe('AssetTreeBreadcrumbs', () => {
  it('renders the root label as non-interactive text at the root', () => {
    render(<AssetTreeBreadcrumbs currentDir="" rootLabel="My Project" onNavigate={vi.fn()} />);
    expect(screen.getByText('My Project')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'My Project' })).toBeNull();
  });

  it('renders the root label as a clickable button once navigated into a subdirectory, and every ancestor segment as a button', async () => {
    const onNavigate = vi.fn();
    render(<AssetTreeBreadcrumbs currentDir="a/b" rootLabel="Root" onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole('button', { name: 'Root' }));
    expect(onNavigate).toHaveBeenCalledWith('');
    await userEvent.click(screen.getByRole('button', { name: 'a' }));
    expect(onNavigate).toHaveBeenCalledWith('a');
  });

  it('renders the last segment as non-interactive text (the current directory)', () => {
    render(<AssetTreeBreadcrumbs currentDir="a/b" rootLabel="Root" onNavigate={vi.fn()} />);
    expect(screen.getByText('b')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'b' })).toBeNull();
  });
});
