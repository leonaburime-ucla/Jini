import type {
  AddressDisplayParts,
  BrowserHistoryEntry,
  BrowserNavigationEntry,
  BrowserNavigationState,
} from './types.js';
import { DEFAULT_HOME_NAVIGATION_ENTRY, EMPTY_URL, HISTORY_LIMIT } from './constants.js';

// ---------------------------------------------------------------------------
// Address normalization
// ---------------------------------------------------------------------------

export interface NormalizeBrowserAddressOptions {
  /**
   * Absolute-path prefixes (e.g. `['api', 'artifacts']`) that should resolve
   * against `appOrigin` instead of being treated as a local file path. A host
   * whose app serves its own routes under the same origin the browser tab is
   * embedded in supplies this; omit both to always fall back to `file://`.
   */
  appRoutePrefixes?: string[];
  /** Origin `appRoutePrefixes` matches resolve against — typically the host's `window.location.origin`. */
  appOrigin?: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeBrowserAddress(rawAddress: string, options: NormalizeBrowserAddressOptions = {}): string {
  const value = rawAddress.trim();
  if (!value) return EMPTY_URL;
  if (value === EMPTY_URL) return EMPTY_URL;
  if (/^(https?|file):\/\//i.test(value)) return value;
  if (/^localhost(:\d+)?(\/.*)?$/i.test(value)) return `http://${value}`;
  if (/^(127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/.*)?$/i.test(value)) return `http://${value}`;
  if (value.startsWith('/')) {
    const { appRoutePrefixes = [], appOrigin } = options;
    if (appOrigin && appRoutePrefixes.length > 0) {
      const prefixPattern = new RegExp(`^/(${appRoutePrefixes.map(escapeRegExp).join('|')})(/|$)`);
      if (prefixPattern.test(value)) return new URL(value, appOrigin).toString();
    }
    return `file://${encodeURI(value)}`;
  }
  if (/^[\w.-]+\.[a-z]{2,}(:\d+)?(\/.*)?$/i.test(value)) return `https://${value}`;
  return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
}

export function labelFromUrl(url: string, homeLabel: string = DEFAULT_HOME_NAVIGATION_ENTRY.title): string {
  if (url === EMPTY_URL) return homeLabel;
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '') || url;
  } catch {
    return url;
  }
}

export function formatAddressDisplayParts(
  url: string,
  title?: string,
  homeLabel: string = DEFAULT_HOME_NAVIGATION_ENTRY.title,
): AddressDisplayParts {
  if (url === EMPTY_URL) return { url: '' };
  const cleanTitle = title?.trim();
  if (!cleanTitle) return { url };
  const fallback = labelFromUrl(url, homeLabel);
  if (cleanTitle === fallback || cleanTitle === url) return { url };
  return { url: url.replace(/\/+$/, ''), title: cleanTitle };
}

export function formatAddressDisplay(
  url: string,
  title?: string,
  homeLabel: string = DEFAULT_HOME_NAVIGATION_ENTRY.title,
): string {
  const parts = formatAddressDisplayParts(url, title, homeLabel);
  if (!parts.url) return '';
  if (!parts.title) return parts.url;
  return `${parts.url} / ${parts.title}`;
}

export function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function isHttpLikeUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export function faviconUrl(url: string): string | undefined {
  if (!isHttpLikeUrl(url)) return undefined;
  try {
    return new URL('/favicon.ico', new URL(url).origin).toString();
  } catch {
    return undefined;
  }
}

export function isHistoryUrl(url: string): boolean {
  return url !== EMPTY_URL && (isHttpLikeUrl(url) || /^file:\/\//i.test(url));
}

export function sameUrl(left: string, right: string): boolean {
  return left.replace(/\/+$/, '') === right.replace(/\/+$/, '');
}

function cleanIconUrl(url?: string): string | undefined {
  const value = url?.trim();
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value) || /^data:image\//i.test(value)) return value;
  return undefined;
}

// ---------------------------------------------------------------------------
// History entries
// ---------------------------------------------------------------------------

