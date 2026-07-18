// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAssetTreeSelection } from './useAssetTreeSelection.js';

interface TestFile {
  path: string;
}

describe('useAssetTreeSelection', () => {
  it('toggles a path in and out of the selection', () => {
    const files: TestFile[] = [{ path: 'a.txt' }, { path: 'b.txt' }];
    const { result } = renderHook(() => useAssetTreeSelection(files, ''));
    act(() => result.current.toggleSelect('a.txt'));
    expect([...result.current.selected]).toEqual(['a.txt']);
    act(() => result.current.toggleSelect('a.txt'));
    expect(result.current.selected.size).toBe(0);
  });

  it('clearSelection empties the set', () => {
    const files: TestFile[] = [{ path: 'a.txt' }];
    const { result } = renderHook(() => useAssetTreeSelection(files, ''));
    act(() => result.current.toggleSelect('a.txt'));
    act(() => result.current.clearSelection());
    expect(result.current.selected.size).toBe(0);
  });

  it('clears the selection whenever currentDir changes', () => {
    const files: TestFile[] = [{ path: 'a.txt' }];
    const { result, rerender } = renderHook(
      ({ currentDir }) => useAssetTreeSelection(files, currentDir),
      { initialProps: { currentDir: '' } },
    );
    act(() => result.current.toggleSelect('a.txt'));
    expect(result.current.selected.size).toBe(1);
    rerender({ currentDir: 'dir' });
    expect(result.current.selected.size).toBe(0);
  });

  it('prunes a selected path once it disappears from filesAtCurrentDir', () => {
    const { result, rerender } = renderHook(
      ({ files }) => useAssetTreeSelection(files, ''),
      { initialProps: { files: [{ path: 'a.txt' }, { path: 'b.txt' }] as TestFile[] } },
    );
    act(() => result.current.toggleSelect('a.txt'));
    act(() => result.current.toggleSelect('b.txt'));
    expect(result.current.selected.size).toBe(2);
    rerender({ files: [{ path: 'b.txt' }] });
    expect([...result.current.selected]).toEqual(['b.txt']);
  });

  it('renamePath carries a selected path over to its new path', () => {
    const files: TestFile[] = [{ path: 'a.txt' }];
    const { result } = renderHook(() => useAssetTreeSelection(files, ''));
    act(() => result.current.toggleSelect('a.txt'));
    act(() => result.current.renamePath('a.txt', 'renamed.txt'));
    expect([...result.current.selected]).toEqual(['renamed.txt']);
  });

  it('renamePath is a no-op when the old path was never selected', () => {
    const files: TestFile[] = [{ path: 'a.txt' }];
    const { result } = renderHook(() => useAssetTreeSelection(files, ''));
    act(() => result.current.renamePath('never-selected.txt', 'renamed.txt'));
    expect(result.current.selected.size).toBe(0);
  });
});
