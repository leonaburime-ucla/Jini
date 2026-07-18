export interface TabLauncherResultItem {
  /** Stable identity, used for list keys and as the "open tab" lookup key. */
  id: string;
  /** Primary display + match text. */
  name: string;
  /** Host-defined category — drives the file-section filter chips and icon selection. */
  kind: string;
  /** Secondary display text under `name` (host-formatted, e.g. "12 KB · 2h ago" or "Local code"). */
  meta?: string;
  /** Shows an "Open" badge (e.g. this file is already open as a tab). */
  isOpen?: boolean;
  /** Icon name to render, from whatever icon set the host uses. */
  iconName?: string;
}

/** A "create new" command shown above the search results. `TCtx` is whatever the host needs `run` to receive. */
export interface TabLauncherAction<TCtx = void> {
  /** Stable id, also used as the React key. */
  id: string;
  iconName?: string;
  label: string;
  description?: string;
  run: (ctx: TCtx) => void;
}

export type TabLauncherTrackEvent =
  | { type: 'open' }
  | { type: 'filter'; kind: string }
  | { type: 'select-file'; item: TabLauncherResultItem }
  | { type: 'select-tab'; item: TabLauncherResultItem }
  | { type: 'run-action'; actionId: string };

export interface TabLauncherPosition {
  top: number;
  left: number;
}

/** The subset of `DOMRect` the anchored-positioning math actually reads. */
export interface TabLauncherAnchorRect {
  top: number;
  bottom: number;
  right: number;
}

export type TabLauncherSelection =
  | { zone: 'file'; index: number }
  | { zone: 'tab'; index: number };