export function isHistoryEntry(value: unknown): value is BrowserHistoryEntry {
  if (typeof value !== 'object' || value == null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.url === 'string'
    && typeof record.title === 'string'
    && typeof record.lastVisitedAt === 'number'
    && typeof record.visitCount === 'number'
    && (record.iconUrl === undefined || typeof record.iconUrl === 'string')
  );
}

/** Namespace + scope key -> storage key. Namespace defaults to a generic Jini prefix (see `constants.ts`); scope key is host-supplied (e.g. a project or tab id). */
export function historyStorageKey(namespace: string, scopeKey: string): string {
  return `${namespace}:${scopeKey}`;
}

/** Parses a raw JSON storage payload into a sorted, deduped, limit-capped history list. Never throws — returns `[]` on any malformed input. */
export function parseHistoryPayload(raw: string, limit: number = HISTORY_LIMIT): BrowserHistoryEntry[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isHistoryEntry)
      .sort((left, right) => right.lastVisitedAt - left.lastVisitedAt)
      .slice(0, limit);
  } catch {
    return [];
  }
}

export function serializeHistoryPayload(history: BrowserHistoryEntry[], limit: number = HISTORY_LIMIT): string {
  return JSON.stringify(history.slice(0, limit));
}

export interface MergeHistoryEntryMeta {
  title?: string;
  iconUrl?: string;
}

export interface MergeHistoryEntryOptions {
  /** Pass `false` to update an entry's metadata without counting a visit (e.g. a back/forward replay). Defaults to counting. */
  countVisit?: boolean;
  homeLabel?: string;
}

/**
 * Merges a visited URL into a history list: updates the existing entry in
 * place (bumping it to the front) or inserts a new one, returning the SAME
 * array reference when nothing actually changed (so callers can skip a
 * re-render/re-save). `now` is injectable for deterministic tests.
 */
export function mergeHistoryEntry(
  history: BrowserHistoryEntry[],
  url: string,
  meta: MergeHistoryEntryMeta = {},
  options: MergeHistoryEntryOptions = {},
  now: number = Date.now(),
): BrowserHistoryEntry[] {
  if (!isHistoryUrl(url)) return history;
  const existing = history.find((entry) => sameUrl(entry.url, url));
  const nextTitle = meta.title && meta.title.trim()
    ? meta.title.trim()
    : existing?.title || labelFromUrl(url, options.homeLabel);
  const nextIconUrl = cleanIconUrl(meta.iconUrl) || existing?.iconUrl || faviconUrl(url);
  const visitIncrement = options.countVisit === false ? 0 : 1;
  const entry: BrowserHistoryEntry = existing
    ? {
        ...existing,
        ...(nextIconUrl !== undefined ? { iconUrl: nextIconUrl } : {}),
        title: nextTitle,
        lastVisitedAt: visitIncrement > 0 ? now : existing.lastVisitedAt,
        visitCount: existing.visitCount + visitIncrement,
      }
    : {
        ...(nextIconUrl !== undefined ? { iconUrl: nextIconUrl } : {}),
        title: nextTitle,
        url,
        lastVisitedAt: now,
        visitCount: 1,
      };
  if (
    existing
    && existing.title === entry.title
    && existing.iconUrl === entry.iconUrl
    && existing.lastVisitedAt === entry.lastVisitedAt
    && existing.visitCount === entry.visitCount
  ) {
    return history;
  }
  return [entry, ...history.filter((item) => !sameUrl(item.url, url))].slice(0, HISTORY_LIMIT);
}

// ---------------------------------------------------------------------------
// Navigation stack
// ---------------------------------------------------------------------------

export function initialNavigationState(
  initialUrl?: string,
  initialTitle?: string,
  homeEntry: BrowserNavigationEntry = DEFAULT_HOME_NAVIGATION_ENTRY,
): BrowserNavigationState & { url: string; addressValue: string } {
  const trimmedUrl = initialUrl?.trim();
  const url = trimmedUrl && isHistoryUrl(trimmedUrl) ? trimmedUrl : EMPTY_URL;
  if (url === EMPTY_URL) {
    return {
      addressValue: '',
      navigationIndex: 0,
      navigationStack: [homeEntry],
      url,
    };
  }
  const title = initialTitle?.trim() || labelFromUrl(url, homeEntry.title);
  return {
    addressValue: url,
    navigationIndex: 0,
    navigationStack: [{ title, url }],
    url,
  };
}

