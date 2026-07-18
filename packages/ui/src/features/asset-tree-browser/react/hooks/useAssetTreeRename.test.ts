// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAssetTreeRename } from './useAssetTreeRename.js';

interface TestFile {
  path: string;
}

describe('useAssetTreeRename', () => {
  it('startRename seeds the draft with the basename, stripping the currentDir prefix', () => {
    const { result } = renderHook(() =>
      useAssetTreeRename<TestFile>({ currentDir: 'dir', onRenameFile: vi.fn() }),
    );
    act(() => result.current.startRename('dir/file.txt'));
    expect(result.current.renaming).toEqual({ path: 'dir/file.txt', draft: 'file.txt', saving: false });
  });

  it('startRename at the root keeps the full path as the draft', () => {
    const { result } = renderHook(() => useAssetTreeRename<TestFile>({ currentDir: '', onRenameFile: vi.fn() }));
    act(() => result.current.startRename('file.txt'));
    expect(result.current.renaming?.draft).toBe('file.txt');
  });

  it('updateDraft edits the in-progress draft', () => {
    const { result } = renderHook(() => useAssetTreeRename<TestFile>({ currentDir: '', onRenameFile: vi.fn() }));
    act(() => result.current.startRename('file.txt'));
    act(() => result.current.updateDraft('renamed.txt'));
    expect(result.current.renaming?.draft).toBe('renamed.txt');
  });

  it('updateDraft is a no-op when no rename is in progress', () => {
    const { result } = renderHook(() => useAssetTreeRename<TestFile>({ currentDir: '', onRenameFile: vi.fn() }));
    act(() => result.current.updateDraft('x'));
    expect(result.current.renaming).toBeNull();
  });

  it('commitRename with an empty draft cancels the rename without calling onRenameFile', async () => {
    const onRenameFile = vi.fn();
    const { result } = renderHook(() => useAssetTreeRename<TestFile>({ currentDir: '', onRenameFile }));
    act(() => result.current.startRename('file.txt'));
    act(() => result.current.updateDraft('   '));
    await act(async () => result.current.commitRename());
    expect(onRenameFile).not.toHaveBeenCalled();
    expect(result.current.renaming).toBeNull();
  });

  it('commitRename with an unchanged draft cancels the rename without calling onRenameFile', async () => {
    const onRenameFile = vi.fn();
    const { result } = renderHook(() => useAssetTreeRename<TestFile>({ currentDir: '', onRenameFile }));
    act(() => result.current.startRename('file.txt'));
    await act(async () => result.current.commitRename());
    expect(onRenameFile).not.toHaveBeenCalled();
    expect(result.current.renaming).toBeNull();
  });

  it('commitRename is a no-op when no rename is in progress', async () => {
    const onRenameFile = vi.fn();
    const { result } = renderHook(() => useAssetTreeRename<TestFile>({ currentDir: '', onRenameFile }));
    await act(async () => result.current.commitRename());
    expect(onRenameFile).not.toHaveBeenCalled();
  });

  it('commits a successful rename, calls onRenamed, and clears renaming', async () => {
    const renamedFile = { path: 'renamed.txt' };
    const onRenameFile = vi.fn().mockResolvedValue(renamedFile);
    const onRenamed = vi.fn();
    const { result } = renderHook(() =>
      useAssetTreeRename<TestFile>({ currentDir: '', onRenameFile, onRenamed }),
    );
    act(() => result.current.startRename('file.txt'));
    act(() => result.current.updateDraft('renamed.txt'));
    await act(async () => result.current.commitRename());
    expect(onRenameFile).toHaveBeenCalledWith('file.txt', 'renamed.txt');
    expect(onRenamed).toHaveBeenCalledWith('file.txt', renamedFile);
    expect(result.current.renaming).toBeNull();
    expect(result.current.renameError).toBeNull();
  });

  it('prefixes the committed path with currentDir when not at the root', async () => {
    const renamedFile = { path: 'dir/renamed.txt' };
    const onRenameFile = vi.fn().mockResolvedValue(renamedFile);
    const { result } = renderHook(() => useAssetTreeRename<TestFile>({ currentDir: 'dir', onRenameFile }));
    act(() => result.current.startRename('dir/file.txt'));
    act(() => result.current.updateDraft('renamed.txt'));
    await act(async () => result.current.commitRename());
    expect(onRenameFile).toHaveBeenCalledWith('dir/file.txt', 'dir/renamed.txt');
  });

  it('sets renameError and reverts saving when onRenameFile resolves falsy', async () => {
    const onRenameFile = vi.fn().mockResolvedValue(null);
    const { result } = renderHook(() => useAssetTreeRename<TestFile>({ currentDir: '', onRenameFile }));
    act(() => result.current.startRename('file.txt'));
    act(() => result.current.updateDraft('renamed.txt'));
    await act(async () => result.current.commitRename());
    expect(result.current.renameError).toBe('Rename failed');
    expect(result.current.renaming).toEqual({ path: 'file.txt', draft: 'renamed.txt', saving: false });
  });

  it('sets renameError from a thrown Error and reverts saving', async () => {
    const onRenameFile = vi.fn().mockRejectedValue(new Error('conflict'));
    const { result } = renderHook(() => useAssetTreeRename<TestFile>({ currentDir: '', onRenameFile }));
    act(() => result.current.startRename('file.txt'));
    act(() => result.current.updateDraft('renamed.txt'));
    await act(async () => result.current.commitRename());
    expect(result.current.renameError).toBe('conflict');
    expect(result.current.renaming?.saving).toBe(false);
  });

  it('sets renameError from a thrown non-Error value via String()', async () => {
    const onRenameFile = vi.fn().mockRejectedValue('nope');
    const { result } = renderHook(() => useAssetTreeRename<TestFile>({ currentDir: '', onRenameFile }));
    act(() => result.current.startRename('file.txt'));
    act(() => result.current.updateDraft('renamed.txt'));
    await act(async () => result.current.commitRename());
    expect(result.current.renameError).toBe('nope');
  });

  it('cancelRename clears both renaming and any renameError', async () => {
    const onRenameFile = vi.fn().mockRejectedValue(new Error('conflict'));
    const { result } = renderHook(() => useAssetTreeRename<TestFile>({ currentDir: '', onRenameFile }));
    act(() => result.current.startRename('file.txt'));
    act(() => result.current.updateDraft('renamed.txt'));
    await act(async () => result.current.commitRename());
    expect(result.current.renameError).not.toBeNull();
    act(() => result.current.cancelRename());
    expect(result.current.renaming).toBeNull();
    expect(result.current.renameError).toBeNull();
  });

  it('starting a new rename clears a stale renameError from a previous attempt', async () => {
    const onRenameFile = vi.fn().mockRejectedValue(new Error('conflict'));
    const { result } = renderHook(() => useAssetTreeRename<TestFile>({ currentDir: '', onRenameFile }));
    act(() => result.current.startRename('file.txt'));
    act(() => result.current.updateDraft('renamed.txt'));
    await act(async () => result.current.commitRename());
    expect(result.current.renameError).not.toBeNull();
    act(() => result.current.startRename('other.txt'));
    expect(result.current.renameError).toBeNull();
  });

  it('a rejection arriving after the rename was already cancelled does not resurrect the renaming state', async () => {
    let rejectRename: (err: unknown) => void = () => {};
    const onRenameFile = vi.fn(
      () =>
        new Promise<TestFile | null>((_resolve, reject) => {
          rejectRename = reject;
        }),
    );
    const { result } = renderHook(() => useAssetTreeRename<TestFile>({ currentDir: '', onRenameFile }));
    act(() => result.current.startRename('file.txt'));
    act(() => result.current.updateDraft('renamed.txt'));
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.commitRename();
    });
    expect(result.current.renaming?.saving).toBe(true);
    act(() => result.current.cancelRename());
    expect(result.current.renaming).toBeNull();
    await act(async () => {
      rejectRename(new Error('too late'));
      await pending;
    });
    // The catch handler's `setRenaming((prev) => (prev ? ... : prev))` must
    // see `renaming` already null (from the cancel above) and leave it
    // alone, rather than reviving a `saving: false` state for a rename the
    // user already dismissed.
    expect(result.current.renaming).toBeNull();
  });
});
