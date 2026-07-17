import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SnippetBlock } from './SnippetBlock.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SnippetBlock', () => {
  it('renders the snippet text', () => {
    render(<SnippetBlock snippet="hello world" language="bash" />);
    expect(screen.getByText('hello world')).toBeInTheDocument();
  });

  it('renders the placeholder when the snippet is empty', () => {
    render(<SnippetBlock snippet="" language="json" placeholder="Loading…" />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('disables the copy button when the snippet is empty', () => {
    render(<SnippetBlock snippet="" language="json" />);
    expect(screen.getByRole('button', { name: 'Copy' })).toBeDisabled();
  });

  it('copies the snippet and shows "Copied"', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<SnippetBlock snippet="copy me" language="bash" />);
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith('copy me');
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('resets the copied state when the snippet changes', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const { rerender } = render(<SnippetBlock snippet="a" language="bash" />);
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    rerender(<SnippetBlock snippet="b" language="bash" />);
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });
});
