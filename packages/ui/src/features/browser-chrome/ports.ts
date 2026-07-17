import type { BrowserHistoryEntry, BrowserTabHandle } from './types.js';

export interface BrowserHistoryStoragePort {
  loadHistory(scopeKey: string): BrowserHistoryEntry[];
  saveHistory(scopeKey: string, history: BrowserHistoryEntry[]): void;
}

/**
 * Lets a host wire its own registration mechanism for a live browser tab's
 * handle (e.g. re-exposing the rendered surface to some external bridge)
 * without this feature knowing or caring what the host does with it. The
 * registration MECHANISM (register-on-mount, unregister-on-unmount, keyed by
 * a scope id) is generic; what a host registers the handle FOR is not.
 */
export interface BrowserBridgeRegistrationPort {
  registerBrowserHandle(scopeKey: string, handle: BrowserTabHandle | null): void;
}
