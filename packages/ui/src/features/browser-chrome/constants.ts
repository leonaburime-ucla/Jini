import type { BrowserViewportPreset } from './types.js';

export const EMPTY_URL = 'about:blank';
export const HISTORY_LIMIT = 80;

/** Default localStorage-key namespace prefix used by `createBrowserHistoryStorage`. */
export const DEFAULT_HISTORY_STORAGE_NAMESPACE = 'jini:browser-chrome:history';

/** Debounce delay (ms) the wired history hook waits before persisting a change. */
export const HISTORY_SAVE_DEBOUNCE_MS = 140;

export const BROWSER_VIEWPORT_PRESETS: BrowserViewportPreset[] = [
  { id: 'desktop', label: 'Desktop', title: 'Use the full browser tab size', width: null, height: null },
  { id: 'tablet', label: 'Tablet', title: 'Preview at 820px wide', width: 820, height: 1180 },
  { id: 'mobile', label: 'Mobile', title: 'Preview at 390px wide', width: 390, height: 844 },
];

export const DEFAULT_HOME_NAVIGATION_ENTRY = { title: 'New Tab', url: EMPTY_URL };
