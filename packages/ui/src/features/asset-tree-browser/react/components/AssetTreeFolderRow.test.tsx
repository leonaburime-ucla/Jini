// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AssetTreeFolderRow } from './AssetTreeFolderRow.js';

describe('AssetTreeFolderRow', () => {
  it('shows the folder name and file count', () => {
    render(<AssetTreeFolderRow name="dir" path="dir" fileCount={3} onNavigate={vi.fn()} />);
    expect(screen.getByText('dir')).toBeInTheDocument();
    expect(screen.getByText('3 files')).toBeInTheDocument();
  });

  it('navigates on clicking the row', async () => {
    const onNavigate = vi.fn();
    render(<AssetTreeFolderRow name="dir" path="a/dir" fileCount={0} onNavigate={onNavigate} />);
    await userEvent.click(screen.getByTestId('asset-tree-dir-row-a/dir'));
    expect(onNavigate).toHaveBeenCalledWith('a/dir');
  });

  it('navigates on clicking the name button', async () => {
    const onNavigate = vi.fn();
    render(<AssetTreeFolderRow name="dir" path="dir" fileCount={0} onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole('button', { name: /dir/ }));
    expect(onNavigate).toHaveBeenCalledWith('dir');
  });
});
