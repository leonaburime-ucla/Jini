/**
 * Browser APIs this slice needs directly: the Fullscreen API (for "present
 * fullscreen") and opening a sandboxed preview in a new tab (for "present
 * in new tab"). Both are genuine browser capabilities with no backend
 * shape to fake — same reasoning `features/viewer-shell/`'s clipboard port
 * and `features/version-manager/`'s reuse of it already document for this
 * package.
 */
export interface FullscreenPort {
  requestFullscreen(element: HTMLElement): Promise<void>;
  exitFullscreen(): Promise<void>;
  /** The element currently in fullscreen, or `null`. */
  fullscreenElement(): Element | null;
  /** Subscribe to fullscreen enter/exit (including the user pressing Escape, which this feature doesn't otherwise observe). Returns an unsubscribe function. */
  subscribeFullscreenChange(onChange: () => void): () => void;
}

export interface NewTabPreviewPort {
  /** Open `html` (already resolved to whatever the host wants rendered) in a new sandboxed tab, titled `title`. */
  openInNewTab(html: string, title: string): void;
}

export interface HtmlViewerDependencies {
  fullscreen: FullscreenPort;
  newTabPreview: NewTabPreviewPort;
}
