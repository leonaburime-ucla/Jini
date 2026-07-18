// Lightweight transient toast. Single-toast queue driven entirely by the
// host's own state (`message`/`onDismiss`); no portal, no DOM imperative
// work. Multi-toast support is deliberately left to the host to compose by
// rendering multiple instances.
//
// Renders an optional secondary `details` line beneath the primary message
// so callers whose error envelopes carry an upstream explanation can surface
// it alongside the primary category label.

import { useEffect, useRef, useState } from 'react';

import { Icon } from './Icon';

export interface ToastProps {
  message: string;
  className?: string;
  details?: string | null;
  actionLabel?: string | null;
  actionAriaLabel?: string;
  onAction?: () => void;
  // Optional code/preformatted body. When present the toast pins itself open
  // (no auto-dismiss) so the user has time to manually copy the content.
  code?: string | null;
  ttlMs?: number;
  onDismiss?: () => void;
  /** ARIA role. Use "alert" for error messages (announced immediately),
   *  "status" (default) for non-urgent confirmations. */
  role?: 'status' | 'alert';
  tone?: 'default' | 'success' | 'error' | 'loading';
  placement?: 'bottom' | 'top';
}

const DEFAULT_TTL = 4000;
// Exit fade duration — kept in sync with the `.jini-toast.leaving` CSS
// animation the host supplies. The fade plays inside the TTL window (it
// begins at ttlMs - EXIT_MS) so the toast unmounts at exactly ttlMs.
const EXIT_MS = 160;

// A leading status glyph makes the toast's outcome readable at a glance: a
// check for confirmations, a spinner while an action is in flight, and a
// cross for failures.
const TONE_ICON: Record<NonNullable<ToastProps['tone']>, 'check' | 'close' | 'spinner' | null> = {
  default: null,
  success: 'check',
  error: 'close',
  loading: 'spinner',
};

export function Toast({
  message,
  className,
  details,
  actionLabel,
  actionAriaLabel,
  onAction,
  code,
  ttlMs = DEFAULT_TTL,
  onDismiss,
  role = 'status',
  tone = 'default',
  placement = 'bottom',
}: ToastProps) {
  // When code is present the toast is a manual-action surface; never
  // auto-dismiss it out from under the user mid-copy.
  const effectiveTtl = code ? 0 : ttlMs;
  const [leaving, setLeaving] = useState(false);

  // Callers typically pass `onDismiss={() => setToast(null)}` — a fresh
  // closure on every parent render. If that closure sat in the auto-dismiss
  // effect's dependency array, any parent re-render would clear and re-arm
  // the timers, pushing the deadline forward forever so the toast never
  // auto-dismisses. Hold the latest callback in a ref and key the timer
  // effect only on the values that should actually re-arm it, keeping a
  // stable identity for the timer so it counts down uninterrupted regardless
  // of parent render churn.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  // `hasDismiss` is a stable boolean: re-arm only when the callback appears
  // or disappears, not when its identity changes while staying defined.
  const hasDismiss = !!onDismiss;

  useEffect(() => {
    // Re-entrant: a new message reuses the same mounted toast, so clear any
    // prior leaving state before re-arming the timers.
    setLeaving(false);
    if (!hasDismiss || !Number.isFinite(effectiveTtl) || effectiveTtl <= 0) return;
    // Begin the fade-out EXIT_MS before the deadline so the exit animation
    // plays within the TTL window and onDismiss (which unmounts us) lands at
    // exactly effectiveTtl. Clamp the fade start to 0 for very short TTLs.
    const fadeAt = Math.max(0, effectiveTtl - EXIT_MS);
    const fadeId = window.setTimeout(() => setLeaving(true), fadeAt);
    const dismissId = window.setTimeout(() => onDismissRef.current?.(), effectiveTtl);
    return () => {
      window.clearTimeout(fadeId);
      window.clearTimeout(dismissId);
    };
  }, [message, details, code, effectiveTtl, hasDismiss]);

  const iconName = TONE_ICON[tone];

  // Animation is owned entirely by CSS the host supplies (`.jini-toast`
  // entrance keyframe on mount, `.leaving` exit keyframe on exit). Keep this
  // a plain div — no animation library — so CSS keyframes are the single
  // source of truth for both motion and centering.
  return (
    <div
      className={`jini-toast tone-${tone} placement-${placement}${className ? ` ${className}` : ''}${leaving ? ' leaving' : ''}`}
      role={role}
      aria-live={role === 'alert' ? 'assertive' : 'polite'}
    >
      <div className="jini-toast-body">
        {iconName ? (
          <span className="jini-toast-icon" aria-hidden>
            <Icon name={iconName} size={14} />
          </span>
        ) : null}
        <div className="jini-toast-message">{message}</div>
      </div>
      {details ? <div className="jini-toast-details">{details}</div> : null}
      {code ? (
        <pre className="jini-toast-code">{code}</pre>
      ) : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          className="jini-toast-action"
          onClick={onAction}
          aria-label={actionAriaLabel ?? actionLabel}
        >
          {actionLabel}
        </button>
      ) : null}
      {!code && onDismiss ? (
        <button
          type="button"
          className="jini-toast-close"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          <Icon name="close" size={13} />
        </button>
      ) : null}
      {code && onDismiss ? (
        <button
          type="button"
          className="jini-toast-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
