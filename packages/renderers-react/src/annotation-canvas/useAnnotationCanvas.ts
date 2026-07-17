import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { drawAnnotations } from './drawing.js';
import { clamp, normalizeRect } from './rules.js';
import type { AnnotationCanvasValue, AnnotationPoint, AnnotationStroke, AnnotationTextLabel, AnnotationTool, NormalizedRect } from './types.js';

export function useAnnotationCanvasState(initialTool: AnnotationTool = 'box') {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [tool, setTool] = useState<AnnotationTool>(initialTool);
  const [note, setNote] = useState('');
  const [strokes, setStrokes] = useState<AnnotationStroke[]>([]);
  const [undoneStrokes, setUndoneStrokes] = useState<AnnotationStroke[]>([]);
  const [draftStroke, setDraftStroke] = useState<AnnotationStroke | null>(null);
  const [selectionBoxes, setSelectionBoxes] = useState<NormalizedRect[]>([]);
  const [draftBox, setDraftBox] = useState<NormalizedRect | null>(null);
  const [textLabels, setTextLabels] = useState<AnnotationTextLabel[]>([]);
  const [editingTextId, setEditingTextId] = useState<number | null>(null);
  const [frameSize, setFrameSize] = useState({ width: 1, height: 1 });
  const nextTextId = useRef(1);
  const drag = useRef<{ kind: 'box'; start: AnnotationPoint } | { kind: 'pen'; points: AnnotationPoint[] } | { kind: 'text'; id: number; dx: number; dy: number } | null>(null);
  const raf = useRef<number | null>(null);

  const value = useMemo<AnnotationCanvasValue>(() => ({ strokes, selectionBoxes, textLabels, note }), [strokes, selectionBoxes, textLabels, note]);
  const hasMarks = strokes.length > 0 || selectionBoxes.length > 0 || textLabels.some((mark) => mark.text.trim());

  const scheduleRedraw = useCallback(() => {
    if (raf.current !== null) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = null;
      const canvas = canvasRef.current;
      const frame = frameRef.current;
      if (!canvas || !frame) return;
      const rect = frame.getBoundingClientRect();
      setFrameSize({ width: Math.max(1, rect.width), height: Math.max(1, rect.height) });
      drawAnnotations({
        canvas,
        strokes,
        draftStroke,
        boxes: selectionBoxes,
        draftBox,
        textLabels,
        cssWidth: Math.max(1, rect.width),
        cssHeight: Math.max(1, rect.height),
        devicePixelRatio: window.devicePixelRatio || 1,
      });
    });
  }, [draftBox, draftStroke, selectionBoxes, strokes, textLabels]);

  useEffect(() => {
    scheduleRedraw();
  }, [scheduleRedraw]);

  useEffect(() => () => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
  }, []);

  const pointFromEvent = useCallback((event: ReactPointerEvent): AnnotationPoint => {
    const rect = frameRef.current?.getBoundingClientRect();
    return {
      x: clamp(event.clientX - (rect?.left ?? 0), 0, rect?.width ?? 1),
      y: clamp(event.clientY - (rect?.top ?? 0), 0, rect?.height ?? 1),
    };
  }, []);

  const onPointerDown = useCallback((event: ReactPointerEvent) => {
    if (typeof event.button === 'number' && event.button !== 0) return;
    const point = pointFromEvent(event);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    if (tool === 'pen') {
      drag.current = { kind: 'pen', points: [point] };
      setDraftStroke({ points: [point] });
    } else if (tool === 'box') {
      drag.current = { kind: 'box', start: point };
      setDraftBox(normalizeRect(point, point, frameSize.width, frameSize.height));
    } else {
      const id = nextTextId.current++;
      setTextLabels((marks) => [...marks, { id, x: point.x / frameSize.width, y: point.y / frameSize.height, text: '' }]);
      setEditingTextId(id);
    }
  }, [frameSize.height, frameSize.width, pointFromEvent, tool]);

  const onPointerMove = useCallback((event: ReactPointerEvent) => {
    const current = drag.current;
    if (!current) return;
    const point = pointFromEvent(event);
    if (current.kind === 'pen') {
      current.points = [...current.points, point];
      setDraftStroke({ points: current.points });
    } else if (current.kind === 'box') {
      setDraftBox(normalizeRect(current.start, point, frameSize.width, frameSize.height));
    } else {
      setTextLabels((marks) => marks.map((mark) => mark.id === current.id ? { ...mark, x: clamp((point.x - current.dx) / frameSize.width, 0, 1), y: clamp((point.y - current.dy) / frameSize.height, 0, 1) } : mark));
    }
  }, [frameSize.height, frameSize.width, pointFromEvent]);

  const onPointerUp = useCallback(() => {
    const current = drag.current;
    drag.current = null;
    if (current?.kind === 'pen' && current.points.length > 1) {
      setStrokes((items) => [...items, { points: current.points }]);
      setUndoneStrokes([]);
    }
    if (current?.kind === 'box' && draftBox && draftBox.width > 0.002 && draftBox.height > 0.002) {
      setSelectionBoxes((items) => [...items, draftBox]);
    }
    setDraftStroke(null);
    setDraftBox(null);
  }, [draftBox]);

  const beginTextDrag = useCallback((id: number, event: ReactPointerEvent) => {
    const point = pointFromEvent(event);
    const mark = textLabels.find((item) => item.id === id);
    if (!mark) return;
    drag.current = { kind: 'text', id, dx: point.x - mark.x * frameSize.width, dy: point.y - mark.y * frameSize.height };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [frameSize.height, frameSize.width, pointFromEvent, textLabels]);

  const setText = useCallback((id: number, text: string) => {
    setTextLabels((marks) => marks.map((mark) => mark.id === id ? { ...mark, text } : mark));
  }, []);

  const undo = useCallback(() => {
    setStrokes((items) => {
      const next = items.slice(0, -1);
      const removed = items.at(-1);
      if (removed) setUndoneStrokes((undone) => [removed, ...undone]);
      return next;
    });
  }, []);

  const redo = useCallback(() => {
    setUndoneStrokes((items) => {
      const restored = items[0];
      if (restored) setStrokes((existing) => [...existing, restored]);
      return items.slice(1);
    });
  }, []);

  const clear = useCallback(() => {
    setStrokes([]);
    setUndoneStrokes([]);
    setSelectionBoxes([]);
    setTextLabels([]);
    setDraftBox(null);
    setDraftStroke(null);
  }, []);

  return {
    canvasRef,
    frameRef,
    tool,
    setTool,
    note,
    setNote,
    value,
    hasMarks,
    canUndo: strokes.length > 0,
    canRedo: undoneStrokes.length > 0,
    editingTextId,
    setEditingTextId,
    frameSize,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    beginTextDrag,
    setText,
    undo,
    redo,
    clear,
  };
}
