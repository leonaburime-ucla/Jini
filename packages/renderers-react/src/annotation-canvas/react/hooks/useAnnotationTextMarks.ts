import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { clamp01, textMarksBounds } from '../../rules.js';
import { ANNOTATION_DOUBLE_TAP_MS } from '../../constants.js';
import type { AnnotationPoint, AnnotationRect, AnnotationTextMark } from '../../types.js';

export interface AnnotationTextMarksController {
  textMarks: AnnotationTextMark[];
  hasText: boolean;
  editingTextId: number | null;
  /** Drops a new (empty, immediately-editing) label at a canvas-normalized point. */
  addLabelAt: (point: AnnotationPoint) => void;
  updateText: (id: number, text: string) => void;
  removeMark: (id: number) => void;
  onBlur: (id: number) => void;
  onTextareaEscape: (id: number) => void;
  registerTextareaRef: (id: number, el: HTMLTextAreaElement | null) => void;
  onTextPointerDown: (e: ReactPointerEvent, mark: AnnotationTextMark) => void;
  onTextPointerMove: (e: ReactPointerEvent, mark: AnnotationTextMark) => void;
  onTextPointerUp: (e: ReactPointerEvent, mark: AnnotationTextMark) => void;
  clear: () => void;
  /** The union of every non-empty label's rendered bounds, in canvas-local pixels. */
  boundsRect: () => AnnotationRect | null;
}

export interface UseAnnotationTextMarksParams {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** The annotated surface's untransformed layout size — labels re-fit
   *  their font size (a fraction of frame height) when this changes. */
  frameSize: { w: number; h: number };
}

/**
 * Owns the free-floating draggable text-label tool: placing a label,
 * editing it (autosize-to-fit textarea), dragging it to reposition, and
 * double-tap/double-click to re-open an already-placed label for editing.
 */
