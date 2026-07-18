import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCommandPalette, useWiredCommandPalette } from './useCommandPalette.js';
import type { CommandPaletteItem } from '../../types.js';
import type { CommandPaletteRecentsPort } from '../../ports.js';

function fakeRecents(initial: Record<string, string[]> = {}): CommandPaletteRecentsPort {
  const store = new Map(Object.entries(initial));
  return {
    read: (scopeKey) => store.get(scopeKey) ?? [],
    push: (scopeKey, id) => {
      const prev = store.get(scopeKey) ?? [];
      store.set(scopeKey, [id, ...prev.filter((existing) => existing !== id)]);
    },
  };
}

const items: CommandPaletteItem[] = [
  { id: 'a', name: 'apple.txt', kind: 'file', mtime: 1 },
  { id: 'b', name: 'banana.txt', kind: 'file', mtime: 2 },
];

function keyEvent(key: string, isComposing = false) {
  return {
    key,
    nativeEvent: { isComposing },
    preventDefault: vi.fn(),
  } as unknown as React.KeyboardEvent;
}

describe('useCommandPalette', () => {
  it('starts with an empty query and cursor 0, ranking by the empty-query rule', () => {
    const { result } = renderHook(() =>
      useCommandPalette({ items, onSelect: vi.fn(), onClose: vi.fn() }, { recents: fakeRecents() }),
    );
    expect(result.current.query).toBe('');
    expect(result.current.cursor).toBe(0);
    expect(result.current.results.map((r) => r.item.id)).toEqual(['b', 'a']);
  });

  it('re-ranks results as the query changes and resets the cursor', () => {
    const { result } = renderHook(() =>
      useCommandPalette({ items, onSelect: vi.fn(), onClose: vi.fn() }, { recents: fakeRecents() }),
    );
    act(() => result.current.setCursorTo(1));
    act(() => result.current.setQuery('apple'));
    expect(result.current.results.map((r) => r.item.id)).toEqual(['a']);
    expect(result.current.cursor).toBe(0);
  });

  it('ArrowDown/ArrowUp move the cursor with wraparound', () => {
    const { result } = renderHook(() =>
      useCommandPalette({ items, onSelect: vi.fn(), onClose: vi.fn() }, { recents: fakeRecents() }),
    );
    act(() => result.current.handleKeyDown(keyEvent('ArrowDown')));
    expect(result.current.cursor).toBe(1);
    act(() => result.current.handleKeyDown(keyEvent('ArrowDown')));
    expect(result.current.cursor).toBe(0);
    act(() => result.current.handleKeyDown(keyEvent('ArrowUp')));
    expect(result.current.cursor).toBe(1);
  });

  it('ArrowDown/ArrowUp are no-ops when there are no results', () => {
    const { result } = renderHook(() =>
      useCommandPalette({ items: [], onSelect: vi.fn(), onClose: vi.fn() }, { recents: fakeRecents() }),
    );
    act(() => result.current.handleKeyDown(keyEvent('ArrowDown')));
    expect(result.current.cursor).toBe(0);
    act(() => result.current.handleKeyDown(keyEvent('ArrowUp')));
    expect(result.current.cursor).toBe(0);
  });

  it('Escape calls onClose', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useCommandPalette({ items, onSelect: vi.fn(), onClose }, { recents: fakeRecents() }),
    );
    act(() => result.current.handleKeyDown(keyEvent('Escape')));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Enter selects the item at the cursor, pushes a recent, and closes', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const recents = fakeRecents();
    const { result } = renderHook(() =>
      useCommandPalette({ items, onSelect, onClose, scopeKey: 'proj-1' }, { recents }),
    );
    act(() => result.current.handleKeyDown(keyEvent('Enter')));
    expect(onSelect).toHaveBeenCalledWith(items[1]); // cursor 0 -> ranked-first item ('b')
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(recents.read('proj-1')).toEqual(['b']);
  });

  it('Enter is a no-op when there is no result at the cursor', () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() =>
      useCommandPalette({ items: [], onSelect, onClose: vi.fn() }, { recents: fakeRecents() }),
    );
    act(() => result.current.handleKeyDown(keyEvent('Enter')));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('ignores navigation/commit keys while an IME composition is active', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useCommandPalette({ items, onSelect: vi.fn(), onClose }, { recents: fakeRecents() }),
    );
    act(() => result.current.handleKeyDown(keyEvent('Escape', true)));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('selectResult pushes a recent under the default scope when none is given', () => {
    const recents = fakeRecents();
    const { result } = renderHook(() =>
      useCommandPalette({ items, onSelect: vi.fn(), onClose: vi.fn() }, { recents }),
    );
    act(() => result.current.selectResult(result.current.results[0]!));
    expect(recents.read('default')).toEqual(['b']);
  });

  it('useWiredCommandPalette wires the real localStorage-backed recents port', () => {
    window.localStorage.clear();
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useWiredCommandPalette({ items, onSelect, onClose, scopeKey: 'wired-scope' }),
    );
    act(() => result.current.handleKeyDown(keyEvent('Enter')));
    expect(onSelect).toHaveBeenCalledWith(items[1]);
    expect(window.localStorage.getItem('jini:command-palette:recents:wired-scope')).toContain('"b"');
  });

  it('ignores other keys entirely', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useCommandPalette({ items, onSelect: vi.fn(), onClose }, { recents: fakeRecents() }),
    );
    act(() => result.current.handleKeyDown(keyEvent('a')));
    expect(onClose).not.toHaveBeenCalled();
    expect(result.current.cursor).toBe(0);
  });
});
