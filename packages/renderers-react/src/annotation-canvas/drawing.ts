import type { AnnotationStroke, AnnotationTextLabel, NormalizedRect } from './types.js';
import { denormalizeRect } from './rules.js';

export interface DrawAnnotationParams {
  canvas: HTMLCanvasElement;
  strokes: AnnotationStroke[];
  draftStroke?: AnnotationStroke | null;
  boxes: NormalizedRect[];
  draftBox?: NormalizedRect | null;
  textLabels: AnnotationTextLabel[];
  cssWidth: number;
  cssHeight: number;
  devicePixelRatio?: number;
}

export function resizeCanvasForDpr(canvas: HTMLCanvasElement, cssWidth: number, cssHeight: number, dpr = 1): boolean {
  const nextWidth = Math.max(1, Math.round(cssWidth * dpr));
  const nextHeight = Math.max(1, Math.round(cssHeight * dpr));
  const changed = canvas.width !== nextWidth || canvas.height !== nextHeight;
  canvas.width = nextWidth;
  canvas.height = nextHeight;
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  return changed;
}

export function drawAnnotations(params: DrawAnnotationParams): void {
  const dpr = params.devicePixelRatio ?? 1;
  resizeCanvasForDpr(params.canvas, params.cssWidth, params.cssHeight, dpr);
  const ctx = params.canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, params.canvas.width, params.canvas.height);
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#ff3b30';
  ctx.lineWidth = 4;
  for (const stroke of params.draftStroke ? [...params.strokes, params.draftStroke] : params.strokes) {
    if (stroke.points.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(stroke.points[0]!.x, stroke.points[0]!.y);
    for (const point of stroke.points.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }
  ctx.strokeStyle = '#1677ff';
  ctx.lineWidth = 2;
  for (const box of params.draftBox ? [...params.boxes, params.draftBox] : params.boxes) {
    const rect = denormalizeRect(box, params.cssWidth, params.cssHeight);
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  }
  ctx.fillStyle = '#111827';
  ctx.font = `${Math.max(12, params.cssHeight * 0.03)}px system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
  for (const label of params.textLabels) {
    label.text.split('\n').forEach((line, index) => ctx.fillText(line, label.x * params.cssWidth, label.y * params.cssHeight + index * params.cssHeight * 0.0375));
  }
  ctx.restore();
}