export interface RecordNavigationOptions {
  replacePendingTarget?: boolean;
  pendingTarget?: string | null;
  homeLabel?: string;
}

/**
 * Records a navigation into the stack: updates the current entry in place if
 * the URL matches it (or an adjacent back/forward entry, or a pending-load
 * target), otherwise truncates any forward history and appends a new entry —
 * the same "linear stack with in-place back/forward matching" model a real
 * browser's history uses.
 */
export function recordNavigation(
  state: BrowserNavigationState,
  url: string,
  title?: string,
  options: RecordNavigationOptions = {},
): BrowserNavigationState {
  if (url !== EMPTY_URL && !isHistoryUrl(url)) return state;

  const { navigationStack: stack, navigationIndex: index } = state;
  const nextTitle = url === EMPTY_URL
    ? DEFAULT_HOME_NAVIGATION_ENTRY.title
    : title && title.trim()
      ? title.trim()
      : labelFromUrl(url, options.homeLabel);
  const nextEntry: BrowserNavigationEntry = { title: nextTitle, url };
  const updateEntry = (entries: BrowserNavigationEntry[], entryIndex: number): BrowserNavigationEntry[] => {
    const existing = entries[entryIndex];
    const next = entries.slice();
    next[entryIndex] = { title: nextTitle || existing?.title || labelFromUrl(url, options.homeLabel), url };
    return next;
  };

  const currentEntry = index >= 0 ? stack[index] : undefined;
  const shouldReplacePending = Boolean(
    options.replacePendingTarget && options.pendingTarget && currentEntry && sameUrl(currentEntry.url, options.pendingTarget),
  );

  if (currentEntry && (sameUrl(currentEntry.url, url) || shouldReplacePending)) {
    return { navigationStack: updateEntry(stack, index), navigationIndex: index };
  }

  const previousIndex = index - 1;
  if (previousIndex >= 0 && sameUrl(stack[previousIndex]?.url ?? '', url)) {
    return { navigationStack: updateEntry(stack, previousIndex), navigationIndex: previousIndex };
  }

  const nextIndex = index + 1;
  if (nextIndex < stack.length && sameUrl(stack[nextIndex]?.url ?? '', url)) {
    return { navigationStack: updateEntry(stack, nextIndex), navigationIndex: nextIndex };
  }

  const base = index >= 0 ? stack.slice(0, index + 1) : [];
  const nextStack = [...base, nextEntry].slice(-HISTORY_LIMIT);
  return { navigationStack: nextStack, navigationIndex: nextStack.length - 1 };
}

export function updateCurrentNavigationTitle(state: BrowserNavigationState, title?: string): BrowserNavigationState {
  const trimmedTitle = title?.trim();
  const { navigationStack: stack, navigationIndex: index } = state;
  if (!trimmedTitle || index < 0) return state;
  const currentEntry = stack[index];
  if (!currentEntry || currentEntry.title === trimmedTitle) return state;
  const nextStack = stack.slice();
  nextStack[index] = { ...currentEntry, title: trimmedTitle };
  return { navigationStack: nextStack, navigationIndex: index };
}

export interface NavigationHistoryDeltaResult {
  state: BrowserNavigationState;
  entry: BrowserNavigationEntry;
}

/** Resolves a back (`delta: -1`) or forward (`delta: 1`) step. Returns `null` at either end of the stack. */
export function resolveNavigationHistoryDelta(
  state: BrowserNavigationState,
  delta: -1 | 1,
): NavigationHistoryDeltaResult | null {
  const targetIndex = state.navigationIndex + delta;
  const entry = state.navigationStack[targetIndex];
  if (!entry) return null;
  return {
    state: { navigationStack: state.navigationStack.slice(), navigationIndex: targetIndex },
    entry,
  };
}

export function canGoBack(state: BrowserNavigationState): boolean {
  return state.navigationIndex > 0;
}

export function canGoForward(state: BrowserNavigationState): boolean {
  return state.navigationIndex >= 0 && state.navigationIndex < state.navigationStack.length - 1;
}
