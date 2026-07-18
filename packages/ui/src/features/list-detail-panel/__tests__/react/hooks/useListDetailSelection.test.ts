import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useListDetailSelection } from '../../../react/hooks/useListDetailSelection.js';

interface Item {
  id: string;
}

describe('useListDetailSelection', () => {
  it('defaults to the first item when no initial selection is given', () => {
    const items: Item[] = [{ id: 'a' }, { id: 'b' }];
    const { result } = renderHook(() => useListDetailSelection(items));
    expect(result.current.selectedId).toBe('a');
  });

  it('honors an initial selection that is present', () => {
    const items: Item[] = [{ id: 'a' }, { id: 'b' }];
    const { result } = renderHook(() => useListDetailSelection(items, 'b'));
    expect(result.current.selectedId).toBe('b');
  });

  it('falls back to the first item when the initial selection is not present', () => {
    const items: Item[] = [{ id: 'a' }, { id: 'b' }];
    const { result } = renderHook(() => useListDetailSelection(items, 'missing'));
    expect(result.current.selectedId).toBe('a');
  });

  it('is null when items starts empty', () => {
    const { result } = renderHook(() => useListDetailSelection<Item>([]));
    expect(result.current.selectedId).toBeNull();
  });

  it('select() moves the current pick', () => {
    const items: Item[] = [{ id: 'a' }, { id: 'b' }];
    const { result } = renderHook(() => useListDetailSelection(items));
    act(() => result.current.select('b'));
    expect(result.current.selectedId).toBe('b');
  });

  it('keeps the current pick when items changes but the pick is still present', () => {
    let items: Item[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const { result, rerender } = renderHook(() => useListDetailSelection(items));
    act(() => result.current.select('b'));
    expect(result.current.selectedId).toBe('b');

    items = [{ id: 'a' }, { id: 'b' }];
    rerender();
    expect(result.current.selectedId).toBe('b');
  });

  it('falls back to the first item when the current pick is removed from items', () => {
    let items: Item[] = [{ id: 'a' }, { id: 'b' }];
    const { result, rerender } = renderHook(() => useListDetailSelection(items));
    act(() => result.current.select('b'));
    expect(result.current.selectedId).toBe('b');

    items = [{ id: 'a' }, { id: 'c' }];
    rerender();
    expect(result.current.selectedId).toBe('a');
  });

  it('clears the selection when items becomes empty', () => {
    let items: Item[] = [{ id: 'a' }];
    const { result, rerender } = renderHook(() => useListDetailSelection(items));
    expect(result.current.selectedId).toBe('a');

    items = [];
    rerender();
    expect(result.current.selectedId).toBeNull();
  });

  it('select(null) clears the selection explicitly', () => {
    const items: Item[] = [{ id: 'a' }];
    const { result } = renderHook(() => useListDetailSelection(items));
    act(() => result.current.select(null));
    expect(result.current.selectedId).toBeNull();
  });
});
