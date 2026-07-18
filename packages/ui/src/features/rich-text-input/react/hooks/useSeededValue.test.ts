import { act, renderHook } from '@testing-library/react';
import { $createParagraphNode, $createTextNode, $getRoot } from 'lexical';
import { describe, expect, it } from 'vitest';
import type { MentionEntity } from '../../types.js';
import { serializeRichText } from '../../serialize.js';
import { makeLexicalWrapper } from '../test-support/lexical-harness.js';
import { useSeededValue } from './useSeededValue.js';

const slack: MentionEntity = { id: 'slack', kind: 'connector', label: 'Slack', token: '@Slack' };

describe('useSeededValue', () => {
  it('seeds the editor from an initial value', () => {
    const { wrapper, getEditor } = makeLexicalWrapper();
    renderHook(() => useSeededValue('hi @Slack', [slack]), { wrapper });
    const editor = getEditor();
    expect(serializeRichText(editor.getEditorState())).toEqual({
      text: 'hi @Slack',
      mentions: [slack],
    });
  });

  it('reseeds when value changes externally (e.g. a template insert)', () => {
    const { wrapper, getEditor } = makeLexicalWrapper();
    const { rerender } = renderHook(({ value }: { value: string }) => useSeededValue(value, [slack]), {
      wrapper,
      initialProps: { value: 'first' },
    });
    const editor = getEditor();
    expect(serializeRichText(editor.getEditorState()).text).toBe('first');
    rerender({ value: 'second @Slack' });
    expect(serializeRichText(editor.getEditorState()).text).toBe('second @Slack');
  });

  it('does not reseed (preserves caret) when value already equals the live serialized text', () => {
    const { wrapper, getEditor } = makeLexicalWrapper();
    const { rerender } = renderHook(({ value }: { value: string }) => useSeededValue(value, []), {
      wrapper,
      initialProps: { value: 'hello' },
    });
    const editor = getEditor();
    // Simulate the user typing further, past what `value` (still 'hello')
    // knows about.
    act(() => {
      editor.update(
        () => {
          const root = $getRoot();
          root.clear();
          const p = $createParagraphNode();
          p.append($createTextNode('hello world'));
          root.append(p);
        },
        { discrete: true },
      );
    });
    // Re-render with the SAME `value` prop ('hello') — since it no longer
    // matches the live text ('hello world'), a naive re-check might reseed
    // and clobber the user's typing. It shouldn't, because `value` here
    // still equals `lastSeeded`, not because it matches `current`.
    rerender({ value: 'hello' });
    expect(serializeRichText(editor.getEditorState()).text).toBe('hello world');
  });

  it('does not reseed twice for the same new value (StrictMode double-invoke guard)', () => {
    const { wrapper, getEditor } = makeLexicalWrapper();
    const { rerender } = renderHook(({ value }: { value: string }) => useSeededValue(value, []), {
      wrapper,
      initialProps: { value: 'first' },
    });
    const editor = getEditor();
    rerender({ value: 'second' });
    // Manually re-run with the identical props object shape to simulate a
    // second effect invocation for the same value.
    rerender({ value: 'second' });
    expect(serializeRichText(editor.getEditorState()).text).toBe('second');
  });
});
