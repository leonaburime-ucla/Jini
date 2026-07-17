/**
 * `RenderService` port, shaped per extraction-plan.md §12 C7: "a provider
 * bound via the registry, not a kernel service" — `renderToPdf(html) ->
 * bytes` / `capture(html) -> png`, plus viewport/timeout/abort/
 * resource-policy options, with Electron / headless-Chromium / Tauri as
 * adapters. This is NOT a port of OD's `deck-capture.ts`/`pdf-export.ts`
 * (design/slide-specific business logic, explicitly out of scope) —
 * those stay OD-side as a future adapter implementing this same port with
 * OD's own behavior layered on top. This file defines only the
 * provider-agnostic contract; `electron/electron-render-service.ts` is
 * the first real adapter.
 */

export interface RenderViewport {
  width: number;
  height: number;
  deviceScaleFactor?: number;
}

/**
 * Controls what an offscreen render is allowed to do while rendering
 * caller-supplied HTML. Defaults (enforced by adapters, not this file)
 * are the safe ones: no navigation away from the given document, no
 * network access beyond `allowedOrigins`.
 */
export interface RenderResourcePolicy {
  javascript?: boolean;
  allowNavigation?: boolean;
  allowedOrigins?: string[];
}

export interface RenderOptions {
  viewport?: RenderViewport;
  timeoutMs?: number;
  signal?: AbortSignal;
  resourcePolicy?: RenderResourcePolicy;
}

export interface PdfMargins {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

export interface RenderToPdfOptions extends RenderOptions {
  landscape?: boolean;
  printBackground?: boolean;
  pageWidth?: number;
  pageHeight?: number;
  margins?: PdfMargins;
}

export interface CaptureOptions extends RenderOptions {
  clip?: { x: number; y: number; width: number; height: number };
}

export interface ExportArtifactOptions extends RenderOptions {
  format: string;
  extra?: Record<string, unknown>;
}

export type RenderServiceErrorCode = 'timeout' | 'aborted' | 'load-failed' | 'navigation-blocked' | 'not-implemented';

export class RenderServiceError extends Error {
  readonly code: RenderServiceErrorCode;

  constructor(message: string, code: RenderServiceErrorCode) {
    super(message);
    this.name = 'RenderServiceError';
    this.code = code;
  }
}

export interface RenderService {
  renderToPdf(html: string, options?: RenderToPdfOptions): Promise<Uint8Array>;
  capture(html: string, options?: CaptureOptions): Promise<Uint8Array>;
  exportArtifact(html: string, options: ExportArtifactOptions): Promise<unknown>;
}

/** Data-URL-encodes HTML for loading into an offscreen renderer, base64 (not `encodeURIComponent`) to avoid per-platform URL-length/charset surprises with large documents. */
export function htmlToDataUrl(html: string): string {
  return `data:text/html;base64,${Buffer.from(html, 'utf8').toString('base64')}`;
}

export function isOriginAllowed(url: string, allowedOrigins: string[] | undefined): boolean {
  if (allowedOrigins == null) return true;
  if (url.startsWith('data:') || url.startsWith('about:')) return true;
  try {
    return allowedOrigins.includes(new URL(url).origin);
  } catch {
    return false;
  }
}

/**
 * Races a promise against a timeout and an optional `AbortSignal`,
 * normalizing both into `RenderServiceError`. Shared by every adapter so
 * the timeout/abort contract behaves identically regardless of backend.
 */
export async function withRenderTimeout<T>(promise: Promise<T>, timeoutMs: number | undefined, signal: AbortSignal | undefined): Promise<T> {
  if (signal?.aborted) throw new RenderServiceError('render aborted before starting', 'aborted');
  if (timeoutMs == null && signal == null) return promise;

  return await new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer =
      timeoutMs == null
        ? null
        : setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(new RenderServiceError(`render timed out after ${timeoutMs}ms`, 'timeout'));
          }, timeoutMs);

    const onAbort = () => {
      if (settled) return;
      settled = true;
      if (timer != null) clearTimeout(timer);
      reject(new RenderServiceError('render aborted', 'aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        if (timer != null) clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        if (timer != null) clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}
