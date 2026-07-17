import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { normalizedRectFromPoints, normalizedRectToRect, strokeRect, unionRects } from '../../rules.js';
import { drawNormalizedBox, drawStrokes } from '../../canvas-paint.js';
import { ANNOTATION_BOX_MIN_SIZE, ANNOTATION_STROKE_WIDTH } from '../../constants.js';
import type { AnnotationMarkTool, AnnotationPoint, AnnotationRect, AnnotationStroke, NormalizedRect, AnnotationToolbarElement } from '../../types.js';

export interface AnnotationDrawingController {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  frameSize: { w: number; h: number };
  hasInk: boolean;
  hasBox: boolean;
  undoCount: number;
  redoCount: number;
  canUndo: boolean;
  canRedo: boolean;
  /** Bumps on every content mutation — a dependency signal for recomputing
   *  the floating-toolbar anchor, not a value with meaning of its own. */
  layoutRevision: number;
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerMove: (e: ReactPointerEvent) => void;
  onPointerUp: (e: ReactPointerEvent) => void;
  /** Converts a client-coordinate point to a canvas-normalized (0..1)
   *  point — used by the orchestrator to route a text-tool press into
   *  `addLabelAt` instead of the pen/box handlers. */
  pointFromClientXY: (clientX: number, clientY: number) => AnnotationPoint;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  /** The most recently committed box, in canvas-local pixels. */
  lastBoxRect: () => AnnotationRect | null;
  /** The most recently committed stroke, in canvas-local pixels. */
  lastStrokeRect: () => AnnotationRect | null;
  /** The union of every committed box, in canvas-local pixels. */
  boxBoundsRect: () => AnnotationRect | null;
  /** The union of every committed stroke's points, in canvas-local pixels. */
  strokeBoundsRect: () => AnnotationRect | null;
  /** Raw committed boxes (normalized 0..1), for capture compositing. */
  getSelectionBoxes: () => NormalizedRect[];
  /** Raw committed strokes (normalized 0..1 points), for capture compositing. */
  getStrokes: () => AnnotationStroke[];
}

export interface UseAnnotationDrawingParams {
  wrapRef: React.RefObject<HTMLDivElement | null>;
  active: boolean;
  tool: AnnotationMarkTool;
  sending: boolean;
  onToolbarClick?: ((element: AnnotationToolbarElement) => void) | undefined;
}

/**
 * Owns the canvas element's sizing/DPR scaling, the live rAF-coalesced
 * redraw loop, and every freehand-stroke/box-select mutation plus their
 * undo/redo history. Kept as one cohesive hook (not split further) since
 * strokes, boxes, and the canvas paint loop all read/write the same
 * drawing surface and history stack — splitting them would just move
 * shared refs across a hook boundary for no real separation of concerns.
 */
