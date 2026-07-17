/**
 * Pure logic: geometry, bounds derivation, and the collision-avoiding
 * floating-toolbar placement engine. No React, no DOM globals — every
 * function here takes already-measured rects as plain data.
 */
import {
  ANNOTATION_DOCK_GAP,
  ANNOTATION_DOCK_MARGIN,
  ANNOTATION_DOCK_MIN_HEIGHT,
  ANNOTATION_DOCK_MIN_WIDTH,
} from './constants.js';
import type {
  AnnotationDockLayout,
  AnnotationDockPlacement,
  AnnotationDockSide,
  AnnotationMarkKind,
  AnnotationMarkTool,
  AnnotationPoint,
  AnnotationRect,
  AnnotationTextMark,
  AnnotationToolbarElement,
  NormalizedRect,
} from './types.js';

/** The toolbar-analytics element name for a mark-tool selection. Kept as a
 *  named mapping (not a 1:1 rename) since the original's naming — 'rect'
 *  for the box tool — predates this generic port and a host may already
 *  key off it. */
export function toolbarElementForTool(tool: AnnotationMarkTool): AnnotationToolbarElement {
  if (tool === 'box') return 'rect';
  if (tool === 'text') return 'text';
  return 'pen';
}

export function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function rectsOverlap(a: AnnotationRect, b: AnnotationRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function normalizedRectFromPoints(a: AnnotationPoint, b: AnnotationPoint): NormalizedRect {
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const right = Math.max(a.x, b.x);
  const bottom = Math.max(a.y, b.y);
  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

export function normalizedRectToRect(box: NormalizedRect, canvasRect: { width: number; height: number }): AnnotationRect | null {
  if (canvasRect.width <= 0 || canvasRect.height <= 0) return null;
  return {
    x: box.x * canvasRect.width,
    y: box.y * canvasRect.height,
    width: Math.max(1, box.width * canvasRect.width),
    height: Math.max(1, box.height * canvasRect.height),
  };
}

/** Collapses every committed box into one enclosing rect so the annotation
 *  bounds still describe a single region for a downstream capture crop. */
export function unionRects(rects: AnnotationRect[]): AnnotationRect | null {
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((box) => box.x));
  const top = Math.min(...rects.map((box) => box.y));
  const right = Math.max(...rects.map((box) => box.x + box.width));
  const bottom = Math.max(...rects.map((box) => box.y + box.height));
  return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}

export function strokeRect(
  points: AnnotationPoint[],
  canvasRect: { width: number; height: number },
  pad = 8,
): AnnotationRect | null {
  if (canvasRect.width <= 0 || canvasRect.height <= 0 || points.length === 0) return null;
  const xs = points.map((point) => point.x * canvasRect.width);
  const ys = points.map((point) => point.y * canvasRect.height);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    x: Math.max(0, minX - pad),
    y: Math.max(0, minY - pad),
    width: Math.max(1, maxX - minX + pad * 2),
    height: Math.max(1, maxY - minY + pad * 2),
  };
}

export interface TextMarkElementRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Bounds of every non-empty text mark. Pass the live element rect
 *  (relative to the canvas) when available; falls back to the mark's drop
 *  point (e.g. measured after unmount) so it still contributes to the crop. */
export function textMarksBounds(
  marks: AnnotationTextMark[],
  canvasRect: { width: number; height: number },
  elementRectFor: (markId: number) => TextMarkElementRect | null,
): AnnotationRect | null {
  const rects: TextMarkElementRect[] = [];
  for (const mark of marks) {
    if (mark.text.trim().length === 0) continue;
    const box = elementRectFor(mark.id);
    if (box) {
      rects.push(box);
    } else {
      const left = mark.x * canvasRect.width;
      const top = mark.y * canvasRect.height;
      rects.push({ left, top, right: left + 1, bottom: top + 1 });
    }
  }
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((item) => item.left));
  const top = Math.min(...rects.map((item) => item.top));
  const right = Math.max(...rects.map((item) => item.right));
  const bottom = Math.max(...rects.map((item) => item.bottom));
  return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}

/** The single most relevant anchor for the floating toolbar: the last
 *  committed box, else the last stroke, else a host-supplied target. */
export function anchorBounds(
  lastBox: AnnotationRect | null,
  lastStroke: AnnotationRect | null,
  targetPosition: AnnotationRect | null,
): AnnotationRect | null {
  return lastBox ?? lastStroke ?? targetPosition ?? null;
}

/** The union of every mark kind present, for the capture crop. */
export function annotationBounds(
  box: AnnotationRect | null,
  stroke: AnnotationRect | null,
  text: AnnotationRect | null,
  target: AnnotationRect | null,
): AnnotationRect | undefined {
  const bounds = [box, stroke, text, target].filter((item): item is AnnotationRect => Boolean(item));
  if (bounds.length === 0) return undefined;
  if (bounds.length === 1) return bounds[0];
  return unionRects(bounds) ?? undefined;
}

export function markKind(hasTarget: boolean, hasVisualMark: boolean): AnnotationMarkKind | undefined {
  if (hasTarget && hasVisualMark) return 'click+stroke';
  if (hasTarget) return 'click';
  if (hasVisualMark) return 'stroke';
  return undefined;
}

export function dockPlacementEquals(a: AnnotationDockPlacement, b: AnnotationDockPlacement): boolean {
  return (
    a.layout === b.layout &&
    a.side === b.side &&
    a.style.left === b.style.left &&
    a.style.top === b.style.top &&
    a.style.bottom === b.style.bottom &&
    a.style.transform === b.style.transform &&
    a.style.maxWidth === b.style.maxWidth
  );
}

