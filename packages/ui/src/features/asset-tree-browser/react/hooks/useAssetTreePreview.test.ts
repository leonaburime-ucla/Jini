// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAssetTreePreview } from './useAssetTreePreview.js';

interface TestFile {
  path: string;
}

describe('useAssetTreePreview', () => {
  it('starts with no preview when no selectInitialPreviewFile is supplied', () => {
    const { result } = renderHook(() => useAssetTreePreview<TestFile>([{ path: 'a.txt' }]));
    expect(result.current.previewPath).toBeNull();
    expect(result.current.previewFile).toBeNull();
  });

  it('resolves previewFile against the full files list, independent of directory scoping', () => {
    const files: TestFile[] = [{ path: 'a.txt' }, { path: 'dir/b.txt' }];
    const { result } = renderHook(() => useAssetTreePreview<TestFile>(files));
    act(() => result.current.setPreviewPath('dir/b.txt'));
    expect(result.current.previewFile).toEqual({ path: 'dir/b.txt' });
  });

  it('clearPreview resets to null', () => {
    const files: TestFile[] = [{ path: 'a.txt' }];
    const { result } = renderHook(() => useAssetTreePreview<TestFile>(files));
    act(() => result.current.setPreviewPath('a.txt'));
    act(() => result.current.clearPreview());
    expect(result.current.previewPath).toBeNull();
  });

  it('clears the preview once its file vanishes from the files list', () => {
    const { result, rerender } = renderHook(({ files }) => useAssetTreePreview<TestFile>(files), {
      initialProps: { files: [{ path: 'a.txt' }] as TestFile[] },
    });
    act(() => result.current.setPreviewPath('a.txt'));
    expect(result.current.previewPath).toBe('a.txt');
    rerender({ files: [] });
    expect(result.current.previewPath).toBeNull();
  });

  it('applies an auto-selected initial preview exactly once', () => {
    const files: TestFile[] = [{ path: 'a.txt' }, { path: 'b.txt' }];
    const selectInitial = (fs: TestFile[]) => fs.find((f) => f.path === 'b.txt') ?? null;
    const { result, rerender } = renderHook(
      ({ files: currentFiles }) => useAssetTreePreview<TestFile>(currentFiles, selectInitial),
      { initialProps: { files } },
    );
    expect(result.current.previewPath).toBe('b.txt');
    // User navigates away from the auto-picked preview; a later files change
    // must not re-apply the auto-pick (it only ever fires once).
    act(() => result.current.clearPreview());
    rerender({ files: [...files] });
    expect(result.current.previewPath).toBeNull();
  });

  it('does nothing when selectInitialPreviewFile returns null', () => {
    const files: TestFile[] = [{ path: 'a.txt' }];
    const { result } = renderHook(() => useAssetTreePreview<TestFile>(files, () => null));
    expect(result.current.previewPath).toBeNull();
  });
});
