/**
 * Generic types for the asset-tree-browser feature: a directory-navigable
 * file tree (breadcrumbs, folders + kind-grouped file sections, a right-side
 * preview pane, inline rename, row context menu, drag/paste upload). `TFile`
 * is any host-owned file shape with at least a stable slash-separated `path`
 * (its identity — see {@link AssetTreeFileItem}); every other generic
 * behavior reads the file through the `AssetTreeSelectors` a host supplies
 * rather than assuming a fixed field layout. Mirrors the same discipline as
 * `features/asset-grid`'s `AssetGridItem`/`AssetGridSelectors` pair.
 */

/** Stable identity: the full slash-separated path from the tree root, e.g. `"src/App.tsx"`. */
export interface AssetTreeFileItem {
  path: string;
}

/**
 * A persisted folder, which may have zero files under it. Without these,
 * a directory only appears once a file with a matching path prefix exists,
 * so an empty (host-created or imported) folder would never surface in the
 * tree.
 */
export interface AssetTreeFolderItem {
  path: string;
}

/** How the tree reads generic fields off a host's own file shape. */
export interface AssetTreeSelectors<TFile> {
  getSize: (file: TFile) => number;
  /** Last-modified time in epoch ms — drives recency sort within a section. */
  getModifiedAt: (file: TFile) => number;
  /** Host-defined kind key, an arbitrary string (e.g. `"image"`, `"code"`, `"stylesheet"`). */
  getKind: (file: TFile) => string;
  /**
   * The file's real filesystem path on the host machine, if one exists and
   * is safe to expose (e.g. a desktop host with a real working directory).
   * Omit entirely (or return `null`/`undefined`) to hide the row menu's
   * "copy local path" action for every file.
   */
  getLocalPath?: (file: TFile) => string | null | undefined;
}

/** Display config for one host-defined file kind. */
export interface AssetTreeKindConfig {
  label: string;
  glyph: string;
}

export type AssetTreeKindConfigMap = Record<string, AssetTreeKindConfig>;

/**
 * The files at the current directory, grouped by kind. Purely data — label
 * and glyph resolution against `AssetTreeKindConfigMap` happens at render
 * time via {@link resolveKindConfig} in `rules.ts`, keeping this shape
 * independent of the host's display config.
 */
export interface AssetTreeSection<TFile> {
  kind: string;
  files: TFile[];
}

/** The directory currently being viewed. */
export interface AssetTreeNavState {
  currentDir: string;
}

export interface AssetTreeToolbarAction {
  key: string;
  label: string;
  /** Host resolves this to its own icon system; this package only threads the string through (see `AssetTreeToolbar`). */
  icon?: string;
  onSelect: () => void;
  disabled?: boolean;
  testId?: string;
}

export interface AssetTreeBreadcrumbSegment {
  /** Full path from the tree root to (and including) this segment; `''` for the root segment. */
  path: string;
  label: string;
  isLast: boolean;
}

/**
 * A human-readable "time ago" result, kept i18n-safe by never baking
 * interpolated values into the translation key itself (that would mint a
 * new dictionary entry per distinct value, defeating translation). Mirrors
 * `features/asset-grid`'s `DayHeading` shape: `translatable: true` means
 * `label` is a stable template key to pass through `t(label, params)`
 * (e.g. `'{n}m ago'` with `params: { n: 3 }`, or a param-less key like
 * `'Just now'`); `translatable: false` means `label` is already a
 * locale-formatted date string (from `Date#toLocaleDateString`) that isn't a
 * sensible translation key since it varies per call.
 */
export interface AssetTreeRelativeTime {
  label: string;
  translatable: boolean;
  params?: { n: number };
}

export interface AssetTreeRenameState {
  /** The path being renamed, as it existed before this rename started. */
  path: string;
  /** The editable basename draft (no directory prefix). */
  draft: string;
  saving: boolean;
}

export interface AssetTreeMenuPosition {
  path: string;
  top: number;
  left: number;
}
