import { useCallback, useEffect, useRef, useState } from 'react';
import { COPY_FEEDBACK_RESET_MS } from '../../constants.js';
import type { ViewerClipboardPort } from '../../ports.js';
import { createBrowserViewerClipboard } from '../../dependencies.js';

export interface UseCopyToClipboardResult {
  /** True for `resetMs` after a successful copy, then false again. */
  copied: boolean;
  copy: (text: string) => Promise<boolean>;
}

/**
 * The "copy full text, flip a `copied` flag for ~1.5s" pattern independently
 * repeated by the plain-text viewer body and the markdown split-pane's copy
 * button in the source component. Generalized into one hook so both (and any
 * future viewer body) share the timer-reset bookkeeping.
 */
export function useCopyToClipboard(
  clipboard: ViewerClipboardPort,
  resetMs: number = COPY_FEEDBACK_RESET_MS,
): UseCopyToClipboardResult {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      const didCopy = await clipboard.copyText(text);
      if (didCopy) {
        setCopied(true);
        if (timerRef.current !== null) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(false), resetMs);
      }
      return didCopy;
    },
    [clipboard, resetMs],
  );

  return { copied, copy };
}

// Module-level singleton: `createBrowserViewerClipboard()` is stateless (a
// thin Clipboard-API/`execCommand` wrapper with no internal state of its
// own), so one shared instance is enough — avoids reallocating a fresh port
// object on every `useWiredCopyToClipboard` render for no benefit.
const defaultViewerClipboard: ViewerClipboardPort = createBrowserViewerClipboard();

/**
 * Production wiring for `useCopyToClipboard`: binds the real browser
 * clipboard implementation from `dependencies.ts`. A host that needs a
 * swappable/test port (or a non-default `resetMs`) should call
 * `useCopyToClipboard` directly with its own port instead of this zero-arg
 * wirer.
 */
export function useWiredCopyToClipboard(resetMs?: number): UseCopyToClipboardResult {
  return useCopyToClipboard(defaultViewerClipboard, resetMs);
}
