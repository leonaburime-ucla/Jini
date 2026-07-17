import { useCallback, useEffect, useRef, useState } from 'react';
import { toolbarElementForTool } from '../../rules.js';
import type { AnnotationMarkTool, AnnotationToolbarElement } from '../../types.js';

export interface AnnotationToolController {
  tool: AnnotationMarkTool;
  selectTool: (tool: AnnotationMarkTool) => void;
  menuOpen: boolean;
  toggleMenu: () => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Owns which mark tool (box/pen/text) is active and its dropdown menu's
 * open state. The menu closes on an outside pointer-down or on Escape; the
 * Escape handler runs in the capture phase and stops propagation so it
 * closes only this menu, not the whole overlay (see
 * `useAnnotationKeyboardShortcuts`, which owns the overlay-wide Escape).
 */
export function useAnnotationTool(
  onToolbarClick?: (element: AnnotationToolbarElement) => void,
): AnnotationToolController {
  const [tool, setTool] = useState<AnnotationMarkTool>('box');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const selectTool = useCallback(
    (next: AnnotationMarkTool) => {
      onToolbarClick?.(toolbarElementForTool(next));
      setTool(next);
      setMenuOpen(false);
    },
    [onToolbarClick],
  );

  const toggleMenu = useCallback(() => setMenuOpen((open) => !open), []);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setMenuOpen(false);
      }
    }
    window.addEventListener('mousedown', onPointerDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('mousedown', onPointerDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [menuOpen]);

  return { tool, selectTool, menuOpen, toggleMenu, menuRef };
}
