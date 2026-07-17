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

  it('rangeTo before any toggle anchors the range at the target index itself (a shift-click with no prior anchor)', () => {
    const { result } = renderHook(() => useAssetGridSelection(items));
    act(() => result.current.rangeTo(2));
    // No anchor yet -> anchor defaults to the target, so exactly one id is selected.
    expect([...result.current.selectedIds]).toEqual(['c']);
  });

  it('pruneMissingSelection bails out via the exact same Set reference when the asset list changes but the selection is unaffected (no extra re-render)', () => {
    let renders = 0;
    const { result, rerender } = renderHook(
      ({ items: currentItems }) => {
        renders += 1;
        return useAssetGridSelection(currentItems);
      },
      { initialProps: { items } },
    );
    act(() => result.current.toggleOne('a', 0));
    const selectedIdsAfterToggle = result.current.selectedIds;
    const rendersAfterToggle = renders;
    // A rerender with a DIFFERENT items array reference, but the exact same
    // ids -- pruneMissingSelection must return the same Set so setSelectedIds
    // bails out instead of forcing an extra render.
    rerender({ items: [...items] });
    expect(result.current.selectedIds).toBe(selectedIdsAfterToggle);
    expect(renders).toBe(rendersAfterToggle + 1); // only the rerender itself, no extra state-driven render
  });
});
