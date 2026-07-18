import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMentionAutocomplete } from './useMentionAutocomplete.js';
import type { UseMentionAutocompleteParams, UseMentionAutocompleteResult } from './useMentionAutocomplete.js';
import type { MentionItem } from '../../types.js';

const CATEGORIES = [
  { id: 'skills', label: 'Skills' },
  { id: 'plugins', label: 'Plugins' },
];

const ITEMS: MentionItem[] = [
  { id: '1', label: 'Alpha', category: 'skills', meta: 'A skill' },
  { id: '2', label: 'Beta', category: 'plugins', meta: 'A plugin' },
];

function attachTextarea(current: string, selectionStart: number): HTMLTextAreaElement {
  const el = document.createElement('textarea');
  el.value = current;
  document.body.appendChild(el);
  el.setSelectionRange(selectionStart, selectionStart);
  return el;
}

function setup(overrides: Partial<UseMentionAutocompleteParams<MentionItem>> = {}) {
  const onValueChange = vi.fn();
  const params: UseMentionAutocompleteParams<MentionItem> = {
    value: '',
    onValueChange,
    items: ITEMS,
    categories: CATEGORIES,
    ...overrides,
  };
  const rendered = renderHook<UseMentionAutocompleteResult<MentionItem>, UseMentionAutocompleteParams<MentionItem>>(
    (props) => useMentionAutocomplete(props),
    { initialProps: params },
  );
  return { ...rendered, onValueChange };
}

