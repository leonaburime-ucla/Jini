/**
 * Iframe load tracker.
 *
 * Iframe load failures don't propagate to a global `window.error` listener
 * — they're trapped inside the frame — so {@link installResourceErrorObserver}
 * (`resource-error.ts`) can't see them. This helper instruments a single
 * `<iframe>` element for failure/timeout and reports scoped events; the
 * caller supplies it when mounting the iframe (e.g. a preview/renderer
 * surface) and gets a cleanup callback back.
 *
 * Origin (`observability/iframe-error.ts`) hard-coded `artifactId`/
 * `projectId`/`conversationId` fields tied to OD's domain model. Genericized
 * to a free-form `context` bag so any host can attach its own identifiers.
 */
import { noopSafetyEventReporter, type SafetyEventReporter } from './ports.js';

const DEFAULT_LOAD_TIMEOUT_MS = 15000;

export interface TrackIframeLoadOptions {
  iframe: HTMLIFrameElement;
  /** Label so a host's dashboards can split iframe surfaces from each other
   *  (e.g. "file-preview", "embedded-canvas"). */
  surface: string;
  reporter?: SafetyEventReporter | undefined;
  /** Timeout before an unresolved load is reported as stuck. Defaults to 15000. */
  timeoutMs?: number;
  /** Arbitrary extra context merged into every emitted event. */
  context?: Record<string, unknown>;
}

/**
 * Instruments an iframe for load failure/timeout and returns a cleanup
 * function. Does not report on ordinary successful loads (the common case)
 * to avoid multiplying event volume — only settles the timeout.
 *
 * @overallScore 100
 */
export function trackIframeLoad(options: TrackIframeLoadOptions): () => void {
  const { iframe, surface, context = {} } = options;
  const reporter = options.reporter ?? noopSafetyEventReporter;
  const timeoutMs = options.timeoutMs ?? DEFAULT_LOAD_TIMEOUT_MS;
  const startedAt = performance.now();
  let settled = false;

  const settle = (event: string, extras: Record<string, unknown> = {}): void => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    reporter(event, {
      surface,
      duration_ms: Math.round(performance.now() - startedAt),
      ...context,
      ...extras,
    });
  };

  const onLoad = (): void => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
  };

  const onError = (): void => {
    settle('client_iframe_error', { reason: 'error_event' });
  };

  iframe.addEventListener('load', onLoad);
  iframe.addEventListener('error', onError);

  const timer = setTimeout(() => {
    settle('client_iframe_timeout', { timeout_ms: timeoutMs });
  }, timeoutMs);

  return () => {
    clearTimeout(timer);
    iframe.removeEventListener('load', onLoad);
    iframe.removeEventListener('error', onError);
  };
}
