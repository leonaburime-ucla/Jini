import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useAnnotationCanvas } from './useAnnotationCanvas.js';
import { createFakeAnnotationCanvasPort } from '../../dependencies.js';
import type { AnnotationSubmitDetail } from '../../types.js';

function fakePointerEvent(overrides: Partial<ReactPointerEvent> = {}): ReactPointerEvent {
  return {
    preventDefault: () => {},
    stopPropagation: () => {},
    target: { setPointerCapture: undefined },
    currentTarget: { setPointerCapture: undefined, releasePointerCapture: undefined, style: {} },
    pointerId: 1,
    clientX: 0,
    clientY: 0,
    timeStamp: 0,
    ...overrides,
  } as unknown as ReactPointerEvent;
}

describe('useAnnotationCanvas', () => {
  it('defaults to the box mark tool and the send submit action', () => {
    const { result } = renderHook(() => useAnnotationCanvas({ active: true, port: createFakeAnnotationCanvasPort() }));
    expect(result.current.markTool).toBe('box');
    expect(result.current.submitAction).toBe('send');
    expect(result.current.markToolOptions.map((o) => o.tool)).toEqual(['box', 'pen', 'text']);
  });

  it('selectMarkTool switches tools, fires onToolbarClick, and closes the tool menu', () => {
    const onToolbarClick = vi.fn();
    const { result } = renderHook(() => useAnnotationCanvas({ active: true, onToolbarClick, port: createFakeAnnotationCanvasPort() }));
    act(() => result.current.setMarkToolMenuOpen(true));
    act(() => result.current.selectMarkTool('pen'));
    expect(result.current.markTool).toBe('pen');
    expect(result.current.markToolMenuOpen).toBe(false);
    expect(onToolbarClick).toHaveBeenCalledWith('pen');
  });

  it('commits a freehand stroke on pointer down/move/up and undo/redo it', () => {
    const onToolbarClick = vi.fn();
    const { result } = renderHook(() => useAnnotationCanvas({ active: true, onToolbarClick, port: createFakeAnnotationCanvasPort() }));
    act(() => result.current.selectMarkTool('pen'));
    act(() => result.current.onPointerDown(fakePointerEvent()));
    act(() => result.current.onPointerMove(fakePointerEvent({ clientX: 5, clientY: 5 })));
    act(() => result.current.onPointerUp(fakePointerEvent()));
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undoStroke());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
    expect(onToolbarClick).toHaveBeenCalledWith('undo');

    act(() => result.current.redoStroke());
    expect(result.current.canUndo).toBe(true);
    expect(onToolbarClick).toHaveBeenCalledWith('redo');
  });

  it('does not commit a single-point stroke (a click without drag)', () => {
    const { result } = renderHook(() => useAnnotationCanvas({ active: true, port: createFakeAnnotationCanvasPort() }));
    act(() => result.current.selectMarkTool('pen'));
    act(() => result.current.onPointerDown(fakePointerEvent()));
    act(() => result.current.onPointerUp(fakePointerEvent()));
    expect(result.current.canUndo).toBe(false);
  });

  it('Escape closes the overlay while active', () => {
    const onActiveChange = vi.fn();
    renderHook(() => useAnnotationCanvas({ active: true, onActiveChange, port: createFakeAnnotationCanvasPort() }));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onActiveChange).toHaveBeenCalledWith(false);
  });

  it('does not respond to keyboard shortcuts while inactive', () => {
    const onActiveChange = vi.fn();
    renderHook(() => useAnnotationCanvas({ active: false, onActiveChange, port: createFakeAnnotationCanvasPort() }));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onActiveChange).not.toHaveBeenCalled();
  });

  it('Cmd+Z undoes and Shift+Cmd+Z redoes', () => {
    const { result } = renderHook(() => useAnnotationCanvas({ active: true, port: createFakeAnnotationCanvasPort() }));
    act(() => result.current.selectMarkTool('pen'));
    act(() => result.current.onPointerDown(fakePointerEvent()));
    act(() => result.current.onPointerMove(fakePointerEvent({ clientX: 5, clientY: 5 })));
    act(() => result.current.onPointerUp(fakePointerEvent()));
    expect(result.current.canUndo).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true }));
    });
    expect(result.current.canUndo).toBe(false);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, shiftKey: true }));
    });
    expect(result.current.canUndo).toBe(true);
  });

  it('Ctrl+Z (non-Mac) also undoes', () => {
    const { result } = renderHook(() => useAnnotationCanvas({ active: true, port: createFakeAnnotationCanvasPort() }));
    act(() => result.current.selectMarkTool('pen'));
    act(() => result.current.onPointerDown(fakePointerEvent()));
    act(() => result.current.onPointerMove(fakePointerEvent({ clientX: 5, clientY: 5 })));
    act(() => result.current.onPointerUp(fakePointerEvent()));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Z', ctrlKey: true }));
    });
    expect(result.current.canUndo).toBe(false);
  });

  it('Enter in the note input submits as queue (submit-action picker gap #2)', async () => {
    const onSubmit = vi.fn(async (detail: AnnotationSubmitDetail) => ({ ok: true }));
    const { result } = renderHook(() => useAnnotationCanvas({ active: true, port: createFakeAnnotationCanvasPort({ onSubmit }) }));
    act(() => result.current.setNote('a note'));
    await act(async () => {
      result.current.onNoteKeyDown({ key: 'Enter' } as never);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ action: 'queue', note: 'a note' }));
  });

  it('Enter does not submit while an IME composition is active', () => {
    const onSubmit = vi.fn(async () => ({ ok: true }));
    const { result } = renderHook(() => useAnnotationCanvas({ active: true, port: createFakeAnnotationCanvasPort({ onSubmit }) }));
    act(() => result.current.setNote('a note'));
    act(() => result.current.onCompositionStart());
    act(() => result.current.onNoteKeyDown({ key: 'Enter' } as never));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('the submit-action picker (send/draft/queue) exists and drives which action send() submits', async () => {
    const onSubmit = vi.fn(async () => ({ ok: true }));
    const { result } = renderHook(() => useAnnotationCanvas({ active: true, port: createFakeAnnotationCanvasPort({ onSubmit }) }));
    expect(result.current.submitOptions.map((o) => o.action)).toEqual(['send', 'draft', 'queue']);

    act(() => result.current.setNote('note'));
    act(() => result.current.chooseSubmitAction('draft'));
    expect(result.current.submitAction).toBe('draft');
    expect(result.current.submitMenuOpen).toBe(false);
    await act(async () => {
      await Promise.resolve();
    });
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ action: 'draft' }));
  });

  it('gates only the send option when sendDisabled is set', () => {
    const { result } = renderHook(() => useAnnotationCanvas({ active: true, sendDisabled: true, port: createFakeAnnotationCanvasPort() }));
    const send = result.current.submitOptions.find((o) => o.action === 'send')!;
    const queue = result.current.submitOptions.find((o) => o.action === 'queue')!;
    expect(send.enabled).toBe(false);
    expect(queue.enabled).toBe(false); // nothing to submit yet either
    act(() => result.current.setNote('hi'));
  });

  it('send() resolves ok:false from the port and reports it via captureWarning', async () => {
    const onSubmit = vi.fn(async () => ({ ok: false, message: 'boom' }));
    const { result } = renderHook(() => useAnnotationCanvas({ active: true, port: createFakeAnnotationCanvasPort({ onSubmit }) }));
    act(() => result.current.setNote('hi'));
    await act(async () => {
      await result.current.send('send');
    });
    expect(result.current.captureWarning).toEqual({ action: 'send', message: 'boom' });
  });

  it('clears the note and attachments after a successful send', async () => {
    const { result } = renderHook(() => useAnnotationCanvas({ active: true, port: createFakeAnnotationCanvasPort() }));
    act(() => result.current.setNote('hi'));
    await act(async () => {
      await result.current.send('send');
    });
    expect(result.current.note).toBe('');
  });

  it('does not submit send() while sendDisabled and action is send', async () => {
    const onSubmit = vi.fn(async () => ({ ok: true }));
    const { result } = renderHook(() => useAnnotationCanvas({ active: true, sendDisabled: true, port: createFakeAnnotationCanvasPort({ onSubmit }) }));
    act(() => result.current.setNote('hi'));
    await act(async () => {
      await result.current.send('send');
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('text tool: pointer down drops a new editable label; blur removes it if empty', () => {
    const { result } = renderHook(() => useAnnotationCanvas({ active: true, port: createFakeAnnotationCanvasPort() }));
    act(() => result.current.selectMarkTool('text'));
    act(() => result.current.onPointerDown(fakePointerEvent()));
    expect(result.current.textMarks).toHaveLength(1);
    const id = result.current.textMarks[0]!.id;
    expect(result.current.textMarks[0]!.editing).toBe(true);

    act(() => result.current.updateTextMark(id, 'hello'));
    expect(result.current.textMarks[0]!.text).toBe('hello');

    act(() => result.current.handleTextBlur(id));
    expect(result.current.textMarks).toHaveLength(1); // has text, stays

    act(() => result.current.selectMarkTool('text'));
    act(() => result.current.onPointerDown(fakePointerEvent()));
    const secondId = result.current.textMarks[1]!.id;
    act(() => result.current.handleTextBlur(secondId));
    expect(result.current.textMarks).toHaveLength(1); // empty label dropped on blur
  });

  it('removeTextMark removes a label directly', () => {
    const { result } = renderHook(() => useAnnotationCanvas({ active: true, port: createFakeAnnotationCanvasPort() }));
    act(() => result.current.selectMarkTool('text'));
    act(() => result.current.onPointerDown(fakePointerEvent()));
    const id = result.current.textMarks[0]!.id;
    act(() => result.current.removeTextMark(id));
    expect(result.current.textMarks).toHaveLength(0);
  });

  it('addExtraFiles only accepts image files', () => {
    const { result } = renderHook(() => useAnnotationCanvas({ active: true, port: createFakeAnnotationCanvasPort() }));
    const image = new File(['x'], 'a.png', { type: 'image/png' });
    const text = new File(['x'], 'a.txt', { type: 'text/plain' });
    act(() => result.current.addExtraFiles([image, text]));
    expect(result.current.extraFiles).toEqual([image]);
  });

  it('resets all drawing state when deactivated', () => {
    const { result, rerender } = renderHook(({ active }) => useAnnotationCanvas({ active, port: createFakeAnnotationCanvasPort() }), {
      initialProps: { active: true },
    });
    act(() => result.current.selectMarkTool('pen'));
    act(() => result.current.onPointerDown(fakePointerEvent()));
    act(() => result.current.onPointerMove(fakePointerEvent({ clientX: 5, clientY: 5 })));
    act(() => result.current.onPointerUp(fakePointerEvent()));
    expect(result.current.canUndo).toBe(true);

    rerender({ active: false });
    expect(result.current.canUndo).toBe(false);
  });
});
