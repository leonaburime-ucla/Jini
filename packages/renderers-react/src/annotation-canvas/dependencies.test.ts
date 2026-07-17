import { describe, expect, it } from 'vitest';
import { createFakeAnnotationCanvasDependencies, createFakeAnnotationCanvasPort } from './dependencies.js';

describe('createFakeAnnotationCanvasPort', () => {
  it('defaults requestSnapshot to null (no capture pipeline)', async () => {
    const port = createFakeAnnotationCanvasPort();
    await expect(port.requestSnapshot()).resolves.toBeNull();
  });

  it('returns a configured snapshot', async () => {
    const snapshot = { dataUrl: 'data:image/png;base64,x', w: 10, h: 10 };
    const port = createFakeAnnotationCanvasPort({ snapshot });
    await expect(port.requestSnapshot()).resolves.toBe(snapshot);
  });

  it('defaults submitAnnotation to a successful ack', async () => {
    const port = createFakeAnnotationCanvasPort();
    await expect(
      port.submitAnnotation({ file: null, note: 'hi', action: 'send' }),
    ).resolves.toEqual({ ok: true });
  });

  it('returns a configured submit result', async () => {
    const port = createFakeAnnotationCanvasPort({ submitResult: { ok: false, message: 'nope' } });
    await expect(port.submitAnnotation({ file: null, note: '', action: 'queue' })).resolves.toEqual({
      ok: false,
      message: 'nope',
    });
  });

  it('simulates latency when configured', async () => {
    const port = createFakeAnnotationCanvasPort({ latencyMs: 20 });
    const start = performance.now();
    await port.submitAnnotation({ file: null, note: '', action: 'send' });
    expect(performance.now() - start).toBeGreaterThanOrEqual(15);
  });
});

describe('createFakeAnnotationCanvasDependencies', () => {
  it('wraps the fake port under `data`', async () => {
    const deps = createFakeAnnotationCanvasDependencies();
    await expect(deps.data.requestSnapshot()).resolves.toBeNull();
  });
});
