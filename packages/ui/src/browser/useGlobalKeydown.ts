// Shared "run this keydown handler for as long as the feature is active"
// plumbing. useAssetGridKeyboardShortcuts (asset-grid) and
// useAnnotationKeyboardShortcuts (annotation-canvas, `@jini/renderers-react`)
// both wrote the identical shape: bail out of the effect while an `active`
// flag is false, otherwise attach one `window` keydown listener and remove it
// on cleanup/deactivation. useSketchDomEnhancements (sketch-editor) wrote the
// same lifecycle-scoped-listener shape twice more, on `document` with the
// capture phase, to win a race against a third-party library's own
// listeners. What's shared across all of these is the subscribe/enable/
// cleanup plumbing — which keys mean what stays entirely feature-owned in the
// `handler` callback passed in.

import { useEffect, useRef } from 'react';

export interface UseGlobalKeydownOptions {
  /** Skip attaching the listener while `false` (e.g. only while a surface is active/mounted-and-open). Defaults to `true`. */
  enabled?: boolean;
  /** Listener target. Defaults to `'window'`. */
  target?: 'window' | 'document';
  /** Attach in the capture phase — needed to run before a nested/portaled surface's own listeners. Defaults to `false`. */
  capture?: boolean;
}

/**
 * Attaches `handler` as a `keydown` listener for as long as `enabled` stays
 * `true`, removing it on cleanup or when `enabled` flips to `false`.
 */
export function useGlobalKeydown(
  handler: (event: KeyboardEvent) => void,
  options: UseGlobalKeydownOptions = {},
): void {
  const { enabled = true, target = 'window', capture = false } = options;

  // Latest-ref indirection so callers don't need to memoize `handler` for
  // the listener effect below to stay attached with fresh behavior.
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled) return;
    // No `typeof eventTarget === 'undefined'` guard: `useEffect` bodies only
    // ever run after a commit in the browser (never during SSR), and this
    // package's DOM-dependent APIs already assume a browser runtime, so
    // `window`/`document` are always defined by the time this callback runs
    // for real — a defensive check here would be unreachable dead code.
    const eventTarget = target === 'document' ? document : window;

    function onKeyDown(event: KeyboardEvent) {
      handlerRef.current(event);
    }

    eventTarget.addEventListener('keydown', onKeyDown as EventListener, capture);
    return () => eventTarget.removeEventListener('keydown', onKeyDown as EventListener, capture);
  }, [enabled, target, capture]);
}
