import { useCallback, useRef, useState } from 'react';
import type { DragEvent, MouseEvent, RefObject } from 'react';
import { TAB_STRIP_DRAG_HAPTIC_MS, TAB_STRIP_DROP_HAPTIC_MS, TAB_STRIP_ITEM_ID_ATTRIBUTE } from '../../constants.js';
import { noopTabStripHaptics } from '../../ports.js';
import type { TabStripHapticsPort } from '../../ports.js';
import {
  coercePinnedDropTarget,
  dragTargetKey,
  dropEdgeFromPointerX,
  findNearestDropTarget,
  isTabDraggable,
  pinnedTabIdSet,
} from '../../rules.js';
import type { TabStripDragTarget, TabStripDropEdge, TabStripReorderTiming, TabStripTab } from '../../types.js';

export interface UseTabStripDragReorderOptions {
  tabs: TabStripTab[];
  /**
   * Called with the semantic reorder instruction (move `sourceId` to just
   * before/after `targetId`) whenever the drag gesture reports one. The
   * hook never mutates `tabs` itself — tab order is host-owned state (the
   * host applies `reorderTabIds` from `rules.ts`, or its own equivalent,
   * and re-renders with the new `tabs` order), mirroring how neither source
   * component's tab-item-level drag code owned the order array directly.
   */
  onReorder: (sourceId: string, targetId: string, edge: TabStripDropEdge) => void;
  /**
   * `'onDrop'` (default) fires `onReorder` only when the drag is released —
   * `FileWorkspace.tsx`'s `Tab`/`reorderPersistedTab` behavior. `'live'`
   * fires it continuously during `dragover` as the pointer crosses tab
   * boundaries, live-shuffling the strip while dragging —
   * `WorkspaceTabsBar.tsx`'s `handleStripDragOver` behavior. `onReorder`
   * should be cheap/idempotent either way (both source implementations'
   * own reorder functions already are, via the same-order no-op check).
   */
  reorderTiming?: TabStripReorderTiming | undefined;
  /** Defaults to a no-op — opt in with `createBrowserTabStripHaptics()`. */
  haptics?: TabStripHapticsPort | undefined;
}

export interface TabStripItemDragProps {
  draggable: boolean;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  /** Wire onto the item's `onClick` (or call before invoking `onActivate`)
   *  to suppress the spurious click a drag-and-drop gesture can produce —
   *  ported from `WorkspaceTabsBar.tsx`'s `dragSuppressClickRef`. */
  onClickCapture: (event: MouseEvent<HTMLElement>) => void;
}

export interface UseTabStripDragReorderResult {
  draggingTabId: string | null;
  dragOverTarget: TabStripDragTarget | null;
  stripRef: RefObject<HTMLDivElement | null>;
  stripDragProps: {
    onDragOver: (event: DragEvent<HTMLElement>) => void;
    onDrop: (event: DragEvent<HTMLElement>) => void;
    onDragLeave: (event: DragEvent<HTMLElement>) => void;
  };
  getItemDragProps: (tabId: string) => TabStripItemDragProps;
}

/**
 * Owns the drag-to-reorder gesture for a `TabStrip`. Hit-testing is
 * centralized on the strip container (one `onDragOver`/`onDrop`, scanning
 * `[data-tab-strip-item-id]` descendants) rather than wired per-item —
 * `WorkspaceTabsBar.tsx`'s approach, adopted here as the single mechanism
 * because it strictly generalizes `FileWorkspace.tsx`'s per-item
 * `onDragOver` (which only ever fires while directly over a tab element and
 * misses the gap after the last tab); every source-shape drag interaction
 * still verified working through this one path in the dual-shape test.
 */
