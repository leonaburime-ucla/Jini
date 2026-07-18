// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FilePreviewPane } from './FilePreviewPane.js';

interface TestFile {
  path: string;
}

function baseProps() {
  return {
    file: { path: 'dir/a.txt' } as TestFile,
    path: 'dir/a.txt',
    kindLabel: 'Text',
    kindGlyph: '¶',
    size: 2048,
    modifiedAt: Date.now() - 5000,
    onOpen: vi.fn(),
    onClose: vi.fn(),
  };
}

describe('FilePreviewPane', () => {
  it('shows the full path, kind label, and formatted stats line', () => {
    render(<FilePreviewPane {...baseProps()} />);
    expect(screen.getByText('dir/a.txt')).toBeInTheDocument();
    expect(screen.getByText('Text')).toBeInTheDocument();
    expect(screen.getByText(/2\.0 KB/)).toBeInTheDocument();
    expect(screen.getByText(/TXT/)).toBeInTheDocument();
  });

  it('renders the fallback glyph placeholder when no renderThumbnail is supplied', () => {
    render(<FilePreviewPane {...baseProps()} />);
    expect(screen.getByText('¶')).toBeInTheDocument();
  });

  it('renders a host-supplied thumbnail instead of the placeholder', () => {
    render(<FilePreviewPane {...baseProps()} renderThumbnail={() => <div data-testid="custom-thumb" />} />);
    expect(screen.getByTestId('custom-thumb')).toBeInTheDocument();
  });

  it('wires the close button', async () => {
    const onClose = vi.fn();
    render(<FilePreviewPane {...baseProps()} onClose={onClose} />);
    await userEvent.click(screen.getByTitle('Close preview'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('wires onOpen from both the open CTA and the thumbnail overlay button', async () => {
    const onOpen = vi.fn();
    render(<FilePreviewPane {...baseProps()} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByTitle('Open dir/a.txt'));
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it('omits the thumbnail overlay button when thumbnailIsInteractive is true', () => {
    render(<FilePreviewPane {...baseProps()} thumbnailIsInteractive />);
    expect(screen.queryByTitle('Open dir/a.txt')).toBeNull();
    // The meta footer's "Open" CTA still exists even when the thumbnail overlay doesn't.
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument();
  });

  it('hides the download link when downloadHref is omitted', () => {
    render(<FilePreviewPane {...baseProps()} />);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('renders a download link with the full path as both href-target file and download attribute when downloadHref is supplied', () => {
    render(<FilePreviewPane {...baseProps()} downloadHref="/files/dir/a.txt" />);
    const link = screen.getByRole('link', { name: /Download/ });
    expect(link).toHaveAttribute('href', '/files/dir/a.txt');
    expect(link).toHaveAttribute('download', 'dir/a.txt');
  });
});