export const DOCKED_PLACEMENT: AnnotationDockPlacement = {
  layout: 'docked',
  side: null,
  style: {
    left: 'calc(50% - 52px)',
    bottom: '16px',
    transform: 'translateX(-50%)',
    maxWidth: 'min(760px, calc(100% - 144px))',
  },
};

export interface DockPlacementInput {
  /** The toolbar host's rect (the scrollable/clipping ancestor the dock is
   *  portalled into), in viewport coordinates. */
  hostRect: AnnotationRect;
  /** The annotated wrap element's rect, in viewport coordinates. */
  wrapRect: AnnotationRect;
  /** The dock element's own measured size. */
  dockRect: { width: number; height: number };
  /** The anchor rect (see {@link anchorBounds}), in wrap-local coordinates. */
  anchor: AnnotationRect | null;
}

/**
 * The collision-avoiding 4-side auto-flip floating-toolbar placement
 * engine: tries right, left, bottom, top (in that order) around the
 * anchor, picks the first that both fits within the host and doesn't
 * overlap the anchor itself, clamped to the host's safe margins. Falls
 * back to a bottom-docked layout when nothing fits or fits poorly (a host
 * too small, or a zero-sized anchor/dock).
 */
export function computeDockPlacement(input: DockPlacementInput): AnnotationDockPlacement {
  const { hostRect, wrapRect, dockRect, anchor } = input;

  if (!anchor) return DOCKED_PLACEMENT;

  if (
    hostRect.width <= ANNOTATION_DOCK_MARGIN * 2 ||
    hostRect.height <= ANNOTATION_DOCK_MARGIN * 2 ||
    dockRect.width <= 0 ||
    dockRect.height <= 0 ||
    hostRect.width < Math.max(ANNOTATION_DOCK_MIN_WIDTH, dockRect.width) + ANNOTATION_DOCK_MARGIN * 2 ||
    hostRect.height < Math.max(ANNOTATION_DOCK_MIN_HEIGHT, dockRect.height) + ANNOTATION_DOCK_MARGIN * 2
  ) {
    return DOCKED_PLACEMENT;
  }

  const anchorInHost: AnnotationRect = {
    x: wrapRect.x - hostRect.x + anchor.x,
    y: wrapRect.y - hostRect.y + anchor.y,
    width: anchor.width,
    height: anchor.height,
  };
  const safeLeft = ANNOTATION_DOCK_MARGIN;
  const safeTop = ANNOTATION_DOCK_MARGIN;
  const safeRight = Math.max(safeLeft, hostRect.width - dockRect.width - ANNOTATION_DOCK_MARGIN);
  const safeBottom = Math.max(safeTop, hostRect.height - dockRect.height - ANNOTATION_DOCK_MARGIN);
  const centeredLeft = anchorInHost.x + anchorInHost.width / 2 - dockRect.width / 2;
  const centeredTop = anchorInHost.y + anchorInHost.height / 2 - dockRect.height / 2;

  const candidates: Array<{ side: AnnotationDockSide; left: number; top: number; fits: boolean }> = [
    {
      side: 'right',
      left: anchorInHost.x + anchorInHost.width + ANNOTATION_DOCK_GAP,
      top: centeredTop,
      fits: anchorInHost.x + anchorInHost.width + ANNOTATION_DOCK_GAP + dockRect.width <= hostRect.width - ANNOTATION_DOCK_MARGIN,
    },
    {
      side: 'left',
      left: anchorInHost.x - ANNOTATION_DOCK_GAP - dockRect.width,
      top: centeredTop,
      fits: anchorInHost.x - ANNOTATION_DOCK_GAP - dockRect.width >= ANNOTATION_DOCK_MARGIN,
    },
    {
      side: 'bottom',
      left: centeredLeft,
      top: anchorInHost.y + anchorInHost.height + ANNOTATION_DOCK_GAP,
      fits: anchorInHost.y + anchorInHost.height + ANNOTATION_DOCK_GAP + dockRect.height <= hostRect.height - ANNOTATION_DOCK_MARGIN,
    },
    {
      side: 'top',
      left: centeredLeft,
      top: anchorInHost.y - ANNOTATION_DOCK_GAP - dockRect.height,
      fits: anchorInHost.y - ANNOTATION_DOCK_GAP - dockRect.height >= ANNOTATION_DOCK_MARGIN,
    },
  ];

  for (const candidate of candidates) {
    if (!candidate.fits) continue;
    const clampedLeft = clamp(candidate.left, safeLeft, safeRight);
    const clampedTop = clamp(candidate.top, safeTop, safeBottom);
    const candidateRect: AnnotationRect = {
      x: clampedLeft,
      y: clampedTop,
      width: dockRect.width,
      height: dockRect.height,
    };
    if (rectsOverlap(candidateRect, anchorInHost)) continue;
    return {
      layout: 'floating' as AnnotationDockLayout,
      side: candidate.side,
      style: {
        position: 'absolute',
        left: `${Math.round(clampedLeft)}px`,
        top: `${Math.round(clampedTop)}px`,
        transform: 'none',
        bottom: 'auto',
        maxWidth: `${Math.max(0, hostRect.width - ANNOTATION_DOCK_MARGIN * 2)}px`,
      },
    };
  }

  return DOCKED_PLACEMENT;
}
