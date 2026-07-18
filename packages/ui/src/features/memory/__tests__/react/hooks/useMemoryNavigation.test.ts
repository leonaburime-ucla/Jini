// Unit tests for the navigation/layout hook. It's a pure state container (no
// port, no effects), so the whole contract is the tab/modal transitions and
// the openEditor/closeEditor coordination the orchestrator injects into the
// entries hook. These pin those transitions in isolation.
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useMemoryNavigation } from '../../../react/hooks/useMemoryNavigation.hooks.js';

describe('useMemoryNavigation', () => {
  it('starts on the memories view / profile sub-tab with both modals closed', () => {
    const { result } = renderHook(() => useMemoryNavigation());
    expect(result.current.topTab).toBe('memories');
    expect(result.current.activeTab).toBe('profile');
    expect(result.current.addModalOpen).toBe(false);
    expect(result.current.advancedModalOpen).toBe(false);
    expect(result.current.recordsRef.current).toBeNull();
  });

  it('setTopTab switches the top-level view', () => {
    const { result } = renderHook(() => useMemoryNavigation());
    act(() => result.current.setTopTab('how'));
    expect(result.current.topTab).toBe('how');
  });

  it('setActiveTab switches the source sub-tab', () => {
    const { result } = renderHook(() => useMemoryNavigation());
    act(() => result.current.setActiveTab('connected'));
    expect(result.current.activeTab).toBe('connected');
  });

  it('setAddModalOpen toggles the add modal directly', () => {
    const { result } = renderHook(() => useMemoryNavigation());
    act(() => result.current.setAddModalOpen(true));
    expect(result.current.addModalOpen).toBe(true);
    act(() => result.current.setAddModalOpen(false));
    expect(result.current.addModalOpen).toBe(false);
  });

  it('setAdvancedModalOpen toggles independently of the add modal', () => {
    const { result } = renderHook(() => useMemoryNavigation());

    act(() => result.current.setAdvancedModalOpen(true));
    expect(result.current.advancedModalOpen).toBe(true);
    expect(result.current.addModalOpen).toBe(false);

    act(() => result.current.setAdvancedModalOpen(false));
    expect(result.current.advancedModalOpen).toBe(false);
  });

  it('openEditor jumps to memories, opens the add modal, and selects the manual sub-tab', () => {
    const { result } = renderHook(() => useMemoryNavigation());

    act(() => {
      // Simulate having navigated away first, so the jump-back is observable.
      result.current.setTopTab('how');
      result.current.setActiveTab('connected');
    });
    expect(result.current.topTab).toBe('how');
    expect(result.current.activeTab).toBe('connected');

    act(() => {
      result.current.openEditor();
    });
    expect(result.current.topTab).toBe('memories');
    expect(result.current.addModalOpen).toBe(true);
    expect(result.current.activeTab).toBe('manual');
  });

  it('closeEditor closes the add modal without touching topTab or activeTab', () => {
    const { result } = renderHook(() => useMemoryNavigation());

    act(() => {
      result.current.setTopTab('how');
      result.current.setActiveTab('chat');
      result.current.setAddModalOpen(true);
    });

    act(() => {
      result.current.closeEditor();
    });

    expect(result.current.addModalOpen).toBe(false);
    // Neither the top tab nor the active sub-tab were touched.
    expect(result.current.topTab).toBe('how');
    expect(result.current.activeTab).toBe('chat');
  });

  it('closeEditor after openEditor leaves the manual sub-tab selected', () => {
    const { result } = renderHook(() => useMemoryNavigation());

    act(() => result.current.openEditor());
    expect(result.current.addModalOpen).toBe(true);

    act(() => result.current.closeEditor());
    expect(result.current.addModalOpen).toBe(false);
    expect(result.current.activeTab).toBe('manual');
  });

  it('openEditor / closeEditor keep a stable identity across renders', () => {
    const { result, rerender } = renderHook(() => useMemoryNavigation());
    const firstOpen = result.current.openEditor;
    const firstClose = result.current.closeEditor;
    rerender();
    expect(result.current.openEditor).toBe(firstOpen);
    expect(result.current.closeEditor).toBe(firstClose);
  });

  it('recordsRef is a stable, initially-null ref for the records section', () => {
    const { result, rerender } = renderHook(() => useMemoryNavigation());
    const firstRef = result.current.recordsRef;
    expect(firstRef.current).toBeNull();
    rerender();
    expect(result.current.recordsRef).toBe(firstRef);
  });
});
