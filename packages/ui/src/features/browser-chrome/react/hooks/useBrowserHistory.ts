import { useCallback, useEffect, useRef, useState } from 'react';
import type { BrowserHistoryEntry } from '../../types.js';
import { HISTORY_SAVE_DEBOUNCE_MS } from '../../constants.js';
import { mergeHistoryEntry, type MergeHistoryEntryMeta, type MergeHistoryEntryOptions } from '../../rules.js';
import type { BrowserHistoryStoragePort } from '../../ports.js';

export interface UseBrowserHistoryOptions {
  debounceMs?: number;
}

export interface BrowserHistoryController {
  history: BrowserHistoryEntry[];
  commitVisit: (url: string, meta?: MergeHistoryEntryMeta, options?: MergeHistoryEntryOptions) => void;
  clearHistory: () => void;
}

/**
 * Loads a scope's browsing history on mount and debounce-persists it on every
 * change (mirroring the origin's 140ms-debounced save-on-change effect).
 */
export function useBrowserHistory(
  scopeKey: string,
  dependencies: { historyStorage: BrowserHistoryStoragePort },
  options: UseBrowserHistoryOptions = {},
): BrowserHistoryController {
  const debounceMs = options.debounceMs ?? HISTORY_SAVE_DEBOUNCE_MS;
  const [history, setHistory] = useState<BrowserHistoryEntry[]>(() => dependencies.historyStorage.loadHistory(scopeKey));
  const storageRef = useRef(dependencies.historyStorage);
  storageRef.current = dependencies.historyStorage;

  useEffect(() => {
    setHistory(storageRef.current.loadHistory(scopeKey));
    // Re-hydrating on scope change only; the storage port is read via a ref
    // above so a fresh `dependencies` object each render doesn't re-trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  useEffect(() => {
    const timer = setTimeout(() => storageRef.current.saveHistory(scopeKey, history), debounceMs);
    return () => clearTimeout(timer);
  }, [history, scopeKey, debounceMs]);

  const commitVisit = useCallback((url: string, meta?: MergeHistoryEntryMeta, mergeOptions?: MergeHistoryEntryOptions) => {
    setHistory((current) => mergeHistoryEntry(current, url, meta ?? {}, mergeOptions ?? {}));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    storageRef.current.saveHistory(scopeKey, []);
  }, [scopeKey]);

  return { history, commitVisit, clearHistory };
}
