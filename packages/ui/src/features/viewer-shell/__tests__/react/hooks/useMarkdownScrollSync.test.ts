import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createRef } from 'react';
import { useMarkdownScrollSync } from '../../../react/hooks/useMarkdownScrollSync.js';

function defineLayout(el: HTMLElement, layout: { scrollHeight: number; clientHeight: number; clientWidth?: number }) {
  Object.defineProperty(el, 'scrollHeight', { value: layout.scrollHeight, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: layout.clientHeight, configurable: true });
  Object.defineProperty(el, 'clientWidth', { value: layout.clientWidth ?? 400, configurable: true });
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function oneFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
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

  it('cancels a still-pending scroll-sync animation frame when mode leaves split before it fires', () => {
    const editorRef = createRef<HTMLTextAreaElement>();
    const previewRef = createRef<HTMLElement>();
    (editorRef as { current: HTMLTextAreaElement }).current = document.createElement('textarea');
    (previewRef as { current: HTMLElement }).current = document.createElement('div');
    defineLayout(editorRef.current!, { scrollHeight: 400, clientHeight: 100 });
    defineLayout(previewRef.current!, { scrollHeight: 800, clientHeight: 100 });
    editorRef.current!.scrollTop = 100;

    const { result, rerender } = renderHook(
      ({ mode }: { mode: 'split' | 'preview' }) => useMarkdownScrollSync({ mode, sourceText: '', editorRef, previewRef }),
      { initialProps: { mode: 'split' } },
    );

    act(() => {
      result.current.activatePane('editor');
      result.current.handleEditorScroll();
    });
    // A scroll-sync frame is now pending (never awaited). Leaving split mode
    // before it fires must cancel it via the mode-effect's cleanup branch.
    expect(() => {
      act(() => {
        rerender({ mode: 'preview' });
      });
    }).not.toThrow();
    expect(previewRef.current!.scrollTop).toBe(0);
  });

  it('cancels a still-pending programmatic-scroll-clear animation frame when mode leaves split', async () => {
    const editorRef = createRef<HTMLTextAreaElement>();
    const previewRef = createRef<HTMLElement>();
    (editorRef as { current: HTMLTextAreaElement }).current = document.createElement('textarea');
    (previewRef as { current: HTMLElement }).current = document.createElement('div');
    document.body.appendChild(editorRef.current!);
    document.body.appendChild(previewRef.current!);
    defineLayout(editorRef.current!, { scrollHeight: 400, clientHeight: 100 });
    defineLayout(previewRef.current!, { scrollHeight: 800, clientHeight: 100 });
    editorRef.current!.scrollTop = 150;

    const { result, rerender } = renderHook(
      ({ mode }: { mode: 'split' | 'preview' }) => useMarkdownScrollSync({ mode, sourceText: '', editorRef, previewRef }),
      { initialProps: { mode: 'split' } },
    );

    act(() => {
      result.current.activatePane('editor');
      result.current.handleEditorScroll();
    });
    // Let exactly the first scheduled frame fire: applyScrollSync runs,
    // writes previewRef's scrollTop, and arms its own (still-pending)
    // clear-programmatic-scroll frame via clearProgrammaticScrollSoon.
    await act(async () => {
      await oneFrame();
    });
    expect(previewRef.current!.scrollTop).toBe(350);

    // Leaving split mode now must cancel that still-pending clear frame too.
    expect(() => {
      act(() => {
        rerender({ mode: 'preview' });
      });
    }).not.toThrow();

    document.body.removeChild(editorRef.current!);
    document.body.removeChild(previewRef.current!);
  });

  it('ignores a scroll event that matches its own just-applied programmatic scroll (the self-triggered echo)', async () => {
    const editorRef = createRef<HTMLTextAreaElement>();
    const previewRef = createRef<HTMLElement>();
    (editorRef as { current: HTMLTextAreaElement }).current = document.createElement('textarea');
    (previewRef as { current: HTMLElement }).current = document.createElement('div');
    document.body.appendChild(editorRef.current!);
    document.body.appendChild(previewRef.current!);
    defineLayout(editorRef.current!, { scrollHeight: 400, clientHeight: 100 });
    defineLayout(previewRef.current!, { scrollHeight: 800, clientHeight: 100 });
    editorRef.current!.scrollTop = 150;

    const { result } = renderHook(() => useMarkdownScrollSync({ mode: 'split', sourceText: '', editorRef, previewRef }));

    act(() => {
      result.current.activatePane('editor');
      result.current.handleEditorScroll();
    });
    await act(async () => {
      await oneFrame();
    });
    // previewRef.scrollTop is now 350, set programmatically; programmaticScrollRef
    // still records {pane:'preview', top:350} (its own clear-frame hasn't landed yet).
    expect(previewRef.current!.scrollTop).toBe(350);

    // Simulate the native 'scroll' event this assignment itself triggers in a
    // real browser: same pane, same scrollTop as recorded -> must be swallowed
    // (shouldIgnoreScroll's "was our own echo" branch), not scheduled again.
    act(() => {
      result.current.handlePreviewScroll();
    });
    await nextFrame();
    // Editor untouched: the echo was ignored, no preview->editor sync ran.
    expect(editorRef.current!.scrollTop).toBe(150);

    document.body.removeChild(editorRef.current!);
    document.body.removeChild(previewRef.current!);
  });

  it('does not ignore a genuine user scroll on the active pane even while a programmatic record is still pending', async () => {
    const editorRef = createRef<HTMLTextAreaElement>();
    const previewRef = createRef<HTMLElement>();
    (editorRef as { current: HTMLTextAreaElement }).current = document.createElement('textarea');
    (previewRef as { current: HTMLElement }).current = document.createElement('div');
    document.body.appendChild(editorRef.current!);
    document.body.appendChild(previewRef.current!);
    defineLayout(editorRef.current!, { scrollHeight: 400, clientHeight: 100 });
    defineLayout(previewRef.current!, { scrollHeight: 800, clientHeight: 100 });
    editorRef.current!.scrollTop = 150;

    const { result } = renderHook(() => useMarkdownScrollSync({ mode: 'split', sourceText: '', editorRef, previewRef }));

    act(() => {
      result.current.activatePane('editor');
      result.current.handleEditorScroll();
    });
    await act(async () => {
      await oneFrame();
    });
    expect(previewRef.current!.scrollTop).toBe(350);

    // The user grabs the preview pane's own scrollbar right as the
    // programmatic sync lands, moving it well past the recorded top (350)
    // while the preview is the active pane -> a real scroll, must not be
    // swallowed, and must itself schedule a preview->editor sync.
    act(() => {
      result.current.activatePane('preview');
      previewRef.current!.scrollTop = 500;
      result.current.handlePreviewScroll();
    });
    await nextFrame();
    // range 300, ratio 500/700 ≈ 0.714 -> ~214.29
    expect(editorRef.current!.scrollTop).toBeCloseTo(214.28571428571428, 5);

    document.body.removeChild(editorRef.current!);
    document.body.removeChild(previewRef.current!);
  });

  it('uses block-anchored offsets end-to-end for a single-block document, including the offset cache on a second scroll', async () => {
    const editorRef = createRef<HTMLTextAreaElement>();
    const previewRef = createRef<HTMLElement>();
    (editorRef as { current: HTMLTextAreaElement }).current = document.createElement('textarea');
    (previewRef as { current: HTMLElement }).current = document.createElement('div');
    previewRef.current!.innerHTML = '<article class="markdown-rendered"><p>hello</p></article>';
    document.body.appendChild(editorRef.current!);
    document.body.appendChild(previewRef.current!);
    defineLayout(editorRef.current!, { scrollHeight: 400, clientHeight: 100 });
    defineLayout(previewRef.current!, { scrollHeight: 800, clientHeight: 100 });
    editorRef.current!.scrollTop = 150;

    const { result } = renderHook(() => useMarkdownScrollSync({ mode: 'split', sourceText: 'hello', editorRef, previewRef }));

    act(() => {
      result.current.activatePane('editor');
      result.current.handleEditorScroll();
    });
    await act(async () => {
      await oneFrame();
    });
    // A single top-level block trivially "has vertical progression" even
    // under jsdom's zeroed layout, so getEditorBlockOffsets/
    // measurePreviewBlockOffsets both return real (non-null) `[0]` arrays and
    // the block-anchored branch of computeSplitPaneScrollTarget runs: with
    // both anchor sets [0, 0, scrollHeight], scrollTop 150/400 of the way
    // through the editor's post-block segment maps to the same 0..1
    // position of the preview's post-block segment: 150/400 * 800 = 300.
    expect(previewRef.current!.scrollTop).toBe(300);

    // A second scroll at the same textarea width must hit the cached-offsets
    // branch in getEditorBlockOffsets instead of re-measuring (asserted
    // indirectly: this only re-measures the preview side, and the result
    // below is only reachable if the editor side reused its [0] cache
    // rather than re-deriving from a mirror DOM measurement).
    editorRef.current!.scrollTop = 200;
    act(() => {
      result.current.handleEditorScroll();
    });
    await act(async () => {
      await oneFrame();
    });
    // previewOffsets is re-measured fresh each call via
    // `measurePreviewBlockOffsets`, which under jsdom's always-zero
    // `getBoundingClientRect` derives the block offset from the pane's
    // *current* scrollTop (300, from the first sync above): offset = 0 -
    // (paneRect.top(0) - pane.scrollTop(300)) = 300. So targetAnchors are
    // now [0, 300, 800] against unchanged sourceAnchors [0, 0, 400]: mapping
    // 200 gives fraction 0.5 across the [0,400]->[300,800] segment = 550.
    expect(previewRef.current!.scrollTop).toBe(550);

    document.body.removeChild(editorRef.current!);
    document.body.removeChild(previewRef.current!);
  });

  it('falls back to ratio sync when the editor mirror measurement has no vertical progression (multi-block, zero-layout jsdom)', async () => {
    const editorRef = createRef<HTMLTextAreaElement>();
    const previewRef = createRef<HTMLElement>();
    (editorRef as { current: HTMLTextAreaElement }).current = document.createElement('textarea');
    (previewRef as { current: HTMLElement }).current = document.createElement('div');
    document.body.appendChild(editorRef.current!);
    document.body.appendChild(previewRef.current!);
    defineLayout(editorRef.current!, { scrollHeight: 400, clientHeight: 100 });
    defineLayout(previewRef.current!, { scrollHeight: 800, clientHeight: 100 });
    editorRef.current!.scrollTop = 150; // ratio 0.5

    const { result } = renderHook(() =>
      useMarkdownScrollSync({ mode: 'split', sourceText: 'first\n\nsecond', editorRef, previewRef }),
    );

    act(() => {
      result.current.activatePane('editor');
      result.current.handleEditorScroll();
    });
    await act(async () => {
      await oneFrame();
    });
    // Two top-level blocks, but jsdom never lays anything out so every
    // measured offset is 0 -> hasVerticalProgression is false ->
    // measureEditorBlockOffsets returns null -> ratio-sync fallback: 0.5 * 700 = 350.
    expect(previewRef.current!.scrollTop).toBe(350);

    document.body.removeChild(editorRef.current!);
    document.body.removeChild(previewRef.current!);
  });

  it('applyScrollSync is a no-op if the source or target ref goes null before its scheduled frame fires', async () => {
    const editorRef = createRef<HTMLTextAreaElement>();
    const previewRef = createRef<HTMLElement>();
    (editorRef as { current: HTMLTextAreaElement }).current = document.createElement('textarea');
    (previewRef as { current: HTMLElement }).current = document.createElement('div');
    defineLayout(editorRef.current!, { scrollHeight: 400, clientHeight: 100 });
    defineLayout(previewRef.current!, { scrollHeight: 800, clientHeight: 100 });
    editorRef.current!.scrollTop = 150;

    const { result, unmount } = renderHook(() => useMarkdownScrollSync({ mode: 'split', sourceText: '', editorRef, previewRef }));

    act(() => {
      result.current.activatePane('editor');
      result.current.handleEditorScroll();
    });
    // The target ref goes null (e.g. the preview pane unmounts) before the
    // scheduled frame runs; applyScrollSync must bail out without throwing
    // or touching anything.
    (previewRef as { current: HTMLElement | null }).current = null;
    await act(async () => {
      await oneFrame();
    });
    unmount();
  });

  it('handleEditorScroll is a no-op once the editor ref goes null', () => {
    const editorRef = createRef<HTMLTextAreaElement>();
    const previewRef = createRef<HTMLElement>();
    (previewRef as { current: HTMLElement }).current = document.createElement('div');
    defineLayout(previewRef.current!, { scrollHeight: 800, clientHeight: 100 });

    const { result } = renderHook(() => useMarkdownScrollSync({ mode: 'split', sourceText: '', editorRef, previewRef }));

    expect(() => {
      act(() => {
        result.current.handleEditorScroll();
      });
    }).not.toThrow();
    expect(previewRef.current!.scrollTop).toBe(0);
  });

  it('a redundant sync that lands within 1px of the already-applied position is a no-op', async () => {
    const editorRef = createRef<HTMLTextAreaElement>();
    const previewRef = createRef<HTMLElement>();
    (editorRef as { current: HTMLTextAreaElement }).current = document.createElement('textarea');
    (previewRef as { current: HTMLElement }).current = document.createElement('div');
    document.body.appendChild(editorRef.current!);
    document.body.appendChild(previewRef.current!);
    defineLayout(editorRef.current!, { scrollHeight: 400, clientHeight: 100 });
    defineLayout(previewRef.current!, { scrollHeight: 800, clientHeight: 100 });
    editorRef.current!.scrollTop = 150;

    const { result } = renderHook(() => useMarkdownScrollSync({ mode: 'split', sourceText: '', editorRef, previewRef }));

    act(() => {
      result.current.activatePane('editor');
      result.current.handleEditorScroll();
    });
    await act(async () => {
      await oneFrame();
    });
    expect(previewRef.current!.scrollTop).toBe(350);

    // Same editor scrollTop again -> recomputed targetTop is identical (350)
    // -> already within 1px of the current preview scrollTop -> no-op,
    // covers the early-return branch instead of reassigning scrollTop.
    act(() => {
      result.current.handleEditorScroll();
    });
    await act(async () => {
      await oneFrame();
    });
    expect(previewRef.current!.scrollTop).toBe(350);

    document.body.removeChild(editorRef.current!);
    document.body.removeChild(previewRef.current!);
  });

  it('uses the preview pane as the sync source when it was the last active pane before mode enters split', async () => {
    const editorRef = createRef<HTMLTextAreaElement>();
    const previewRef = createRef<HTMLElement>();
    (editorRef as { current: HTMLTextAreaElement }).current = document.createElement('textarea');
    (previewRef as { current: HTMLElement }).current = document.createElement('div');
    document.body.appendChild(editorRef.current!);
    document.body.appendChild(previewRef.current!);
    defineLayout(editorRef.current!, { scrollHeight: 400, clientHeight: 100 });
    defineLayout(previewRef.current!, { scrollHeight: 800, clientHeight: 100 });
    previewRef.current!.scrollTop = 350; // ratio 0.5

    const { result, rerender } = renderHook(
      ({ mode }: { mode: 'preview' | 'split' }) => useMarkdownScrollSync({ mode, sourceText: '', editorRef, previewRef }),
      { initialProps: { mode: 'preview' } },
    );

    act(() => {
      result.current.activatePane('preview');
    });
    // Entering split mode re-triggers the mode-effect, which reads
    // activePaneRef.current ('preview', set above) as sourcePane and
    // schedules a preview->editor sync (targetPane 'editor').
    act(() => {
      rerender({ mode: 'split' });
    });
    await act(async () => {
      await oneFrame();
    });
    // range(editor) = 300, ratio 0.5 -> 150
    expect(editorRef.current!.scrollTop).toBe(150);

    document.body.removeChild(editorRef.current!);
    document.body.removeChild(previewRef.current!);
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
