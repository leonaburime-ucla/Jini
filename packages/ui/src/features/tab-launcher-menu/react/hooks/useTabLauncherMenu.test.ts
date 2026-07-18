import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTabLauncherMenu } from './useTabLauncherMenu.js';
import type { TabLauncherAction, TabLauncherResultItem } from '../../types.js';

function makeAnchor(rect: Partial<DOMRect> = {}): HTMLElement {
  const anchor = document.createElement('button');
  anchor.getBoundingClientRect = () =>
    ({ top: 0, bottom: 40, left: 0, right: 400, width: 40, height: 40, x: 0, y: 0, toJSON: () => ({}), ...rect } as DOMRect);
  document.body.appendChild(anchor);
  return anchor;
}

const files: TabLauncherResultItem[] = [
  { id: 'f1', name: 'apple.png', kind: 'image' },
  { id: 'f2', name: 'index.html', kind: 'code' },
];
const tabs: TabLauncherResultItem[] = [
  { id: 't1', name: 'Design system', kind: 'design-system' },
];

describe('useTabLauncherMenu', () => {
  it('stays closed (no position) while anchor is null', () => {
    const { result } = renderHook(() =>
      useTabLauncherMenu({ anchor: null, files, onOpenFile: vi.fn(), onClose: vi.fn() }),
    );
    expect(result.current.position).toBeNull();
  });

  it('computes a position once a real anchor is supplied', () => {
    const anchor = makeAnchor();
    const { result } = renderHook(() =>
      useTabLauncherMenu({ anchor, files, onOpenFile: vi.fn(), onClose: vi.fn() }),
    );
    expect(result.current.position).not.toBeNull();
    expect(result.current.position?.top).toBe(46);
  });

  it('fires an onTrack open event exactly once on mount', () => {
    const anchor = makeAnchor();
    const onTrack = vi.fn();
    renderHook(() => useTabLauncherMenu({ anchor, files, onOpenFile: vi.fn(), onClose: vi.fn(), onTrack }));
    expect(onTrack).toHaveBeenCalledTimes(1);
    expect(onTrack).toHaveBeenCalledWith({ type: 'open' });
  });

  it('filters files by query and tracks kind-filter changes', () => {
    const anchor = makeAnchor();
    const onTrack = vi.fn();
    const { result } = renderHook(() =>
      useTabLauncherMenu({ anchor, files, onOpenFile: vi.fn(), onClose: vi.fn(), onTrack }),
    );
    act(() => result.current.setQuery('apple'));
    expect(result.current.fileResults.map((f) => f.id)).toEqual(['f1']);

    act(() => result.current.setKindFilter('code'));
    expect(onTrack).toHaveBeenCalledWith({ type: 'filter', kind: 'code' });
  });

  it('excludes tab results once a kind filter is active', () => {
    const anchor = makeAnchor();
    const { result } = renderHook(() =>
      useTabLauncherMenu({ anchor, files, tabs, onOpenFile: vi.fn(), onClose: vi.fn() }),
    );
    expect(result.current.tabResults).toHaveLength(1);
    act(() => result.current.setKindFilter('image'));
    expect(result.current.tabResults).toHaveLength(0);
  });

  it('clamps the selection down when the result set shrinks', () => {
    const anchor = makeAnchor();
    const { result } = renderHook(() =>
      useTabLauncherMenu({ anchor, files, tabs, onOpenFile: vi.fn(), onClose: vi.fn() }),
    );
    act(() => result.current.setSelected(2));
    expect(result.current.selected).toBe(2);
    act(() => result.current.setQuery('apple')); // shrinks to 1 total result
    expect(result.current.selected).toBe(0);
  });

  it('ArrowDown/ArrowUp move the flat file+tab selection with wraparound', () => {
    const anchor = makeAnchor();
    const { result } = renderHook(() =>
      useTabLauncherMenu({ anchor, files, tabs, onOpenFile: vi.fn(), onClose: vi.fn() }),
    );
    const down = { key: 'ArrowDown', preventDefault: vi.fn() } as unknown as React.KeyboardEvent<HTMLInputElement>;
    const up = { key: 'ArrowUp', preventDefault: vi.fn() } as unknown as React.KeyboardEvent<HTMLInputElement>;
    act(() => result.current.handleInputKeyDown(down));
    expect(result.current.selected).toBe(1);
    act(() => result.current.handleInputKeyDown(down));
    expect(result.current.selected).toBe(2);
    act(() => result.current.handleInputKeyDown(down)); // wraps: 3 total (2 files + 1 tab)
    expect(result.current.selected).toBe(0);
    act(() => result.current.handleInputKeyDown(up));
    expect(result.current.selected).toBe(2);
  });

  it('Enter selects the file at the resolved selection, tracks it, and closes', () => {
    const anchor = makeAnchor();
    const onOpenFile = vi.fn();
    const onClose = vi.fn();
    const onTrack = vi.fn();
    const { result } = renderHook(() =>
      useTabLauncherMenu({ anchor, files, onOpenFile, onClose, onTrack }),
    );
    const enter = { key: 'Enter', preventDefault: vi.fn() } as unknown as React.KeyboardEvent<HTMLInputElement>;
    act(() => result.current.handleInputKeyDown(enter));
    expect(onOpenFile).toHaveBeenCalledWith(files[0]);
    expect(onTrack).toHaveBeenCalledWith({ type: 'select-file', item: files[0] });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Enter selects the tab at the resolved selection past the file range', () => {
    const anchor = makeAnchor();
    const onOpenTab = vi.fn();
    const onTrack = vi.fn();
    const { result } = renderHook(() =>
      useTabLauncherMenu({ anchor, files, tabs, onOpenFile: vi.fn(), onOpenTab, onClose: vi.fn(), onTrack }),
    );
    act(() => result.current.setSelected(2)); // past the 2 files -> tab index 0
    const enter = { key: 'Enter', preventDefault: vi.fn() } as unknown as React.KeyboardEvent<HTMLInputElement>;
    act(() => result.current.handleInputKeyDown(enter));
    expect(onOpenTab).toHaveBeenCalledWith(tabs[0]);
    expect(onTrack).toHaveBeenCalledWith({ type: 'select-tab', item: tabs[0] });
  });

  it('Enter with no results runs the first action instead, and is a no-op with no actions', () => {
    const anchor = makeAnchor();
    const run = vi.fn();
    const onTrack = vi.fn();
    const actions: TabLauncherAction<{ scope: string }>[] = [
      { id: 'a1', label: 'New thing', run },
    ];
    const { result } = renderHook(() =>
      useTabLauncherMenu({
        anchor,
        files: [],
        actions,
        actionContext: { scope: 'proj-1' },
        onOpenFile: vi.fn(),
        onClose: vi.fn(),
        onTrack,
      }),
    );
    const enter = { key: 'Enter', preventDefault: vi.fn() } as unknown as React.KeyboardEvent<HTMLInputElement>;
    act(() => result.current.handleInputKeyDown(enter));
    expect(run).toHaveBeenCalledWith({ scope: 'proj-1' });
    expect(onTrack).toHaveBeenCalledWith({ type: 'run-action', actionId: 'a1' });
  });

  it('Enter with no results and no actions is a no-op', () => {
    const anchor = makeAnchor();
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useTabLauncherMenu({ anchor, files: [], onOpenFile: vi.fn(), onClose }),
    );
    const enter = { key: 'Enter', preventDefault: vi.fn() } as unknown as React.KeyboardEvent<HTMLInputElement>;
    act(() => result.current.handleInputKeyDown(enter));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores other keys', () => {
    const anchor = makeAnchor();
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useTabLauncherMenu({ anchor, files, onOpenFile: vi.fn(), onClose }),
    );
    const other = { key: 'a', preventDefault: vi.fn() } as unknown as React.KeyboardEvent<HTMLInputElement>;
    act(() => result.current.handleInputKeyDown(other));
    expect(result.current.selected).toBe(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('recomputes position on window resize', () => {
    const anchor = makeAnchor({ right: 400 });
    const { result } = renderHook(() =>
      useTabLauncherMenu({ anchor, files, onOpenFile: vi.fn(), onClose: vi.fn() }),
    );
    const firstLeft = result.current.position?.left;
    anchor.getBoundingClientRect = () => ({ top: 0, bottom: 40, left: 0, right: 900, width: 40, height: 40, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current.position?.left).not.toBe(firstLeft);
  });
});
