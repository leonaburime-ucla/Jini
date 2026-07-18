import type { AssetTreeKindConfigMap, AssetTreeToolbarAction } from './types.js';

/** Default host-defined "kind" display config: empty — a host with no
 *  `AssetTreeKindConfigMap` gets every kind rendered with its raw key as the
 *  label and the generic fallback glyph (see `resolveKindConfig` in
 *  `rules.ts`). */
export const DEFAULT_KIND_CONFIG_MAP: AssetTreeKindConfigMap = {};

/** Stable empty toolbar/empty-state action list — reused as the default so
 *  omitting `toolbarActions`/`emptyStateActions` doesn't allocate a fresh
 *  array (and therefore a fresh prop identity) on every render. */
export const EMPTY_TOOLBAR_ACTIONS: readonly AssetTreeToolbarAction[] = [];

/** Fallback glyph for a file kind absent from the host's `AssetTreeKindConfigMap`. */
export const DEFAULT_KIND_GLYPH = '·'; // ·

/** Default section order: empty — every kind appends in first-seen order (see `groupFilesByKind`). */
export const DEFAULT_SECTION_ORDER: readonly string[] = [];

/** Estimated row-context-menu height in px, used to decide whether it opens below or above its anchor. */
export const ROW_MENU_ESTIMATED_HEIGHT_PX = 180;

/** Minimum clearance from the viewport edge to keep the row context menu fully on-screen. */
export const ROW_MENU_SAFE_PADDING_PX = 8;

/** How long "Copied" stays shown in the row menu after a successful copy-local-path, in ms. */
export const COPY_LOCAL_PATH_CONFIRM_MS = 1600;

/** Two Enter/Space activations on a file row's name within this window open the file (mirrors a double-click). */
export const DOUBLE_ACTIVATION_WINDOW_MS = 300;
