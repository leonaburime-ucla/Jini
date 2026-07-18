/**
 * Generic types for a "type a trigger character, get a filtered picker"
 * mention/capability autocomplete: inline trigger-token detection in a
 * text field, tabbed multi-category filtered results, and removable
 * selection chips. `TIcon` is left as a type parameter (defaulting to
 * `unknown`) rather than fixed to a React node — see `react/components`'
 * `MentionAutocompleteItem` alias, which is where the React-shaped
 * `icon?: ReactNode` actually gets used; keeping it generic here is what
 * lets this file stay free of a runtime React import, per this package's
 * React-layout policy.
 *
 * Origin: the `@`-token detection / tabbed capability picker / removable
 * chips shape from the vendored schedule/mention god-component (recon r6
 * §1.19) — "directly analogous to the `QuickSwitcher.tsx` precedent."
 * OD-specific only via the capability data types (`SkillSummary`/
 * `InstalledPluginRecord`/`McpServerConfig`/`ConnectorDetail`); this module
 * replaces all four with one generic `MentionItem` shape instead.
 */

/** A single autocomplete-able item: any host-owned capability/entity with a
 *  stable id, a display label, and a category it belongs to. */
export interface MentionItem<TIcon = unknown> {
  id: string;
  label: string;
  /** Must match one of the host-supplied `MentionCategory.id`s. */
  category: string;
  /** Secondary line rendered under the label (e.g. a description or type). */
  meta?: string | undefined;
  /** Host-rendered icon/leading visual — kept generic (not `ReactNode`
   *  directly) so this file can stay free of a runtime React import. */
  icon?: TIcon | undefined;
}

/** A pluggable result category (e.g. "Skills", "Plugins", "MCP",
 *  "Connectors") — `label` is plain English, used directly as a `useT()`
 *  key by the caller, per this package's i18n convention. */
export interface MentionCategory {
  id: string;
  label: string;
}

/** The active category-tab filter: `'all'`, or one specific category id. */
export type MentionCategoryFilter = 'all' | string;

/** A detected in-progress `@token` at the current cursor position. */
export interface MentionTriggerMatch {
  /** Index of the trigger character itself (e.g. `@`) within the source text. */
  start: number;
  /** Cursor position the match was read at (== end of the in-progress token). */
  end: number;
  /** Text typed after the trigger character so far. */
  query: string;
}

/** The result of splicing a picked item's token into the source text. */
export interface MentionInsertResult {
  nextValue: string;
  /** Cursor position to restore focus to after the splice. */
  cursor: number;
}