describe('useMentionAutocomplete', () => {
  it('starts with no active mention and every category visible', () => {
    const { result } = setup();
    expect(result.current.mention).toBeNull();
    expect(result.current.isOpen).toBe(false);
    expect(result.current.activeCategory).toBe('all');
    expect(result.current.selectedItems).toEqual([]);
  });

  it('onTextareaChange detects a trigger and updates the value', () => {
    const { result, onValueChange } = setup();
    act(() => {
      result.current.onTextareaChange({
        target: { value: '@al', selectionStart: 3 },
      } as unknown as React.ChangeEvent<HTMLTextAreaElement>);
    });
    expect(onValueChange).toHaveBeenCalledWith('@al');
    expect(result.current.mention).toEqual({ start: 0, end: 3, query: 'al' });
    expect(result.current.isOpen).toBe(true);
  });

  it('falls back to the value length when the change event reports a null selectionStart', () => {
    const { result, onValueChange } = setup();
    act(() => {
      result.current.onTextareaChange({
        target: { value: '@al', selectionStart: null },
      } as unknown as React.ChangeEvent<HTMLTextAreaElement>);
    });
    expect(onValueChange).toHaveBeenCalledWith('@al');
    // Cursor treated as end-of-value (3) -> the whole "@al" is the query.
    expect(result.current.mention).toEqual({ start: 0, end: 3, query: 'al' });
  });

  it('filters and groups results by the mention query, case-insensitively', () => {
    const { result } = setup();
    act(() => {
      result.current.onTextareaChange({
        target: { value: '@al', selectionStart: 3 },
      } as unknown as React.ChangeEvent<HTMLTextAreaElement>);
    });
    expect(result.current.groups).toHaveLength(1);
    expect(result.current.groups[0]?.category.id).toBe('skills');
    expect(result.current.groups[0]?.items.map((i) => i.id)).toEqual(['1']);
    expect(result.current.hasResults).toBe(true);
  });

  it('setActiveCategory narrows the visible groups', () => {
    const { result } = setup();
    act(() => {
      result.current.onTextareaChange({
        target: { value: '@', selectionStart: 1 },
      } as unknown as React.ChangeEvent<HTMLTextAreaElement>);
    });
    expect(result.current.groups.map((g) => g.category.id)).toEqual(['skills', 'plugins']);

    act(() => result.current.setActiveCategory('plugins'));
    expect(result.current.groups.map((g) => g.category.id)).toEqual(['plugins']);
  });

  it('onTextareaClick / onTextareaKeyUp re-derive the mention from the live textarea', () => {
    const { result } = setup({ value: 'hello @al' });
    const el = attachTextarea('hello @al', 9);
    act(() => {
      (result.current.textareaRef as { current: HTMLTextAreaElement | null }).current = el;
    });
    act(() => result.current.onTextareaClick());
    expect(result.current.mention).toEqual({ start: 6, end: 9, query: 'al' });

    el.value = 'hello @alp';
    el.setSelectionRange(10, 10);
    act(() =>
      result.current.onTextareaKeyUp({ key: 'a' } as unknown as React.KeyboardEvent<HTMLTextAreaElement>),
    );
    expect(result.current.mention?.query).toBe('alp');
    el.remove();
  });

  it('refreshFromTextarea falls back to the value length when selectionStart is null', () => {
    const { result } = setup({ value: '@al' });
    const el = attachTextarea('@al', 3);
    Object.defineProperty(el, 'selectionStart', { value: null, configurable: true });
    act(() => {
      (result.current.textareaRef as { current: HTMLTextAreaElement | null }).current = el;
    });
    act(() => result.current.onTextareaClick());
    expect(result.current.mention).toEqual({ start: 0, end: 3, query: 'al' });
    el.remove();
  });

  it('onTextareaKeyUp skips the refresh for an Escape key (avoids reopening a just-closed mention)', () => {
    const { result } = setup({ value: 'hello @al' });
    const el = attachTextarea('hello @al', 9);
    act(() => {
      (result.current.textareaRef as { current: HTMLTextAreaElement | null }).current = el;
    });
    act(() => result.current.onTextareaClick());
    expect(result.current.mention).not.toBeNull();

    act(() => result.current.closeMention());
    expect(result.current.mention).toBeNull();

    // The textarea content/cursor are unchanged, so a naive keyup-driven
    // refresh would re-detect "@al" and reopen it; Escape must be skipped.
    act(() =>
      result.current.onTextareaKeyUp({ key: 'Escape' } as unknown as React.KeyboardEvent<HTMLTextAreaElement>),
    );
    expect(result.current.mention).toBeNull();
    el.remove();
  });

  it('onTextareaClick/onTextareaKeyUp are no-ops when the textarea ref is unset', () => {
    const { result } = setup();
    act(() => result.current.onTextareaClick());
    expect(result.current.mention).toBeNull();
    act(() =>
      result.current.onTextareaKeyUp({ key: 'a' } as unknown as React.KeyboardEvent<HTMLTextAreaElement>),
    );
    expect(result.current.mention).toBeNull();
  });

  it('onTextareaFocus closes an active mention', () => {
    const { result } = setup();
    act(() => {
      result.current.onTextareaChange({
        target: { value: '@a', selectionStart: 2 },
      } as unknown as React.ChangeEvent<HTMLTextAreaElement>);
    });
    expect(result.current.isOpen).toBe(true);
    act(() => result.current.onTextareaFocus());
    expect(result.current.isOpen).toBe(false);
  });

  it('Escape closes an active mention via onTextareaKeyDown, and is a no-op when nothing is active', () => {
    const { result } = setup();
    const preventDefault = vi.fn();
    act(() => {
      result.current.onTextareaKeyDown({ key: 'Escape', preventDefault } as unknown as React.KeyboardEvent<HTMLTextAreaElement>);
    });
    expect(preventDefault).not.toHaveBeenCalled();

    act(() => {
      result.current.onTextareaChange({
        target: { value: '@a', selectionStart: 2 },
      } as unknown as React.ChangeEvent<HTMLTextAreaElement>);
    });
    act(() => {
      result.current.onTextareaKeyDown({ key: 'Escape', preventDefault } as unknown as React.KeyboardEvent<HTMLTextAreaElement>);
    });
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(result.current.isOpen).toBe(false);
  });

  it('a non-Escape key does nothing special', () => {
    const { result } = setup();
    const preventDefault = vi.fn();
    act(() => {
      result.current.onTextareaKeyDown({ key: 'a', preventDefault } as unknown as React.KeyboardEvent<HTMLTextAreaElement>);
    });
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('pickItem splices the token, closes the mention, and adds to selection', () => {
    const onSelectionChange = vi.fn();
    const { result, onValueChange } = setup({ value: '@al', onSelectionChange });
    act(() => {
      result.current.onTextareaChange({
        target: { value: '@al', selectionStart: 3 },
      } as unknown as React.ChangeEvent<HTMLTextAreaElement>);
    });
    act(() => result.current.pickItem(ITEMS[0] as MentionItem));

    expect(onValueChange).toHaveBeenCalledWith('@Alpha ');
    expect(result.current.mention).toBeNull();
    expect(result.current.selectedItems).toEqual([ITEMS[0]]);
    expect(result.current.selectedKeys.has('skills:1')).toBe(true);
    expect(onSelectionChange).toHaveBeenCalledWith([ITEMS[0]]);
  });

  it('pickItem does not add a duplicate for an already-selected item', () => {
    const { result } = setup();
    act(() => result.current.pickItem(ITEMS[0] as MentionItem));
    act(() => result.current.pickItem(ITEMS[0] as MentionItem));
    expect(result.current.selectedItems).toHaveLength(1);
  });

  it('removeItem removes a selected item and reports the next selection', () => {
    const onSelectionChange = vi.fn();
    const { result } = setup({ onSelectionChange });
    act(() => result.current.pickItem(ITEMS[0] as MentionItem));
    act(() => result.current.pickItem(ITEMS[1] as MentionItem));
    expect(result.current.selectedItems).toHaveLength(2);

    act(() => result.current.removeItem(ITEMS[0] as MentionItem));
    expect(result.current.selectedItems).toEqual([ITEMS[1]]);
    expect(onSelectionChange).toHaveBeenLastCalledWith([ITEMS[1]]);
  });

  it('closeMention forces the popover shut', () => {
    const { result } = setup();
    act(() => {
      result.current.onTextareaChange({
        target: { value: '@a', selectionStart: 2 },
      } as unknown as React.ChangeEvent<HTMLTextAreaElement>);
    });
    expect(result.current.isOpen).toBe(true);
    act(() => result.current.closeMention());
    expect(result.current.isOpen).toBe(false);
  });

  it('closes on Escape dispatched at the document level while open', () => {
    const { result } = setup();
    act(() => {
      result.current.onTextareaChange({
        target: { value: '@a', selectionStart: 2 },
      } as unknown as React.ChangeEvent<HTMLTextAreaElement>);
    });
    expect(result.current.isOpen).toBe(true);
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('supports a custom trigger character', () => {
    const { result, onValueChange } = setup({ value: '/de', triggerChar: '/' });
    act(() => {
      result.current.onTextareaChange({
        target: { value: '/de', selectionStart: 3 },
      } as unknown as React.ChangeEvent<HTMLTextAreaElement>);
    });
    expect(result.current.mention).toEqual({ start: 0, end: 3, query: 'de' });
    act(() => result.current.pickItem(ITEMS[0] as MentionItem));
    expect(onValueChange).toHaveBeenLastCalledWith('/Alpha ');
  });

  it('supports a custom getSearchText selector and maxResultsPerCategory', () => {
    const items: MentionItem[] = [
      { id: '1', label: 'One', category: 'skills', meta: 'zzz' },
      { id: '2', label: 'Two', category: 'skills', meta: 'needle' },
      { id: '3', label: 'Three', category: 'skills', meta: 'needleish' },
    ];
    const { result } = setup({
      value: '@needle',
      items,
      getSearchText: (item) => `${item.label} ${item.meta ?? ''}`,
      maxResultsPerCategory: 1,
    });
    act(() => {
      result.current.onTextareaChange({
        target: { value: '@needle', selectionStart: 7 },
      } as unknown as React.ChangeEvent<HTMLTextAreaElement>);
    });
    expect(result.current.groups).toHaveLength(1);
    expect(result.current.groups[0]?.items).toHaveLength(1);
  });
});