export function useAnnotationTextMarks(params: UseAnnotationTextMarksParams): AnnotationTextMarksController {
  const { canvasRef, frameSize } = params;
  const [textMarks, setTextMarks] = useState<AnnotationTextMark[]>([]);
  const textMarksRef = useRef<AnnotationTextMark[]>([]);
  const textIdRef = useRef(0);
  const [editingTextId, setEditingTextId] = useState<number | null>(null);
  const textAreaRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map());
  const textDragRef = useRef<{
    id: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    curX: number;
    curY: number;
    moved: boolean;
  } | null>(null);
  const lastTextTapRef = useRef<{ id: number; time: number } | null>(null);

  const hasText = textMarks.some((mark) => mark.text.trim().length > 0);

  const commitTextMarks = useCallback((next: AnnotationTextMark[]) => {
    textMarksRef.current = next;
    setTextMarks(next);
  }, []);

  const addLabelAt = useCallback(
    (point: AnnotationPoint) => {
      const id = (textIdRef.current += 1);
      commitTextMarks([...textMarksRef.current, { id, x: point.x, y: point.y, text: '' }]);
      setEditingTextId(id);
    },
    [commitTextMarks],
  );

  const updateText = useCallback(
    (id: number, text: string) => {
      commitTextMarks(textMarksRef.current.map((mark) => (mark.id === id ? { ...mark, text } : mark)));
    },
    [commitTextMarks],
  );

  const removeMark = useCallback(
    (id: number) => {
      textAreaRefs.current.delete(id);
      commitTextMarks(textMarksRef.current.filter((mark) => mark.id !== id));
    },
    [commitTextMarks],
  );

  // Leaving edit mode drops a label that was never typed into, so it
  // doesn't linger as an invisible target.
  const onBlur = useCallback(
    (id: number) => {
      setEditingTextId((cur) => (cur === id ? null : cur));
      const mark = textMarksRef.current.find((item) => item.id === id);
      if (mark && mark.text.trim() === '') removeMark(id);
    },
    [removeMark],
  );

  const onTextareaEscape = useCallback((id: number) => {
    textAreaRefs.current.get(id)?.blur();
  }, []);

  const registerTextareaRef = useCallback((id: number, el: HTMLTextAreaElement | null) => {
    if (el) {
      textAreaRefs.current.set(id, el);
      autosizeTextArea(el);
    } else {
      textAreaRefs.current.delete(id);
    }
  }, []);

  // Focus the label being edited (caret at end) once it has rendered.
  useEffect(() => {
    if (editingTextId === null) return;
    const el = textAreaRefs.current.get(editingTextId);
    if (el) {
      el.focus();
      const end = el.value.length;
      el.setSelectionRange(end, end);
    }
  }, [editingTextId, textMarks]);

  // The glyph size is a fraction of the frame height, so a frame resize
  // (e.g. the annotated surface changing size) must re-fit every label to
  // the new font size.
  useEffect(() => {
    textAreaRefs.current.forEach((el) => autosizeTextArea(el));
  }, [frameSize, textMarks]);

  const onTextPointerDown = useCallback((e: ReactPointerEvent, mark: AnnotationTextMark) => {
    if (editingTextId === mark.id) return; // editing: let the textarea handle it
    e.preventDefault();
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    textDragRef.current = {
      id: mark.id,
      startX: (e.clientX - rect.left) / rect.width,
      startY: (e.clientY - rect.top) / rect.height,
      originX: mark.x,
      originY: mark.y,
      curX: mark.x,
      curY: mark.y,
      moved: false,
    };
  }, [canvasRef, editingTextId]);

  // Move the label live by writing its wrapper style directly (no
  // per-frame React re-render); the final position commits to state on
  // pointer up.
  const onTextPointerMove = useCallback((e: ReactPointerEvent, mark: AnnotationTextMark) => {
    const drag = textDragRef.current;
    if (!drag || drag.id !== mark.id) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    const nx = clamp01(drag.originX + ((e.clientX - rect.left) / rect.width - drag.startX));
    const ny = clamp01(drag.originY + ((e.clientY - rect.top) / rect.height - drag.startY));
    drag.curX = nx;
    drag.curY = ny;
    if (Math.abs(nx - drag.originX) > 0.002 || Math.abs(ny - drag.originY) > 0.002) drag.moved = true;
    const el = e.currentTarget as HTMLElement;
    el.style.left = `${nx * 100}%`;
    el.style.top = `${ny * 100}%`;
  }, [canvasRef]);

  const onTextPointerUp = useCallback(
    (e: ReactPointerEvent, mark: AnnotationTextMark) => {
      const drag = textDragRef.current;
      if (!drag || drag.id !== mark.id) return;
      (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
      textDragRef.current = null;
      if (drag.moved) {
        commitTextMarks(
          textMarksRef.current.map((item) => (item.id === mark.id ? { ...item, x: drag.curX, y: drag.curY } : item)),
        );
        lastTextTapRef.current = null;
        return;
      }
      // A tap that didn't move: a second tap on the same label within the
      // window re-opens it for editing (mouse double-click or touch).
      const prev = lastTextTapRef.current;
      if (prev && prev.id === mark.id && e.timeStamp - prev.time < ANNOTATION_DOUBLE_TAP_MS) {
        lastTextTapRef.current = null;
        setEditingTextId(mark.id);
      } else {
        lastTextTapRef.current = { id: mark.id, time: e.timeStamp };
      }
    },
    [commitTextMarks],
  );

  const clear = useCallback(() => {
    textAreaRefs.current.clear();
    textDragRef.current = null;
    lastTextTapRef.current = null;
    setEditingTextId(null);
    commitTextMarks([]);
  }, [commitTextMarks]);

  const boundsRect = useCallback((): AnnotationRect | null => {
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return null;
    return textMarksBounds(textMarksRef.current, canvasRect, (id) => {
      const el = textAreaRefs.current.get(id);
      if (!el) return null;
      const box = el.getBoundingClientRect();
      return { left: box.left - canvasRect.left, top: box.top - canvasRect.top, right: box.right - canvasRect.left, bottom: box.bottom - canvasRect.top };
    });
  }, [canvasRef]);

  return {
    textMarks,
    hasText,
    editingTextId,
    addLabelAt,
    updateText,
    removeMark,
    onBlur,
    onTextareaEscape,
    registerTextareaRef,
    onTextPointerDown,
    onTextPointerMove,
    onTextPointerUp,
    clear,
    boundsRect,
  };
}

// Grow a label textarea to exactly fit its text in both axes. `wrap="off"`
// keeps lines from soft-wrapping, so scrollWidth/scrollHeight report the
// real content box; resetting to 0 first lets it shrink back when text is
// deleted.
function autosizeTextArea(el: HTMLTextAreaElement) {
  el.style.width = '0px';
  el.style.height = '0px';
  el.style.width = `${el.scrollWidth + 2}px`;
  el.style.height = `${el.scrollHeight}px`;
}
