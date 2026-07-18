// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAssetTreeNavigation } from './useAssetTreeNavigation.js';

interface TestFile {
  path: string;
  kind: string;
  mtime: number;
}

function file(path: string, kind: string, mtime = 0): TestFile {
  return { path, kind, mtime };
}

const getKind = (f: TestFile) => f.kind;
const getModifiedAt = (f: TestFile) => f.mtime;

describe('useAssetTreeNavigation', () => {
  it('derives root-level dirs and a flattened file list at the root (matches the origin panel exactly)', () => {
    const files = [file('a.txt', 'text'), file('dir/b.txt', 'text'), file('dir/sub/c.txt', 'text')];
    const { result } = renderHook(() => useAssetTreeNavigation({ files, getKind, getModifiedAt }));
    expect(result.current.dirsAtCurrentDir).toEqual(['dir']);
    // Root view is flattened: every file (including nested ones) appears.
    expect(result.current.filesAtCurrentDir.map((f) => f.path).sort()).toEqual(['a.txt', 'dir/b.txt', 'dir/sub/c.txt']);
  });

  it('scopes filesAtCurrentDir to exactly one level once navigated into a directory', () => {
    const files = [file('a.txt', 'text'), file('dir/b.txt', 'text'), file('dir/sub/c.txt', 'text')];
    const { result } = renderHook(() => useAssetTreeNavigation({ files, getKind, getModifiedAt }));
    act(() => result.current.setCurrentDir('dir'));
    expect(result.current.dirsAtCurrentDir).toEqual(['sub']);
    expect(result.current.filesAtCurrentDir.map((f) => f.path)).toEqual(['dir/b.txt']);
  });

  it('surfaces an empty persisted folder with no files under it', () => {
    const { result } = renderHook(() =>
      useAssetTreeNavigation({ files: [], folders: [{ path: 'empty-dir' }], getKind, getModifiedAt }),
    );
    expect(result.current.dirsAtCurrentDir).toEqual(['empty-dir']);
  });

  it('groups filesAtCurrentDir into kind sections ordered by sectionOrder, unconfigured kinds appended in first-seen order', () => {
    const files = [file('a.css', 'stylesheet', 1), file('b.ts', 'code', 2), file('c.mp3', 'audio', 3)];
    const { result } = renderHook(() =>
      useAssetTreeNavigation({ files, sectionOrder: ['code', 'stylesheet'], getKind, getModifiedAt }),
    );
    expect(result.current.sections.map((s) => s.kind)).toEqual(['code', 'stylesheet', 'audio']);
  });

  it('sorts files within a section most-recently-modified first', () => {
    const files = [file('old.txt', 'text', 1), file('new.txt', 'text', 100)];
    const { result } = renderHook(() => useAssetTreeNavigation({ files, getKind, getModifiedAt }));
    const textSection = result.current.sections.find((s) => s.kind === 'text');
    expect(textSection?.files.map((f) => f.path)).toEqual(['new.txt', 'old.txt']);
  });

  it('seeds currentDir from navState and reports every navigation back via onNavStateChange', () => {
    const onNavStateChange = vi.fn();
    const files = [file('dir/a.txt', 'text')];
    const { result } = renderHook(() =>
      useAssetTreeNavigation({ files, navState: { currentDir: 'dir' }, onNavStateChange, getKind, getModifiedAt }),
    );
    expect(result.current.currentDir).toBe('dir');
    act(() => result.current.setCurrentDir(''));
    expect(onNavStateChange).toHaveBeenCalledWith({ currentDir: '' });
  });

  it('walks back up to the nearest existing ancestor when the viewed directory vanishes', () => {
    const files = [file('a/b/c.txt', 'text')];
    const { result, rerender } = renderHook(
      ({ files: currentFiles }) => useAssetTreeNavigation({ files: currentFiles, getKind, getModifiedAt }),
      { initialProps: { files } },
    );
    act(() => result.current.setCurrentDir('a/b'));
    expect(result.current.currentDir).toBe('a/b');
    // "a/b/c.txt" is gone, but "a" folder itself would still exist via another file elsewhere.
    rerender({ files: [file('a/other.txt', 'text')] });
    expect(result.current.currentDir).toBe('a');
  });

  it('resets all the way to the root when no ancestor of the vanished directory exists', () => {
    const files = [file('a/b/c.txt', 'text')];
    const { result, rerender } = renderHook(
      ({ files: currentFiles }) => useAssetTreeNavigation({ files: currentFiles, getKind, getModifiedAt }),
      { initialProps: { files } },
    );
    act(() => result.current.setCurrentDir('a/b'));
    rerender({ files: [] });
    expect(result.current.currentDir).toBe('');
  });
});
