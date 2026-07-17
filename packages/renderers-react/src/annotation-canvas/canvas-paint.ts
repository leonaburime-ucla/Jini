/**
 * Pure canvas-painting functions shared by the live redraw loop and the
 * capture-time composite. No React; each function's only side effect is
 * drawing into the `CanvasRenderingContext2D` it's given.
 */
import {
  ANNOTATION_STROKE_COLOR,
  ANNOTATION_TARGET_COLOR,
  ANNOTATION_TEXT_FONT_FAMILY,
  ANNOTATION_TEXT_FONT_FRACTION,
  ANNOTATION_TEXT_LINE_HEIGHT,
  ANNOTATION_TEXT_MIN_FONT_PX,
} from './constants.js';
import type { AnnotationRect, AnnotationStroke, AnnotationTextMark, NormalizedRect } from './types.js';

export function drawNormalizedBox(ctx: CanvasRenderingContext2D, box: NormalizedRect, width: number, height: number) {
  const left = box.x * width;
  const top = box.y * height;
  const boxWidth = Math.max(1, box.width * width);
  const boxHeight = Math.max(1, box.height * height);
  ctx.save();
  ctx.fillStyle = 'rgba(255, 59, 48, 0.10)';
  ctx.strokeStyle = ANNOTATION_STROKE_COLOR;
  ctx.lineWidth = Math.max(2, Math.round(Math.min(width, height) * 0.002));
  ctx.setLineDash([10, 6]);
  ctx.fillRect(left, top, boxWidth, boxHeight);
  ctx.strokeRect(left, top, boxWidth, boxHeight);
  ctx.restore();
}

export function drawStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: AnnotationStroke[],
  width: number,
  height: number,
  lineWidth: number,
) {
  ctx.strokeStyle = ANNOTATION_STROKE_COLOR;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const stroke of strokes) {
    const first = stroke.points[0];
    if (!first) continue;
    ctx.beginPath();
    ctx.moveTo(first.x * width, first.y * height);
    for (let i = 1; i < stroke.points.length; i++) {
      const p = stroke.points[i]!;
      ctx.lineTo(p.x * width, p.y * height);
    }
    ctx.stroke();
  }
}

// Bake the transparent on-screen labels into a captured composite. The
// glyph height is the same frame-height fraction the live DOM textareas
// use, so what the user typed lands at the same size and position. A soft
// white halo keeps the stroke color legible over any background.
export function drawTextMarks(ctx: CanvasRenderingContext2D, marks: AnnotationTextMark[], width: number, height: number) {
  const fontPx = Math.max(ANNOTATION_TEXT_MIN_FONT_PX, ANNOTATION_TEXT_FONT_FRACTION * height);
  const lineHeight = fontPx * ANNOTATION_TEXT_LINE_HEIGHT;
  const topPad = (lineHeight - fontPx) / 2;
  ctx.save();
  ctx.textBaseline = 'top';
  ctx.font = `600 ${fontPx}px ${ANNOTATION_TEXT_FONT_FAMILY}`;
  ctx.fillStyle = ANNOTATION_STROKE_COLOR;
  ctx.shadowColor = 'rgba(255,255,255,0.75)';
  ctx.shadowBlur = Math.max(1, fontPx * 0.14);
  for (const mark of marks) {
    if (mark.text.trim().length === 0) continue;
    const baseX = mark.x * width;
    const baseY = mark.y * height + topPad;
    mark.text.split('\n').forEach((line, index) => {
      ctx.fillText(line, baseX, baseY + index * lineHeight);
    });
  }
  ctx.restore();
}

export function drawAnnotationTarget(
  ctx: CanvasRenderingContext2D,
  scaleX: number,
  scaleY: number,
  target: AnnotationRect,
  label: string | undefined,
) {
  const { x, y, width, height } = target;
  if (![x, y, width, height].every(Number.isFinite)) return;
  if (width <= 0 || height <= 0) return;
  const left = x * scaleX;
  const top = y * scaleY;
  const boxWidth = Math.max(1, width * scaleX);
  const boxHeight = Math.max(1, height * scaleY);
  ctx.save();
  ctx.fillStyle = 'rgba(22, 119, 255, 0.12)';
  ctx.strokeStyle = ANNOTATION_TARGET_COLOR;
  ctx.lineWidth = Math.max(2, Math.round(Math.max(scaleX, scaleY) * 2));
  ctx.setLineDash([Math.max(8, 8 * scaleX), Math.max(4, 4 * scaleX)]);
  ctx.fillRect(left, top, boxWidth, boxHeight);
  ctx.strokeRect(left, top, boxWidth, boxHeight);
  const trimmedLabel = (label ?? '').trim();
  if (trimmedLabel) {
    const fontSize = Math.max(12, Math.round(12 * Math.max(scaleX, scaleY)));
    ctx.font = `600 ${fontSize}px ${ANNOTATION_TEXT_FONT_FAMILY}`;
    const text = trimmedLabel.length > 42 ? `${trimmedLabel.slice(0, 39)}...` : trimmedLabel;
    const metrics = ctx.measureText(text);
    const padX = Math.max(6, Math.round(6 * scaleX));
    const padY = Math.max(4, Math.round(4 * scaleY));
    const labelWidth = metrics.width + padX * 2;
    const labelHeight = fontSize + padY * 2;
    const labelTop = Math.max(0, top - labelHeight - Math.max(4, 4 * scaleY));
    ctx.setLineDash([]);
    ctx.fillStyle = ANNOTATION_TARGET_COLOR;
    ctx.fillRect(left, labelTop, labelWidth, labelHeight);
    ctx.fillStyle = '#fff';
    ctx.fillText(text, left + padX, labelTop + padY + fontSize * 0.82);
  }
  ctx.restore();
}
