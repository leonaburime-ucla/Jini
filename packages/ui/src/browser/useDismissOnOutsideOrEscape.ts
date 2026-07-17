// Shared "close this popover/dialog" plumbing. Six independent feature
// extractions each hand-rolled a version of this: a `pointerdown` outside a
// menu's own DOM subtree, or the Escape key anywhere, should close it.
// ViewportSwitcher (viewer-shell) and BrowserViewportControls (browser-chrome)
// wrote byte-for-byte identical `document.addEventListener('pointerdown', ...)`
// + `document.addEventListener('keydown', ...)` pairs; useSettingsDialogShell
// (settings-dialog) and DeleteConfirmDialog (asset-grid) each wrote the
// Escape-only half of the same pattern (their backdrop already owns the
// outside-click half via its own `onMouseDown`/`onClick`). This hook covers
// both shapes — pass `containerRef` for the full dropdown/menu behavior, omit
// it for Escape-only modal behavior.
//
// Distinct from `utils/dom-subscriptions.ts`'s `subscribeOutsideClickOrEscape`:
// that one is a framework-free `mousedown`-based subscribe function with no
// "outside click disabled" mode. This hook matches what every feature above
// actually implemented (`pointerdown`, optional container) and is meant to be
// imported straight into a component/hook, not adapted.

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

export interface UseDismissOnOutsideOrEscapeOptions {
  /** Skip attaching any listeners while `false` (e.g. only while a menu is open). Defaults to `true`. */
  enabled?: boolean;
  /**
   * Element whose subtree counts as "inside" — a `pointerdown` outside it
   * calls `onDismiss`. Omit to skip the outside-click listener entirely and
   * only react to Escape (e.g. a modal whose backdrop click is already
   * handled by the caller).
   */
  containerRef?: RefObject<HTMLElement | null>;
}

/**
 * Calls `onDismiss` on a `pointerdown` outside `options.containerRef` (when
 * supplied) or on the Escape key anywhere. A no-op outside the browser (SSR).
 */
export function useDismissOnOutsideOrEscape(
  onDismiss: () => void,
  options: UseDismissOnOutsideOrEscapeOptions = {},
): void {
  const { enabled = true, containerRef } = options;

  // Latest-ref indirection so callers don't need to memoize `onDismiss` for
  // the listener effect below to stay attached with fresh behavior.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof document === 'undefined') return;

    function onPointerDown(event: PointerEvent) {
      const container = containerRef?.current;
      if (!container) return;
      if (container.contains(event.target as Node)) return;
      onDismissRef.current();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      onDismissRef.current();
    }

    if (containerRef) document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      if (containerRef) document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [enabled, containerRef]);
}
