// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAssetGridSelection } from './useAssetGridSelection.js';

interface TestAsset {
  id: string;
}

const items: TestAsset[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

describe('useAssetGridSelection', () => {
  it('toggles a single id and sets it as the range anchor', () => {
    const { result } = renderHook(() => useAssetGridSelection(items));
    act(() => result.current.toggleOne('b', 1));
    expect([...result.current.selectedIds]).toEqual(['b']);
    act(() => result.current.rangeTo(3));
    expect([...result.current.selectedIds].sort()).toEqual(['b', 'c', 'd']);
  });

  it('selectAll selects every item, clearSelection empties it', () => {
    const { result } = renderHook(() => useAssetGridSelection(items));
    act(() => result.current.selectAll());
    expect(result.current.selectedIds.size).toBe(4);
    act(() => result.current.clearSelection());
    expect(result.current.selectedIds.size).toBe(0);
  });

  it('drops selected ids that disappear from items on rerender', () => {
    const { result, rerender } = renderHook(({ items: currentItems }) => useAssetGridSelection(currentItems), {
      initialProps: { items },
    });
    act(() => result.current.selectAll());
    expect(result.current.selectedIds.size).toBe(4);
    rerender({ items: [{ id: 'a' }, { id: 'c' }] });
    expect([...result.current.selectedIds].sort()).toEqual(['a', 'c']);
  });

  it('toggling the same id twice deselects it', () => {
    const { result } = renderHook(() => useAssetGridSelection(items));
    act(() => result.current.toggleOne('a', 0));
    act(() => result.current.toggleOne('a', 0));
    expect(result.current.selectedIds.size).toBe(0);
  });
});
