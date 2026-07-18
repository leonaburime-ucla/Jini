import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ImportChoice } from './ImportChoice.js';

describe('ImportChoice', () => {
  it('renders the title and body', () => {
    render(
      <ImportChoice active={false} icon="github" title="From GitHub" body="Install a repo" onClick={() => {}} />,
    );
    expect(screen.getByText('From GitHub')).toBeInTheDocument();
    expect(screen.getByText('Install a repo')).toBeInTheDocument();
  });

  it('applies the is-active class only when active', () => {
    const { rerender } = render(
      <ImportChoice active={false} icon="github" title="From GitHub" body="Install a repo" onClick={() => {}} />,
    );
    expect(screen.getByRole('button')).not.toHaveClass('is-active');
    rerender(
      <ImportChoice active icon="github" title="From GitHub" body="Install a repo" onClick={() => {}} />,
    );
    expect(screen.getByRole('button')).toHaveClass('is-active');
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(
      <ImportChoice active={false} icon="upload" title="Upload zip" body="Upload an archive" onClick={onClick} />,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('appends a caller-supplied className', () => {
    render(
      <ImportChoice
        active={false}
        icon="folder"
        title="Upload folder"
        body="Upload a directory"
        onClick={() => {}}
        className="extra"
      />,
    );
    expect(screen.getByRole('button')).toHaveClass('extra');
  });
});
