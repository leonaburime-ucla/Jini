/**
 * The DI seam. The annotation-canvas React layer reaches capture/submit
 * transport only through this interface — `dependencies.ts` is the one
 * file allowed to bind a real implementation.
 *
 * This is deliberately the whole of the product-specific surface: the
 * original component's iframe lookup, `postMessage` snapshot bridge, and
 * global `CustomEvent` submission contract are all host concerns and never
 * appear here — see `packages/renderers-react/source-map.md` for what a
 * host adapter is expected to bind these to.
 */
import type {
  AnnotationCaptureFrameRect,
  AnnotationSnapshot,
  AnnotationSubmitPayload,
  AnnotationSubmitResult,
} from './types.js';

export interface AnnotationCanvasPort {
  /**
   * Captures a snapshot of whatever surface this canvas overlays. Return
   * `null` when a snapshot genuinely can't be produced (the caller falls
   * back to submitting without a screenshot, matching the original's
   * best-effort capture policy) — this is not an error path.
   */
  requestSnapshot(): Promise<AnnotationSnapshot | null>;
  /**
   * The on-screen rect the snapshot corresponds to, used to scale the
   * annotation overlay onto the captured pixels. Optional: when omitted,
   * the wrapper element's own `getBoundingClientRect()` is used.
   */
  getCaptureFrameRect?(): AnnotationCaptureFrameRect | null;
  /** Submits the annotation. Resolve `{ ok: true }` on success. */
  submitAnnotation(payload: AnnotationSubmitPayload): Promise<AnnotationSubmitResult>;
}

export interface AnnotationCanvasDependencies {
  data: AnnotationCanvasPort;
}
