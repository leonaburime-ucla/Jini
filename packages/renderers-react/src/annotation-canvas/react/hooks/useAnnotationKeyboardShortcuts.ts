import { useEffect } from 'react';

export interface UseAnnotationKeyboardShortcutsParams {
  active: boolean;
  onDeactivate?: ((active: false) => void) | undefined;
  onUndo: () => void;
  onRedo: () => void;
}

/**
 * The overlay-wide keyboard shortcuts: Escape deactivates the whole
 * overlay, Cmd/Ctrl+Z undoes, Cmd/Ctrl+Shift+Z redoes. Registered on
 * `window` in the bubble phase (not capture) — the submit-menu and
 * mark-tool-menu's own Escape-close handlers run in the capture phase
 * with `stopPropagation`, so a menu that's open closes itself instead of
 * also deactivating the overlay.
 */
export function useAnnotationKeyboardShortcuts(params: UseAnnotationKeyboardShortcutsParams): void {
  const { active, onDeactivate, onUndo, onRedo } = params;
  useEffect(() => {
    if (!active) return undefined;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onDeactivate?.(false);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) onRedo();
        else onUndo();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onDeactivate, onUndo, onRedo]);
}
