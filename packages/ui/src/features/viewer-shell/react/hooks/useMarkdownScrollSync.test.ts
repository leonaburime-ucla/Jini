import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createRef } from 'react';
import { useMarkdownScrollSync } from './useMarkdownScrollSync.js';

function defineLayout(el: HTMLElement, layout: { scrollHeight: number; clientHeight: number; clientWidth?: number }) {
  Object.defineProperty(el, 'scrollHeight', { value: layout.scrollHeight, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: layout.clientHeight, configurable: true });
  Object.defineProperty(el, 'clientWidth', { value: layout.clientWidth ?? 400, configurable: true });
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

describe('useMarkdownScrollSync', () => {
  it('is a no-op outside split mode', async () => {
    const editorRef = createRef<HTMLTextAreaElement>();
    const previewRef = createRef<HTMLElement>();
    (editorRef as { current: HTMLTextAreaElement }).current = document.createElement('textarea');
    (previewRef as { current: HTMLElement }).current = document.createElement('div');
    defineLayout(editorRef.current!, { scrollHeight: 400, clientHeight: 100 });
    defineLayout(previewRef.current!, { scrollHeight: 800, clientHeight: 100 });
    editorRef.current!.scrollTop = 100;

    const { result } = renderHook(() =>
      useMarkdownScrollSync({ mode: 'preview', sourceText: 'hello', editorRef, previewRef }),
    );

    act(() => {
      result.current.handleEditorScroll();
    });
    await nextFrame();
    // Preview scrollTop untouched — sync only runs in 'split' mode.
    expect(previewRef.current!.scrollTop).toBe(0);
  });

  it('ratio-syncs the preview pane when the editor scrolls in split mode', async () => {
    const editorRef = createRef<HTMLTextAreaElement>();
    const previewRef = createRef<HTMLElement>();
    (editorRef as { current: HTMLTextAreaElement }).current = document.createElement('textarea');
    (previewRef as { current: HTMLElement }).current = document.createElement('div');
    document.body.appendChild(editorRef.current!);
    document.body.appendChild(previewRef.current!);
    defineLayout(editorRef.current!, { scrollHeight: 400, clientHeight: 100 }); // range 300
    defineLayout(previewRef.current!, { scrollHeight: 800, clientHeight: 100 }); // range 700
    editorRef.current!.scrollTop = 150; // ratio 0.5

    const { result } = renderHook(() =>
      useMarkdownScrollSync({ mode: 'split', sourceText: '', editorRef, previewRef }),
    );

    act(() => {
      result.current.activatePane('editor');
      result.current.handleEditorScroll();
    });
    await nextFrame();

    // No markdown blocks (empty sourceText) -> falls back to ratio sync:
    // target.scrollTop = 0.5 * 700 = 350.
    expect(previewRef.current!.scrollTop).toBe(350);

    document.body.removeChild(editorRef.current!);
    document.body.removeChild(previewRef.current!);
  });

  it('handlePreviewScroll ignores scroll events when the preview is not the active pane', async () => {
    const editorRef = createRef<HTMLTextAreaElement>();
    const previewRef = createRef<HTMLElement>();
    (editorRef as { current: HTMLTextAreaElement }).current = document.createElement('textarea');
    (previewRef as { current: HTMLElement }).current = document.createElement('div');
    defineLayout(editorRef.current!, { scrollHeight: 400, clientHeight: 100 });
    defineLayout(previewRef.current!, { scrollHeight: 800, clientHeight: 100 });
    previewRef.current!.scrollTop = 200;

    const { result } = renderHook(() =>
      useMarkdownScrollSync({ mode: 'split', sourceText: '', editorRef, previewRef }),
    );

    act(() => {
      // activePane defaults to 'editor', so a preview scroll should be ignored.
      result.current.handlePreviewScroll();
    });
    await nextFrame();
    expect(editorRef.current!.scrollTop).toBe(0);
  });

  it('activatePane switches which side counts as the scroll source', () => {
    const editorRef = createRef<HTMLTextAreaElement>();
    const previewRef = createRef<HTMLElement>();
    (editorRef as { current: HTMLTextAreaElement }).current = document.createElement('textarea');
    (previewRef as { current: HTMLElement }).current = document.createElement('div');

    const { result } = renderHook(() =>
      useMarkdownScrollSync({ mode: 'split', sourceText: '', editorRef, previewRef }),
    );

    expect(() => {
      act(() => {
        result.current.activatePane('preview');
      });
    }).not.toThrow();
  });
});
