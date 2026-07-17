import type { AnnotationPoint, NormalizedRect, ToolbarPlacement } from './types.js';

export interface Rect { x: number; y: number; width: number; height: number }

export function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

export function normalizeRect(start: AnnotationPoint, end: AnnotationPoint, width: number, height: number): NormalizedRect {
  const left = clamp(Math.min(start.x, end.x), 0, width);
  const top = clamp(Math.min(start.y, end.y), 0, height);
  const right = clamp(Math.max(start.x, end.x), 0, width);
  const bottom = clamp(Math.max(start.y, end.y), 0, height);
  return {
    x: width > 0 ? left / width : 0,
    y: height > 0 ? top / height : 0,
    width: width > 0 ? (right - left) / width : 0,
    height: height > 0 ? (bottom - top) / height : 0,
  };
}

export function denormalizeRect(rect: NormalizedRect, width: number, height: number): Rect {
  return { x: rect.x * width, y: rect.y * height, width: rect.width * width, height: rect.height * height };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function chooseToolbarPlacement(params: {
  frame: Rect;
  toolbar: { width: number; height: number };
  avoid: Rect[];
  viewportWidth: number;
  viewportHeight: number;
  gap?: number;
  margin?: number;
}): ToolbarPlacement {
  const gap = params.gap ?? 12;
  const margin = params.margin ?? 16;
  const candidates = [
    { side: 'right' as const, x: params.frame.x + params.frame.width + gap, y: params.frame.y },
    { side: 'left' as const, x: params.frame.x - params.toolbar.width - gap, y: params.frame.y },
    { side: 'bottom' as const, x: params.frame.x, y: params.frame.y + params.frame.height + gap },
    { side: 'top' as const, x: params.frame.x, y: params.frame.y - params.toolbar.height - gap },
  ].map((candidate) => ({
    ...candidate,
    x: clamp(candidate.x, margin, params.viewportWidth - params.toolbar.width - margin),
    y: clamp(candidate.y, margin, params.viewportHeight - params.toolbar.height - margin),
  }));
  const open = candidates.find((candidate) => !params.avoid.some((rect) => rectsOverlap({ ...candidate, width: params.toolbar.width, height: params.toolbar.height }, rect)));
  if (open) return { layout: 'floating', side: open.side, style: { left: open.x, top: open.y } };
  return { layout: 'docked', side: null, style: { left: '50%', bottom: margin, transform: 'translateX(-50%)', maxWidth: `calc(100vw - ${margin * 2}px)` } };
}
