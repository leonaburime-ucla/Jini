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
});
