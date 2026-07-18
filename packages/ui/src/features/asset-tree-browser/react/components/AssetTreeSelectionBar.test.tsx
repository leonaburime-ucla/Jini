// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AssetTreeSelectionBar } from './AssetTreeSelectionBar.js';

describe('AssetTreeSelectionBar', () => {
  it('shows the count and wires clear/delete', async () => {
    const onClear = vi.fn();
    const onDelete = vi.fn();
    render(<AssetTreeSelectionBar count={3} onClear={onClear} onDelete={onDelete} deleting={false} />);
    expect(screen.getByText('3 selected')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('asset-tree-batch-delete'));
    expect(onDelete).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('disables delete while deleting', () => {
    render(<AssetTreeSelectionBar count={1} onClear={vi.fn()} onDelete={vi.fn()} deleting />);
    expect(screen.getByTestId('asset-tree-batch-delete')).toBeDisabled();
  });

  it('hides the download button when onDownload is omitted', () => {
    render(<AssetTreeSelectionBar count={1} onClear={vi.fn()} onDelete={vi.fn()} deleting={false} />);
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull();
  });

  it('renders and wires the download button when onDownload is supplied, disabled while downloading', async () => {
    const onDownload = vi.fn();
    const { rerender } = render(
      <AssetTreeSelectionBar count={1} onClear={vi.fn()} onDelete={vi.fn()} deleting={false} onDownload={onDownload} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Download' }));
    expect(onDownload).toHaveBeenCalledTimes(1);
    rerender(
      <AssetTreeSelectionBar
        count={1}
        onClear={vi.fn()}
        onDelete={vi.fn()}
        deleting={false}
        onDownload={onDownload}
        downloading
      />,
    );
    expect(screen.getByRole('button', { name: 'Download' })).toBeDisabled();
  });

  it('renders a downloadError alert when supplied', () => {
    render(
      <AssetTreeSelectionBar
        count={1}
        onClear={vi.fn()}
        onDelete={vi.fn()}
        deleting={false}
        downloadError="archive failed"
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('archive failed');
  });
});