export function useAnnotationDrawing(params: UseAnnotationDrawingParams): AnnotationDrawingController {
  const { wrapRef, active, tool, sending, onToolbarClick } = params;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<AnnotationStroke[]>([]);
  const undoneStrokesRef = useRef<AnnotationStroke[]>([]);
  const drawingRef = useRef<AnnotationStroke | null>(null);
  const selectionBoxesRef = useRef<NormalizedRect[]>([]);
  const boxDraftRef = useRef<{ start: AnnotationPoint; current: AnnotationPoint } | null>(null);

  const [frameSize, setFrameSize] = useState({ w: 0, h: 0 });
  const [hasInk, setHasInk] = useState(false);
  const [hasBox, setHasBox] = useState(false);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);

  const syncHistoryState = useCallback(() => {
    setHasInk(strokesRef.current.length > 0);
    setHasBox(selectionBoxesRef.current.length > 0);
    setUndoCount(strokesRef.current.length);
    setRedoCount(undoneStrokesRef.current.length);
  }, []);

  const redraw = useCallback(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    if (typeof window === 'undefined' || typeof window.CanvasRenderingContext2D === 'undefined') return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    const dpr = window.devicePixelRatio || 1;
    for (const box of selectionBoxesRef.current) drawNormalizedBox(ctx, box, cvs.width, cvs.height);
    const draft = boxDraftRef.current ? normalizedRectFromPoints(boxDraftRef.current.start, boxDraftRef.current.current) : null;
    if (draft) drawNormalizedBox(ctx, draft, cvs.width, cvs.height);
    const all = drawingRef.current ? [...strokesRef.current, drawingRef.current] : strokesRef.current;
    drawStrokes(ctx, all, cvs.width, cvs.height, ANNOTATION_STROKE_WIDTH * dpr);
  }, []);

  // rAF-coalesce redraws driven by the pointermove hot path so a high-Hz
  // pointer (or trackpad) repaints the canvas at most once per frame
  // instead of once per raw event. One-shot redraws (pointerup, undo,
  // clear) stay sync.
  const redrawFrameRef = useRef<number | null>(null);
  const scheduleRedraw = useCallback(() => {
    if (redrawFrameRef.current !== null) return;
    redrawFrameRef.current = requestAnimationFrame(() => {
      redrawFrameRef.current = null;
      redraw();
    });
  }, [redraw]);
  useEffect(
    () => () => {
      if (redrawFrameRef.current !== null) cancelAnimationFrame(redrawFrameRef.current);
    },
    [],
  );

  useEffect(() => {
    const wrap = wrapRef.current;
    const cvs = canvasRef.current;
    if (!wrap || !cvs) return undefined;
    const resize = () => {
      // Size the canvas from the wrap's *layout* box (offsetWidth/Height),
      // not getBoundingClientRect() — inside a `transform: scale()`
      // ancestor, getBoundingClientRect() returns the already-scaled
      // width, and feeding that back into the canvas' CSS width would
      // scale it a second time.
      const width = wrap.offsetWidth;
      const height = wrap.offsetHeight;
      const dpr = window.devicePixelRatio || 1;
      cvs.width = Math.max(1, Math.floor(width * dpr));
      cvs.height = Math.max(1, Math.floor(height * dpr));
      cvs.style.width = `${width}px`;
      cvs.style.height = `${height}px`;
      setFrameSize((cur) => (cur.w === width && cur.h === height ? cur : { w: width, h: height }));
      redraw();
    };
    resize();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [redraw, active]);

  const pointFromClientXY = useCallback((clientX: number, clientY: number): AnnotationPoint => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const x = rect && rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    const y = rect && rect.height > 0 ? (clientY - rect.top) / rect.height : 0;
    return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
  }, []);

  function pointFromEvent(e: ReactPointerEvent): AnnotationPoint {
    return pointFromClientXY(e.clientX, e.clientY);
  }

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (!active || tool === 'text') return;
      e.preventDefault();
      if (sending) return;
      (e.target as Element).setPointerCapture?.(e.pointerId);
      const point = pointFromEvent(e);
      if (tool === 'box') {
        // Start a fresh draft on top of any already-committed boxes.
        boxDraftRef.current = { start: point, current: point };
        syncHistoryState();
        redraw();
        return;
      }
      drawingRef.current = { points: [point] };
      redraw();
    },
    [active, tool, sending, redraw, syncHistoryState],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      if (!active || tool === 'text') return;
      e.preventDefault();
      if (sending) return;
      if (boxDraftRef.current) {
        boxDraftRef.current.current = pointFromEvent(e);
        scheduleRedraw();
        return;
      }
      if (!drawingRef.current) return;
      drawingRef.current.points.push(pointFromEvent(e));
      scheduleRedraw();
    },
    [active, tool, sending, scheduleRedraw],
  );

  // Bumped by every content mutation (box/stroke commit, undo, redo,
  // clear) so a consumer (the floating-toolbar placement engine) can
  // recompute the anchor without polling refs on every render.
  const [layoutRevision, setLayoutRevision] = useState(0);
  const bump = useCallback(() => setLayoutRevision((v) => v + 1), []);

  const onPointerUp = useCallback(
    (e: ReactPointerEvent) => {
      if (!active || tool === 'text') return;
      e.preventDefault();
      if (sending) return;
      if (redrawFrameRef.current !== null) {
        cancelAnimationFrame(redrawFrameRef.current);
        redrawFrameRef.current = null;
      }
      if (boxDraftRef.current) {
        boxDraftRef.current.current = pointFromEvent(e);
        const next = normalizedRectFromPoints(boxDraftRef.current.start, boxDraftRef.current.current);
        boxDraftRef.current = null;
        if (next.width >= ANNOTATION_BOX_MIN_SIZE && next.height >= ANNOTATION_BOX_MIN_SIZE) {
          selectionBoxesRef.current = [...selectionBoxesRef.current, next];
          bump();
        }
        syncHistoryState();
        redraw();
        return;
      }
      if (!drawingRef.current) return;
      if (drawingRef.current.points.length > 1) {
        strokesRef.current.push(drawingRef.current);
        undoneStrokesRef.current = [];
        bump();
        syncHistoryState();
      }
      drawingRef.current = null;
      redraw();
    },
    [active, tool, sending, redraw, syncHistoryState, bump],
  );

  const undo = useCallback(() => {
    if (sending) return;
    if (boxDraftRef.current) {
      boxDraftRef.current = null;
      syncHistoryState();
      redraw();
      bump();
      onToolbarClick?.('undo');
      return;
    }
    if (selectionBoxesRef.current.length > 0) {
      selectionBoxesRef.current = selectionBoxesRef.current.slice(0, -1);
      syncHistoryState();
      redraw();
      bump();
      onToolbarClick?.('undo');
      return;
    }
    const stroke = strokesRef.current.pop();
    if (!stroke) return;
    onToolbarClick?.('undo');
    undoneStrokesRef.current.push(stroke);
    drawingRef.current = null;
    syncHistoryState();
    redraw();
    bump();
  }, [sending, redraw, syncHistoryState, bump, onToolbarClick]);

  const redo = useCallback(() => {
    if (sending) return;
    const stroke = undoneStrokesRef.current.pop();
    if (!stroke) return;
    onToolbarClick?.('redo');
    strokesRef.current.push(stroke);
    drawingRef.current = null;
    syncHistoryState();
    redraw();
    bump();
  }, [sending, redraw, syncHistoryState, bump, onToolbarClick]);

  const clear = useCallback(() => {
    strokesRef.current = [];
    undoneStrokesRef.current = [];
    drawingRef.current = null;
    selectionBoxesRef.current = [];
    boxDraftRef.current = null;
    syncHistoryState();
    redraw();
    bump();
  }, [syncHistoryState, redraw, bump]);

  const lastBoxRect = useCallback((): AnnotationRect | null => {
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    const lastBox = selectionBoxesRef.current.at(-1);
    if (!canvasRect || !lastBox) return null;
    return normalizedRectToRect(lastBox, canvasRect);
  }, []);

  const lastStrokeRect = useCallback((): AnnotationRect | null => {
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return null;
    return strokeRect(strokesRef.current.at(-1)?.points ?? [], canvasRect);
  }, []);

  const boxBoundsRect = useCallback((): AnnotationRect | null => {
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return null;
    const boxRects = selectionBoxesRef.current
      .map((box) => normalizedRectToRect(box, canvasRect))
      .filter((r): r is AnnotationRect => Boolean(r));
    return unionRects(boxRects);
  }, []);

  const strokeBoundsRect = useCallback((): AnnotationRect | null => {
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return null;
    return strokeRect(strokesRef.current.flatMap((s) => s.points), canvasRect);
  }, []);

  const getSelectionBoxes = useCallback(() => selectionBoxesRef.current, []);
  const getStrokes = useCallback(() => strokesRef.current, []);

  const canUndo = (undoCount > 0 || hasBox) && !sending;
  const canRedo = redoCount > 0 && !sending;

  return {
    canvasRef,
    frameSize,
    hasInk,
    hasBox,
    undoCount,
    redoCount,
    canUndo,
    canRedo,
    layoutRevision,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    pointFromClientXY,
    undo,
    redo,
    clear,
    lastBoxRect,
    lastStrokeRect,
    boxBoundsRect,
    strokeBoundsRect,
    getSelectionBoxes,
    getStrokes,
  };
}
