// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WorkingDirPicker } from './WorkingDirPicker.js';

describe('WorkingDirPicker', () => {
  it('shows the default hint label when no directory is selected', () => {
    render(
      <WorkingDirPicker
        workingDir={null}
        recentDirs={[]}
        onPickDirectory={vi.fn()}
        onSelectRecent={vi.fn()}
      />,
    );
    expect(screen.getByTestId('working-dir-trigger').textContent).toContain('Working directory');
  });

  it('shows the basename of a selected directory', () => {
    render(
      <WorkingDirPicker
        workingDir="/Users/me/projects/demo"
        recentDirs={[]}
        onPickDirectory={vi.fn()}
        onSelectRecent={vi.fn()}
      />,
    );
    expect(screen.getByTestId('working-dir-trigger').textContent).toContain('demo');
  });

  it('opens the panel and fires onPickDirectory', async () => {
    const user = userEvent.setup();
    const onPickDirectory = vi.fn();
    render(
      <WorkingDirPicker
        workingDir={null}
        recentDirs={[]}
        onPickDirectory={onPickDirectory}
        onSelectRecent={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId('working-dir-trigger'));
    await user.click(screen.getByTestId('working-dir-pick'));
    expect(onPickDirectory).toHaveBeenCalledTimes(1);
  });

  it('shows recent directories in the recent submenu and selects one', async () => {
    const user = userEvent.setup();
    const onSelectRecent = vi.fn();
    render(
      <WorkingDirPicker
        workingDir={null}
        recentDirs={['/a/b', '/c/d']}
        onPickDirectory={vi.fn()}
        onSelectRecent={onSelectRecent}
      />,
    );
    await user.click(screen.getByTestId('working-dir-trigger'));
    // The submenu opens on hover (matching the mouse's natural path onto the
    // recent-folders row); clicking the row's own button toggles it shut
    // again since hover already opened it.
    await user.hover(screen.getByTestId('working-dir-recent'));
    // Plain fireEvent here (not user.click): userEvent's click simulates a
    // pointer move onto the target first, and jsdom's zero-size layout boxes
    // make that read as leaving the hover-tracked row, closing the flyout
    // before the click lands.
    fireEvent.click(screen.getByText('b'));
    expect(onSelectRecent).toHaveBeenCalledWith('/a/b');
  });

  it('only shows the clear item when both workingDir and onClear are set', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <WorkingDirPicker
        workingDir="/a/b"
        recentDirs={[]}
        onPickDirectory={vi.fn()}
        onSelectRecent={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId('working-dir-trigger'));
    expect(screen.queryByTestId('working-dir-clear')).toBeNull();

    await user.click(screen.getByTestId('working-dir-trigger'));
    rerender(
      <WorkingDirPicker
        workingDir="/a/b"
        recentDirs={[]}
        onPickDirectory={vi.fn()}
        onSelectRecent={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId('working-dir-trigger'));
    expect(screen.getByTestId('working-dir-clear')).toBeTruthy();
  });

  it('accepts label overrides', () => {
    render(
      <WorkingDirPicker
        workingDir={null}
        recentDirs={[]}
        onPickDirectory={vi.fn()}
        onSelectRecent={vi.fn()}
        labels={{ trigger: 'Choisir un dossier' }}
      />,
    );
    expect(screen.getByTestId('working-dir-trigger').textContent).toContain('Choisir un dossier');
  });

  it('falls back to the raw dir when it has no path segments to use as a basename', () => {
    render(
      <WorkingDirPicker
        workingDir="/"
        recentDirs={[]}
        onPickDirectory={vi.fn()}
        onSelectRecent={vi.fn()}
      />,
    );
    expect(screen.getByTestId('working-dir-trigger').textContent).toContain('/');
  });

  it('appends a custom className and shows the invalid state', () => {
    render(
      <WorkingDirPicker
        workingDir="/a/b"
        recentDirs={[]}
        onPickDirectory={vi.fn()}
        onSelectRecent={vi.fn()}
        className="extra"
        invalid
      />,
    );
    expect(screen.getByTestId('working-dir-picker').className).toContain('extra');
    const trigger = screen.getByTestId('working-dir-trigger');
    expect(trigger.className).toContain('invalid');
    expect(trigger.getAttribute('title')).toBe('Directory no longer exists');
  });

  it('fires onOpen only when transitioning from closed to open', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(
      <WorkingDirPicker
        workingDir={null}
        recentDirs={[]}
        onPickDirectory={vi.fn()}
        onSelectRecent={vi.fn()}
        onOpen={onOpen}
      />,
    );
    const trigger = screen.getByTestId('working-dir-trigger');
    await user.click(trigger);
    expect(onOpen).toHaveBeenCalledTimes(1);
    await user.click(trigger);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('applies the "up" placement class to the panel and the recent flyout', async () => {
    const user = userEvent.setup();
    render(
      <WorkingDirPicker
        workingDir={null}
        recentDirs={['/a/b']}
        onPickDirectory={vi.fn()}
        onSelectRecent={vi.fn()}
        placement="up"
      />,
    );
    await user.click(screen.getByTestId('working-dir-trigger'));
    expect(screen.getByTestId('working-dir-panel').className).toContain('up');
    await user.hover(screen.getByTestId('working-dir-recent'));
    expect(screen.getByTestId('working-dir-recent-list').className).toContain('up');
  });

  it('shows the empty-recents message when there are no recent directories', async () => {
    const user = userEvent.setup();
    render(
      <WorkingDirPicker
        workingDir={null}
        recentDirs={[]}
        onPickDirectory={vi.fn()}
        onSelectRecent={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId('working-dir-trigger'));
    await user.hover(screen.getByTestId('working-dir-recent'));
    expect(screen.getByText('No recent folders')).toBeTruthy();
  });

  it('toggles the recent submenu via direct clicks and closes it on mouse leave', async () => {
    const user = userEvent.setup();
    render(
      <WorkingDirPicker
        workingDir={null}
        recentDirs={['/a/b']}
        onPickDirectory={vi.fn()}
        onSelectRecent={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId('working-dir-trigger'));
    const recentButton = screen.getByTestId('working-dir-recent');
    fireEvent.click(recentButton);
    expect(screen.getByTestId('working-dir-recent-list')).toBeTruthy();
    fireEvent.click(recentButton);
    expect(screen.queryByTestId('working-dir-recent-list')).toBeNull();

    fireEvent.mouseEnter(screen.getByText('Recent folders').closest('div')!);
    expect(screen.getByTestId('working-dir-recent-list')).toBeTruthy();
    fireEvent.mouseLeave(screen.getByText('Recent folders').closest('div')!);
    expect(screen.queryByTestId('working-dir-recent-list')).toBeNull();
  });

  it('fires onClear and closes the panel when the clear item is clicked', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(
      <WorkingDirPicker
        workingDir="/a/b"
        recentDirs={[]}
        onPickDirectory={vi.fn()}
        onSelectRecent={vi.fn()}
        onClear={onClear}
      />,
    );
    await user.click(screen.getByTestId('working-dir-trigger'));
    await user.click(screen.getByTestId('working-dir-clear'));
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('working-dir-panel')).toBeNull();
  });

  it('closes the panel on Escape and on an outside mousedown, but not on an inside one', async () => {
    const user = userEvent.setup();
    render(
      <WorkingDirPicker
        workingDir={null}
        recentDirs={[]}
        onPickDirectory={vi.fn()}
        onSelectRecent={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId('working-dir-trigger'));
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('working-dir-panel')).toBeNull();

    await user.click(screen.getByTestId('working-dir-trigger'));
    fireEvent.mouseDown(screen.getByTestId('working-dir-panel'));
    expect(screen.getByTestId('working-dir-panel')).toBeTruthy();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId('working-dir-panel')).toBeNull();
  });
});
