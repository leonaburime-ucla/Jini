/** The special "show every category" tab value. */
export const ALL_CATEGORY_FILTER = 'all' as const;

/** Default inline-trigger character (`@`). A host may pass a different one
 *  (e.g. `/` for a slash-command picker) — see `readMentionTrigger`. */
export const DEFAULT_TRIGGER_CHAR = '@';

/** Default per-category result cap, matching the vendored picker's
 *  `.slice(0, 10)` per capability kind. */
export const DEFAULT_MAX_RESULTS_PER_CATEGORY = 10;
