/** Fallback tone used by `StatusPill`/`statusToneFor` when a status value has no entry in a host-supplied `ResourceStatusToneMap`. */
export const DEFAULT_STATUS_TONE = 'neutral' as const;

/** Bucket key `groupItemsByStatus` uses for items whose (normalized) status doesn't appear in the host-supplied column order — kept out of `statusOrder` itself so a host's own vocabulary never accidentally collides with it. */
export const UNMATCHED_STATUS_BUCKET = '__unmatched__';

/** `ResourceBoard`'s default view mode when no stored preference exists yet (mirrors DesignsTab's own `"grid"` default). */
export const DEFAULT_BOARD_VIEW_MODE = 'grid' as const;
