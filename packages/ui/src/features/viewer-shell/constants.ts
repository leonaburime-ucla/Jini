import type { ViewportPreset } from './types.js';

/** A conventional desktop/tablet/mobile breakpoint set. Purely a
 *  convenience default — every consumer of `ViewportSwitcher`/
 *  `ViewportToggleGroup` can supply its own `ViewportPreset[]` instead. */
export const DEFAULT_VIEWPORT_PRESETS: ViewportPreset[] = [
  { id: 'desktop', label: 'Desktop', title: 'Desktop', icon: 'computer-line', width: null, height: null },
  { id: 'tablet', label: 'Tablet', title: 'Tablet', icon: 'tablet-line', width: 820, height: 1180 },
  { id: 'mobile', label: 'Mobile', title: 'Mobile', icon: 'smartphone-line', width: 390, height: 844 },
];

/** Drag-and-drop MIME type used by `CommentSidePanel`'s reorder handles. */
export const COMMENT_SIDE_DRAG_MIME = 'application/x-jini-viewer-shell-comment';

/** Auto-dismiss delay (ms) for the transient "Copied" state shown after a
 *  copy-to-clipboard action. */
export const COPY_FEEDBACK_RESET_MS = 1500;
