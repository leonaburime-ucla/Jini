import type {
  TabStripDragTarget,
  TabStripDropEdge,
  TabStripElementRect,
  TabStripTab,
} from './types.js';

/**
 * Which edge of `rect` a pointer at `pointerX` lands on. Ported from
 * `WorkspaceTabsBar.tsx`'s `tabDropEdgeFromElement` and
 * `FileWorkspace.tsx`'s `tabDropEdgeFromEvent` — both compute this exact
 * "left half vs right half of the target's bounding rect" split, just
 * against a `DragEvent` directly rather than a plain `clientX` number. The
 * pure form here takes the already-extracted `clientX`/rect so it needs no
 * DOM/event types.
 */
export function dropEdgeFromPointerX(pointerX: number, rect: Pick<TabStripElementRect, 'left' | 'width'>): TabStripDropEdge {
  return pointerX > rect.left + rect.width / 2 ? 'after' : 'before';
}

/**
 * Coerces a drop target that would place a tab before a pinned tab into
 * landing after it instead — pinned tabs always stay leftmost. Generalizes
 * `WorkspaceTabsBar.tsx`'s `findTabDropTarget`'s `resolveTarget` closure
 * (there hardcoded to the single entry tab; here driven by the host-
 * supplied `pinned` field on any number of tabs).
 */
export function coercePinnedDropTarget(
  target: TabStripDragTarget,
  pinnedTabIds: ReadonlySet<string>,
): TabStripDragTarget {
  if (target.edge === 'before' && pinnedTabIds.has(target.tabId)) {
    return { tabId: target.tabId, edge: 'after' };
  }
  return target;
}

/**
 * Moves `sourceId` to just before/after `targetId` in `tabIds`, preserving
 * every other tab's relative order. Returns the same array reference when
 * the move is a no-op (source/target equal, either id missing, or the
 * resulting order is unchanged) so callers can skip a state update — same
 * behavior as `WorkspaceTabsBar.tsx`'s `reorderTabsById` and
 * `FileWorkspace.tsx`'s inline `reorderPersistedTab` splice, which is the
 * exact same "filter the source out, find the target's new index, splice
 * back in at index (+1 for 'after')" algorithm in both files.
 */
export function reorderTabIds(
  tabIds: readonly string[],
  sourceId: string,
  targetId: string,
  edge: TabStripDropEdge,
): string[] {
  const original = tabIds as string[];
  if (sourceId === targetId) return original;
  if (!tabIds.includes(sourceId)) return original;

  const nextIds = tabIds.filter((id) => id !== sourceId);
  const targetIndex = nextIds.indexOf(targetId);
  if (targetIndex < 0) return original;

  nextIds.splice(edge === 'after' ? targetIndex + 1 : targetIndex, 0, sourceId);
  return arraysEqual(nextIds, tabIds) ? original : nextIds;
}

/** Ported verbatim (both files have an identical helper under this name). */
export function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

/** A stable string key for a drag target, used to detect "did the hovered
 *  target actually change" without a deep-equal check (ported from
 *  `WorkspaceTabsBar.tsx`'s `tabDragTargetKey`). */
export function dragTargetKey(target: TabStripDragTarget): string {
  return `${target.tabId}:${target.edge}`;
}

/**
 * Scans a list of candidate tab elements (by id + bounding rect) and picks
 * the nearest valid drop target for `pointerX`, skipping `sourceId`. This is
 * the fallback path of `WorkspaceTabsBar.tsx`'s `findTabDropTarget` — used
 * when the pointer isn't directly over a tab element (e.g. hovering the gap
 * after the last tab). Mirrors its "before the first candidate whose left
 * half we're past, after the last candidate otherwise" loop exactly.
 */
export function findNearestDropTarget(
  pointerX: number,
  elements: ReadonlyArray<{ id: string; rect: TabStripElementRect }>,
  sourceId: string,
): TabStripDragTarget | null {
  let lastTarget: TabStripDragTarget | null = null;
  for (const element of elements) {
    if (element.id === sourceId) continue;
    if (pointerX <= element.rect.left + element.rect.width / 2) {
      return { tabId: element.id, edge: 'before' };
    }
    if (pointerX <= element.rect.right) {
      return { tabId: element.id, edge: 'after' };
    }
    lastTarget = { tabId: element.id, edge: 'after' };
  }
  return lastTarget;
}

/** The set of pinned tab ids in `tabs` — a small helper so callers don't
 *  re-derive this `Set` construction inline in multiple places. */
export function pinnedTabIdSet(tabs: readonly TabStripTab[]): Set<string> {
  return new Set(tabs.filter((tab) => tab.pinned).map((tab) => tab.id));
}

/**
 * Whether `tab` should be draggable given the full tab list. Combines the
 * host's explicit `draggable` (falling back to `!pinned`) with the
 * `WorkspaceTabsBar.tsx`-sourced rule that dragging is pointless (and
 * disabled) when there's nothing to reorder against
 * (`draggable={!isPinned && state.tabs.length > 1}`).
 */
export function isTabDraggable(tab: TabStripTab, tabs: readonly TabStripTab[]): boolean {
  if (tabs.length <= 1) return false;
  return tab.draggable ?? !tab.pinned;
}

/** Whether `tab` should render a close button, given an `onClose` handler
 *  is supplied. Pinned tabs are never closable, matching both source
 *  shapes (`WorkspaceTabsBar.tsx`'s entry tab, gated the same way). */
export function isTabClosable(tab: TabStripTab, hasCloseHandler: boolean): boolean {
  if (tab.pinned) return false;
  if (!hasCloseHandler) return false;
  return tab.closable ?? true;
}
