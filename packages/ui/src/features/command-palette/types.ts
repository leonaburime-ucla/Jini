export interface CommandPaletteItem {
  /** Stable identity, used for list keys and recents tracking. */
  id: string;
  /** Primary display + match text. */
  name: string;
  /** Host-defined category (e.g. `'file'`, `'tab'`, `'browser'`) — shown uppercased as a badge. */
  kind: string;
  /** Modified-time-like sort key for the empty-query, non-recent ordering. Higher sorts first. */
  mtime?: number;
  /** Secondary display text shown under `name` (e.g. a directory or URL). */
  path?: string;
  /** Tooltip text. Defaults to `name` when omitted. */
  title?: string;
  /** Extra text matched against the query but never displayed (e.g. an id/url/alias). */
  keywords?: string;
}

export interface CommandPaletteResult {
  item: CommandPaletteItem;
  score: number;
}
