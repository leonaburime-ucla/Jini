/**
 * Injectable telemetry sink for the observability observers in this
 * feature. Every observer calls this with the same two-argument shape OD's
 * original `reportSafetyEvent(eventName, properties)` used, so a host's
 * analytics adapter is a one-line passthrough (e.g.
 * `(name, props) => myAnalytics.track(name, props)`).
 *
 * Defaults to a no-op everywhere it's used — mounting these observers with
 * no reporter is inert, matching the "context + host-injected adapter,
 * default no-op" shape this package already uses for i18n.
 */
export type SafetyEventReporter = (eventName: string, properties?: Record<string, unknown>) => void;

export const noopSafetyEventReporter: SafetyEventReporter = () => {
  /* no-op default: see module doc */
};