export function useTabStripDragReorder({
  tabs,
  onReorder,
  reorderTiming = 'onDrop',
  haptics = noopTabStripHaptics,
}: UseTabStripDragReorderOptions): UseTabStripDragReorderResult {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const draggingTabIdRef = useRef<string | null>(null);
  const dragHapticTargetRef = useRef<string | null>(null);
  const suppressClickRef = useRef(false);
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<TabStripDragTarget | null>(null);

  const findDropTarget = useCallback(
    (event: { clientX: number; target: EventTarget | null }, sourceId: string): TabStripDragTarget | null => {
      const strip = stripRef.current;
      if (!strip) return null;
      const pinnedIds = pinnedTabIdSet(tabs);

      const eventTarget = event.target;
      if (eventTarget instanceof HTMLElement) {
        const itemElement = eventTarget.closest<HTMLElement>(`[${TAB_STRIP_ITEM_ID_ATTRIBUTE}]`);
        if (itemElement && strip.contains(itemElement)) {
          const tabId = itemElement.getAttribute(TAB_STRIP_ITEM_ID_ATTRIBUTE);
          if (tabId && tabId !== sourceId) {
            const rect = itemElement.getBoundingClientRect();
            const edge = dropEdgeFromPointerX(event.clientX, rect);
            return coercePinnedDropTarget({ tabId, edge }, pinnedIds);
          }
        }
      }

      const elements = Array.from(
        strip.querySelectorAll<HTMLElement>(`[${TAB_STRIP_ITEM_ID_ATTRIBUTE}]`),
      ).map((element) => ({
        // Non-null: every scanned element was matched BY this exact
        // attribute selector, so it's always present — not a speculative
        // fallback.
        id: element.getAttribute(TAB_STRIP_ITEM_ID_ATTRIBUTE)!,
        rect: element.getBoundingClientRect(),
      }));
      const fallback = findNearestDropTarget(event.clientX, elements, sourceId);
      return fallback ? coercePinnedDropTarget(fallback, pinnedIds) : null;
    },
    [tabs],
  );

  const pulseIfNewTarget = useCallback(
    (target: TabStripDragTarget) => {
      const key = dragTargetKey(target);
      if (dragHapticTargetRef.current !== key) {
        dragHapticTargetRef.current = key;
        haptics.pulse(TAB_STRIP_DRAG_HAPTIC_MS);
      }
    },
    [haptics],
  );

  const clearDragState = useCallback(() => {
    draggingTabIdRef.current = null;
    dragHapticTargetRef.current = null;
    setDragOverTarget(null);
    setDraggingTabId(null);
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  }, []);

  const getItemDragProps = useCallback(
    (tabId: string): TabStripItemDragProps => {
      const tab = tabs.find((candidate) => candidate.id === tabId);
      const draggable = tab ? isTabDraggable(tab, tabs) : false;
      return {
        draggable,
        onDragStart: (event) => {
          if (!draggable) {
            event.preventDefault();
            return;
          }
          suppressClickRef.current = true;
          draggingTabIdRef.current = tabId;
          dragHapticTargetRef.current = `${tabId}:self`;
          setDragOverTarget(null);
          setDraggingTabId(tabId);
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', tabId);
          haptics.pulse(TAB_STRIP_DRAG_HAPTIC_MS);
        },
        onDragEnd: clearDragState,
        onClickCapture: (event) => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            event.preventDefault();
            event.stopPropagation();
          }
        },
      };
    },
    [tabs, clearDragState, haptics],
  );

  const stripDragProps = {
    onDragOver: (event: DragEvent<HTMLElement>) => {
      const sourceId = draggingTabIdRef.current ?? event.dataTransfer.getData('text/plain');
      if (!sourceId) return;
      const target = findDropTarget(event, sourceId);
      if (!target) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      setDragOverTarget((current) =>
        current && dragTargetKey(current) === dragTargetKey(target) ? current : target,
      );
      pulseIfNewTarget(target);
      if (reorderTiming === 'live') {
        onReorder(sourceId, target.tabId, target.edge);
      }
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      const sourceId = draggingTabIdRef.current ?? event.dataTransfer.getData('text/plain');
      if (sourceId) event.preventDefault();
      const target = sourceId ? findDropTarget(event, sourceId) : null;
      if (sourceId && target) {
        onReorder(sourceId, target.tabId, target.edge);
        haptics.pulse(TAB_STRIP_DROP_HAPTIC_MS);
      }
      clearDragState();
    },
    onDragLeave: (event: DragEvent<HTMLElement>) => {
      const nextTarget = event.relatedTarget;
      if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
      setDragOverTarget(null);
    },
  };

  return { draggingTabId, dragOverTarget, stripRef, stripDragProps, getItemDragProps };
}
