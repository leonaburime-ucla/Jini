/**
 * The only file in this feature allowed to touch a concrete adapter.
 *
 * Both `requestSnapshot`/`getCaptureFrameRect` (a real compositor/DOM
 * screenshot bridge) and `submitAnnotation` (wherever the host actually
 * sends the mark) are genuinely host-specific — this package ships a
 * fake/in-memory double, matching the `features/connectors` canary's own
 * convention; a real host supplies its own `AnnotationCanvasPort`.
 */
import type { AnnotationCanvasDependencies, AnnotationCanvasPort } from './ports.js';
import type { AnnotationSnapshot, AnnotationSubmitPayload, AnnotationSubmitResult } from './types.js';

export interface FakeAnnotationCanvasPortOptions {
  /** Simulated latency in ms for both operations; 0 (default) resolves synchronously. */
  latencyMs?: number;
  /** Snapshot returned by `requestSnapshot()`; `null` (default) simulates a host with no capture pipeline. */
  snapshot?: AnnotationSnapshot | null;
  /** Result returned by `submitAnnotation()`. Defaults to a successful ack. */
  submitResult?: AnnotationSubmitResult;
}

export function createFakeAnnotationCanvasPort(options: FakeAnnotationCanvasPortOptions = {}): AnnotationCanvasPort {
  const latencyMs = options.latencyMs ?? 0;
  const snapshot = options.snapshot ?? null;
  const submitResult = options.submitResult ?? { ok: true };
  const delay = <T>(value: T): Promise<T> =>
    latencyMs > 0 ? new Promise((resolve) => setTimeout(() => resolve(value), latencyMs)) : Promise.resolve(value);

  return {
    requestSnapshot() {
      return delay(snapshot);
    },
    submitAnnotation(_payload: AnnotationSubmitPayload) {
      return delay(submitResult);
    },
  };
}

export function createFakeAnnotationCanvasDependencies(
  options: FakeAnnotationCanvasPortOptions = {},
): AnnotationCanvasDependencies {
  return { data: createFakeAnnotationCanvasPort(options) };
}
