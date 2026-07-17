/** Element attribute the rubber-band hit-tester reads to identify a card and its id. */
export const ASSET_ID_ATTR = 'data-asset-grid-id';

export const ASSET_ID_SELECTOR = `[${ASSET_ID_ATTR}]`;

/** Trailing debounce before a search-box edit reaches `fetchAssets`. */
export const DEFAULT_SEARCH_DEBOUNCE_MS = 250;

/** Coalescing window for live-update events before they're applied as one batch. */
export const DEFAULT_LIVE_UPDATE_COALESCE_MS = 200;

/** Sentinel facet value meaning "no filter" (matches every asset). */
export const ALL_FACET_VALUE = '';
