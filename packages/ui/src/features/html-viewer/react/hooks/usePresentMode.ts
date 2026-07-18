import { useCallback, useEffect, useState } from 'react';
import { defaultHtmlViewerDependencies } from '../../dependencies.js';
import type { HtmlViewerDependencies } from '../../ports.js';

export interface PresentModeController {
  /** Whether ANY element on the page (not necessarily one this hook opened) is currently fullscreen — tracks the browser's own fullscreenchange event, so an Escape-driven exit is reflected too. */
  isFullscreen: boolean;
  /** Request fullscreen on `element`. No-op if `element` is `null` or the browser doesn't support the Fullscreen API. */
  presentFullscreen(element: HTMLElement | null): void;
  exitFullscreen(): void;
  /** Open `html` in a new sandboxed tab titled `title`. */
  presentInNewTab(html: string, title: string): void;
}

export function usePresentMode(dependencies: HtmlViewerDependencies): PresentModeController {
  const [isFullscreen, setIsFullscreen] = useState(() => dependencies.fullscreen.fullscreenElement() !== null);

  useEffect(() => {
    setIsFullscreen(dependencies.fullscreen.fullscreenElement() !== null);
    return dependencies.fullscreen.subscribeFullscreenChange(() => {
      setIsFullscreen(dependencies.fullscreen.fullscreenElement() !== null);
    });
  }, [dependencies.fullscreen]);

  const presentFullscreen = useCallback(
    (element: HTMLElement | null) => {
      if (!element) return;
      void dependencies.fullscreen.requestFullscreen(element);
    },
    [dependencies.fullscreen],
  );

  const exitFullscreen = useCallback(() => {
    void dependencies.fullscreen.exitFullscreen();
  }, [dependencies.fullscreen]);

  const presentInNewTab = useCallback(
    (html: string, title: string) => {
      dependencies.newTabPreview.openInNewTab(html, title);
    },
    [dependencies.newTabPreview],
  );

  return { isFullscreen, presentFullscreen, exitFullscreen, presentInNewTab };
}

/** Binds the default (real browser) dependencies — see `dependencies.ts`. */
export function useWiredPresentMode(): PresentModeController {
  return usePresentMode(defaultHtmlViewerDependencies);
}
