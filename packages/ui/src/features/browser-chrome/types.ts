// Generic "embeddable webview/iframe browser tab" primitive: a navigation
// stack, address-bar normalization, history/favicon utilities, and a
// responsive viewport-preset switcher. A host renders the actual webview or
// iframe and owns navigation/comment/AI-tooling business logic on top of
// this — this feature only owns the address/history/viewport bookkeeping.

export type BrowserViewportId = 'desktop' | 'tablet' | 'mobile';

export interface BrowserViewportPreset {
  id: BrowserViewportId;
  /** Plain-English default label. Wrap with useT() at the call site — see the i18n policy. */
  label: string;
  /** Plain-English default tooltip/title text. */
  title: string;
  width: number | null;
  height: number | null;
}

export interface BrowserHistoryEntry {
  iconUrl?: string;
  title: string;
  url: string;
  lastVisitedAt: number;
  visitCount: number;
}

export interface BrowserNavigationEntry {
  title: string;
  url: string;
}

export interface BrowserNavigationState {
  navigationStack: BrowserNavigationEntry[];
  navigationIndex: number;
}

export interface AddressDisplayParts {
  url: string;
  title?: string;
}

/**
 * A host-supplied handle to the live browser surface (webview or iframe),
 * exposed so a host can wire its own bridge (e.g. re-reading the rendered
 * DOM for some external purpose) through `BrowserBridgeRegistrationPort`.
 * Deliberately narrow — only the capabilities every embeddable-browser host
 * plausibly needs, not any one host's specific consumption of them.
 */
export interface BrowserTabHandle {
  isEmbeddedSurfaceAvailable: boolean;
  getURL: () => string;
  executeJavaScript?: (code: string, hasUserGesture?: boolean) => unknown;
}
