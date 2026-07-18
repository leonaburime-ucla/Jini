// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AssetTreeRowMenu } from './AssetTreeRowMenu.js';

function baseProps() {
  return {
    path: 'a.txt',
    displayName: 'a.txt',
    top: 10,
    left: 20,
    containerRef: createRef<HTMLDivElement>(),
    canCopyLocalPath: true,
    copied: false,
    onOpen: vi.fn(),
    onRename: vi.fn(),
    onCopyLocalPath: vi.fn(),
    onDelete: vi.fn(),
  };
}

describe('AssetTreeRowMenu', () => {
  it('positions itself via top/left inline style', () => {
    render(<AssetTreeRowMenu {...baseProps()} />);
    const popover = screen.getByTestId('asset-tree-row-menu-popover');
    expect(popover.style.top).toBe('10px');
    expect(popover.style.left).toBe('20px');
  });

  it('wires open/rename/delete', async () => {
    const props = baseProps();
    render(<AssetTreeRowMenu {...props} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(props.onOpen).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Rename' }));
    expect(props.onRename).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByTestId('asset-tree-row-delete-a.txt'));
    expect(props.onDelete).toHaveBeenCalledTimes(1);
  });

  it('copy-local-path button is disabled when canCopyLocalPath is false', () => {
    render(<AssetTreeRowMenu {...baseProps()} canCopyLocalPath={false} />);
    expect(screen.getByRole('button', { name: 'Copy local path' })).toBeDisabled();
  });

  it('shows "Copied" label when copied is true, and still wires the click', async () => {
    const props = baseProps();
    render(<AssetTreeRowMenu {...props} copied />);
    const button = screen.getByRole('button', { name: 'Copied' });
    expect(button).not.toBeDisabled();
    await userEvent.click(button);
    expect(props.onCopyLocalPath).toHaveBeenCalledTimes(1);
  });

  it('hides the Download action when download is omitted', () => {
    render(<AssetTreeRowMenu {...baseProps()} />);
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull();
  });

  it('renders a real download link and fires onClick when download is supplied', async () => {
    const onClick = vi.fn();
    render(<AssetTreeRowMenu {...baseProps()} download={{ href: '/files/a.txt', onClick }} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/files/a.txt');
    expect(link).toHaveAttribute('download', 'a.txt');
    await userEvent.click(screen.getByRole('button', { name: 'Download' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('stops propagation on its own mousedown/click so an outside-dismiss listener does not treat an inside click as outside', () => {
    render(<AssetTreeRowMenu {...baseProps()} />);
    const popover = screen.getByTestId('asset-tree-row-menu-popover');
    const outerMouseDown = vi.fn();
    const outerClick = vi.fn();
    document.addEventListener('mousedown', outerMouseDown);
    document.addEventListener('click', outerClick);
    popover.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    popover.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(outerMouseDown).not.toHaveBeenCalled();
    expect(outerClick).not.toHaveBeenCalled();
    document.removeEventListener('mousedown', outerMouseDown);
    document.removeEventListener('click', outerClick);
  });
});
