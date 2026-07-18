// KitErrorBoundary — contains render-time exceptions in a subtree so a bad
// input (a malformed config file, a deleted asset) never takes down the
// whole app with a white screen; instead the boundary catches the throw and
// shows a recoverable "reload view" fallback.
//
// React error boundaries must be class components (no hooks), so the generic
// catch lives in `ErrorBoundary` and the translated fallback is supplied by
// the functional `KitErrorBoundary` wrapper.

import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: (retry: () => void) => ReactNode;
  onError?: (error: unknown) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    this.props.onError?.(error);
  }

  private retry = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) return this.props.fallback(this.retry);
    return this.props.children;
  }
}

export interface KitErrorBoundaryProps {
  children: ReactNode;
  /**
   * Called with the caught error, e.g. to forward it to an analytics sink.
   * Defaults to a no-op — the boundary still recovers locally either way.
   */
  onError?: (error: unknown) => void;
  title?: string;
  retryLabel?: string;
}

const NOOP = () => {};

export function KitErrorBoundary({
  children,
  onError = NOOP,
  title = 'Something went wrong loading this view.',
  retryLabel = 'Try again',
}: KitErrorBoundaryProps) {
  return (
    <ErrorBoundary
      onError={onError}
      fallback={(retry) => (
        <div className="jini-kit-error" role="alert" data-testid="kit-error-boundary">
          <p className="jini-kit-error-text">{title}</p>
          <button type="button" className="jini-kit-error-retry" onClick={retry}>
            {retryLabel}
          </button>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
