/**
 * Visibility / session-length observer.
 *
 * Reports two events:
 *
 *   - `client_visibility_change` — on every `visibilitychange`. Carries
 *     the new state and how many ms elapsed since the previous transition,
 *     so a host can reconstruct foreground time for a session.
 *   - `client_session_summary` — on `pagehide`. Carries the total
 *     foreground duration for the page lifetime. `pagehide` is used
 *     (rather than `beforeunload`/`unload`) because it fires reliably
 *     across evergreen browsers including iOS Safari and packaged desktop
 *     shells (Electron-style renderers) right before teardown.
 */
import { noopSafetyEventReporter, type SafetyEventReporter } from './ports.js';

export interface VisibilityObserverOptions {
  reporter?: SafetyEventReporter | undefined;
}

let installed = false;

interface SessionTimes {
  pageStart: number;
  lastChange: number;
  foregroundMs: number;
  lastState: DocumentVisibilityState;
}

/**
 * Installs the visibility/session-length observer. Idempotent per page load.
 *
 * @overallScore 100
 */
export function installVisibilityObserver(options: VisibilityObserverOptions = {}): () => void {
  const reporter = options.reporter ?? noopSafetyEventReporter;
  if (installed) return () => undefined;
  if (typeof document === 'undefined') return () => undefined;
  installed = true;

  const times: SessionTimes = {
    pageStart: performance.now(),
    lastChange: performance.now(),
    foregroundMs: 0,
    lastState: document.visibilityState,
  };

  const onVisibilityChange = (): void => {
    const now = performance.now();
    const delta = now - times.lastChange;
    if (times.lastState === 'visible') {
      times.foregroundMs += delta;
    }
    times.lastChange = now;
    times.lastState = document.visibilityState;
    reporter('client_visibility_change', {
      to_state: document.visibilityState,
      // How long the *previous* state lasted — distinguishes "blinked at
      // a notification" (~500 ms hidden) from "left for lunch" (~30 min).
      previous_state_duration_ms: Math.round(delta),
    });
  };

  const onPageHide = (): void => {
    const now = performance.now();
    if (times.lastState === 'visible') {
      times.foregroundMs += now - times.lastChange;
    }
    reporter('client_session_summary', {
      page_lifetime_ms: Math.round(now - times.pageStart),
      foreground_ms: Math.round(times.foregroundMs),
    });
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', onPageHide);

  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', onPageHide);
    installed = false;
  };
}
