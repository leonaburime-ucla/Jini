export type {
  AddressDisplayParts,
  BrowserHistoryEntry,
  BrowserNavigationEntry,
  BrowserNavigationState,
  BrowserTabHandle,
  BrowserViewportId,
  BrowserViewportPreset,
} from './types.js';

export {
  BROWSER_VIEWPORT_PRESETS,
  DEFAULT_HISTORY_STORAGE_NAMESPACE,
  DEFAULT_HOME_NAVIGATION_ENTRY,
  EMPTY_URL,
  HISTORY_LIMIT,
  HISTORY_SAVE_DEBOUNCE_MS,
} from './constants.js';

export {
  canGoBack,
  canGoForward,
  faviconUrl,
  formatAddressDisplay,
  formatAddressDisplayParts,
  historyStorageKey,
  hostnameFromUrl,
  initialNavigationState,
  isHistoryEntry,
  isHistoryUrl,
  labelFromUrl,
  mergeHistoryEntry,
  normalizeBrowserAddress,
  parseHistoryPayload,
  recordNavigation,
  resolveNavigationHistoryDelta,
  sameUrl,
  serializeHistoryPayload,
  updateCurrentNavigationTitle,
} from './rules.js';
export type {
  MergeHistoryEntryMeta,
  MergeHistoryEntryOptions,
  NavigationHistoryDeltaResult,
  NormalizeBrowserAddressOptions,
  RecordNavigationOptions,
} from './rules.js';

export type { BrowserBridgeRegistrationPort, BrowserHistoryStoragePort } from './ports.js';

export {
  createBrowserHistoryStorage,
  createDefaultBrowserChromeDependencies,
  createNoopBrowserBridgeRegistration,
} from './dependencies.js';
export type { BrowserChromeDependencies } from './dependencies.js';

export { useBrowserHistory } from './react/hooks/useBrowserHistory.js';
export type { BrowserHistoryController, UseBrowserHistoryOptions } from './react/hooks/useBrowserHistory.js';

export { useBrowserNavigationStack } from './react/hooks/useBrowserNavigationStack.js';
export type {
  BrowserNavigationController,
  UseBrowserNavigationStackOptions,
} from './react/hooks/useBrowserNavigationStack.js';

export { useBrowserBridgeRegistration } from './react/hooks/useBrowserBridgeRegistration.js';

export { BrowserViewportControls } from './react/components/BrowserViewportControls.js';
export type { BrowserViewportControlsProps } from './react/components/BrowserViewportControls.js';
