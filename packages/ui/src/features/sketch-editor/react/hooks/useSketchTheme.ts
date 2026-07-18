import { useEffect, useState } from 'react';
import { readExcalidrawTheme } from '../../dom.js';

/** Tracks `data-theme` on `<html>` (this package's own theme convention, see
 *  `utils/appearance.ts`) plus the OS `prefers-color-scheme`, so the
 *  embedded Excalidraw instance re-themes itself without a page reload. */
export function useSketchTheme(): 'light' | 'dark' {
  const [theme, setTheme] = useState<'light' | 'dark'>(readExcalidrawTheme);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setTheme(readExcalidrawTheme()));
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => setTheme(readExcalidrawTheme());
    media?.addEventListener('change', handleSystemThemeChange);
    return () => {
      observer.disconnect();
      media?.removeEventListener('change', handleSystemThemeChange);
    };
  }, []);

  return theme;
}
