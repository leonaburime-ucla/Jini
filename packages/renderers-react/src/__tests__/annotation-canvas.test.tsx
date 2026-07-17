import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnnotationCanvas, chooseToolbarPlacement, drawAnnotations, normalizeRect, resizeCanvasForDpr } from '../index.js';

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: () => ({
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    set lineCap(_value: string) {},
    set lineJoin(_value: string) {},
    set strokeStyle(_value: string) {},
    set fillStyle(_value: string) {},
    set lineWidth(_value: number) {},
    set font(_value: string) {},
  }),
});

HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
  if (this.hasAttribute('data-jini-annotation-canvas')) {
    return { left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => ({}) };
  }
  return { left: 0, top: 0, width: 100, height: 40, right: 100, bottom: 40, x: 0, y: 0, toJSON: () => ({}) };
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('annotation canvas rules', () => {
  it('normalizes drag boxes into frame-relative coordinates', () => {
    expect(normalizeRect({ x: 90, y: 80 }, { x: 10, y: 20 }, 100, 200)).toEqual({ x: 0.1, y: 0.1, width: 0.8, height: 0.3 });
  });

  it('places the toolbar away from selected boxes when possible', () => {
    const placement = chooseToolbarPlacement({
      frame: { x: 100, y: 100, width: 200, height: 200 },
      toolbar: { width: 80, height: 40 },
      avoid: [{ x: 312, y: 100, width: 80, height: 40 }],
      viewportWidth: 600,
      viewportHeight: 500,
    });
    expect(placement.layout).toBe('floating');
    expect(placement.side).toBe('left');
  });

  it('falls back to docked toolbar placement when every side collides', () => {
    const placement = chooseToolbarPlacement({
      frame: { x: 100, y: 100, width: 200, height: 200 },
      toolbar: { width: 80, height: 40 },
      avoid: [
        { x: 312, y: 100, width: 80, height: 40 },
        { x: 8, y: 100, width: 80, height: 40 },
        { x: 100, y: 312, width: 80, height: 40 },
        { x: 100, y: 48, width: 80, height: 40 },
      ],
      viewportWidth: 600,
      viewportHeight: 500,
    });
    expect(placement.layout).toBe('docked');
  });
});

describe('annotation drawing', () => {
  it('resizes canvases for DPR and redraws marks', () => {
    const canvas = document.createElement('canvas');
    expect(resizeCanvasForDpr(canvas, 100, 50, 2)).toBe(true);
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(100);
    expect(() => drawAnnotations({
      canvas,
      strokes: [{ points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] }],
      boxes: [{ x: 0.1, y: 0.1, width: 0.5, height: 0.5 }],
      textLabels: [{ id: 1, x: 0.2, y: 0.2, text: 'Note' }],
      cssWidth: 100,
      cssHeight: 50,
      devicePixelRatio: 2,
    })).not.toThrow();
  });
});

describe('AnnotationCanvas', () => {
  it('captures and submits neutral state', async () => {
    const onSubmit = vi.fn();
    render(<AnnotationCanvas onSubmit={onSubmit}><div style={{ width: 200, height: 100 }}>artifact</div></AnnotationCanvas>);
    fireEvent.click(screen.getByRole('button', { name: 'Pen' }));
    const canvas = screen.getByLabelText('Annotation drawing surface');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.pointerDown(canvas, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 100, clientY: 50, pointerId: 1 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    await waitFor(() => expect((screen.getByRole('button', { name: 'Submit' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]![0].value.strokes).toHaveLength(1);
  });

  it('supports freehand undo and redo', async () => {
    render(<AnnotationCanvas><div style={{ width: 200, height: 100 }}>artifact</div></AnnotationCanvas>);
    fireEvent.click(screen.getByRole('button', { name: 'Pen' }));
    const canvas = screen.getByLabelText('Annotation drawing surface');
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.pointerDown(canvas, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 20, clientY: 20, pointerId: 1 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    await waitFor(() => expect((screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect((screen.getByRole('button', { name: 'Redo' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
