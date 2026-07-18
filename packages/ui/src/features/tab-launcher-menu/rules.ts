import type {
  TabLauncherAnchorRect,
  TabLauncherPosition,
  TabLauncherResultItem,
  TabLauncherSelection,
} from './types.js';
import { ALL_KIND_FILTER, ANCHOR_OFFSET, MAX_TAB_RESULTS, MENU_WIDTH, VIEWPORT_MARGIN } from './constants.js';

/**
 * Viewport-clamped fixed position for a dropdown hanging below-and-aligned-
 * to-the-right-edge of `anchorRect`, never spilling past the left/right
 * edges of a `viewportWidth`-wide viewport.
 */
export function clampAnchoredPosition(
  anchorRect: TabLauncherAnchorRect,
  viewportWidth: number,
  menuWidth: number = MENU_WIDTH,
  margin: number = VIEWPORT_MARGIN,
  offset: number = ANCHOR_OFFSET,
): TabLauncherPosition {
  const left = Math.max(margin, Math.min(anchorRect.right - menuWidth, viewportWidth - menuWidth - margin));
  return { top: anchorRect.bottom + offset, left };
}

/** Distinct `kind`s across `items`, in first-seen order (drives the filter chips). */
export function presentKinds(items: readonly TabLauncherResultItem[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const item of items) {
    if (!seen.has(item.kind)) {
      seen.add(item.kind);
      ordered.push(item.kind);
    }
  }
  return ordered;
}

export function filterFiles(
  files: readonly TabLauncherResultItem[],
  query: string,
  kindFilter: string,
): TabLauncherResultItem[] {
  const q = query.trim().toLowerCase();
  return files.filter((file) => {
    if (kindFilter !== ALL_KIND_FILTER && file.kind !== kindFilter) return false;
    if (!q) return true;
    return file.name.toLowerCase().includes(q);
  });
}

/** Tab results are excluded entirely once a kind filter (file-only) is active. */
export function filterTabs(
  tabs: readonly TabLauncherResultItem[],
  query: string,
  kindFilter: string,
  maxResults: number = MAX_TAB_RESULTS,
): TabLauncherResultItem[] {
  if (kindFilter !== ALL_KIND_FILTER) return [];
  const q = query.trim().toLowerCase();
  return tabs.filter((tab) => !q || tabSearchText(tab).includes(q)).slice(0, maxResults);
}

function tabSearchText(tab: TabLauncherResultItem): string {
  return `${tab.name} ${tab.kind} ${tab.meta ?? ''}`.toLowerCase();
}

/** Clamps a selection index into `[0, count)`, collapsing to 0 once the result set is empty. */
export function clampSelection(current: number, count: number): number {
  if (count === 0) return 0;
  return Math.min(current, count - 1);
}

/** Selection advance with wrap-around. */
export function nextSelected(current: number, count: number, direction: 1 | -1): number {
  if (count <= 0) return 0;
  if (direction === 1) return (current + 1) % count;
  return (current - 1 + count) % count;
}

/** Maps a flat selection index across the file+tab result lists into which list it falls in. */
export function resolveSelection(selected: number, filesCount: number): TabLauncherSelection {
  if (selected < filesCount) return { zone: 'file', index: selected };
  return { zone: 'tab', index: selected - filesCount };
}
