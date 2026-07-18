/** Once the version list is at least this long, show the search box —
 *  matches the source's own threshold for when filtering starts earning
 *  its screen space. */
export const SEARCH_VISIBLE_THRESHOLD = 3;

/** Auto-dismiss delay (ms) for the transient "Copied" state after copying
 *  the generating prompt. Matches `features/viewer-shell/`'s
 *  `COPY_FEEDBACK_RESET_MS`; kept as an independent constant here rather
 *  than a cross-feature import of a numeric literal. */
export const PROMPT_COPY_FEEDBACK_RESET_MS = 1600;

/** If the iframe's `load` event is ever missed, clear the loading overlay
 *  after this grace period so it can never get stuck over a rendered
 *  document. */
export const PREVIEW_LOAD_FALLBACK_MS = 6000;

/** Default padding (px) subtracted from the measured canvas before fitting
 *  a non-"no fixed frame" viewport preset to it. */
export const DEFAULT_PREVIEW_CANVAS_PADDING = 48;
